from __future__ import annotations

"""
InHouse League — Riot API Match Ingestion Service
===================================================
Pulls match data from Riot API Match-V5, parses it,
and writes to Supabase Postgres.

Usage:
    # Ingest a specific match
    python riot_ingest.py --match-id NA1_4953286179

    # Scan all registered players for new games
    python riot_ingest.py --scan

    # Scan with a specific split
    python riot_ingest.py --scan --split-id <uuid>

Environment variables required:
    RIOT_API_KEY        - Your Riot API key
    SUPABASE_URL        - Supabase project URL
    SUPABASE_KEY        - Supabase service_role key (not anon!)
    RIOT_REGION         - Platform region (default: na1)
    RIOT_MASS_REGION    - Routing region (default: americas)
"""

import os
import sys
import time
import logging
import argparse
from datetime import datetime, timezone
from typing import Optional

import requests
from supabase import create_client, Client

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── Config ────────────────────────────────────────────────

RIOT_API_KEY = os.environ.get("RIOT_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")  # Must be service_role key
RIOT_REGION = os.environ.get("RIOT_REGION", "na1")
RIOT_MASS_REGION = os.environ.get("RIOT_MASS_REGION", "americas")

# Rate limit: 20 req/s, 100 req/2min for dev key
RATE_LIMIT_DELAY = .2  # seconds between API calls (safe for dev key)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("riot_ingest")

# ── Supabase Client ───────────────────────────────────────

def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Riot API Client ──────────────────────────────────────

class RiotAPI:
    """Thin wrapper around Riot API Match-V5 endpoints."""

    BASE_PLATFORM = f"https://{RIOT_REGION}.api.riotgames.com"
    BASE_REGIONAL = f"https://{RIOT_MASS_REGION}.api.riotgames.com"

    def __init__(self, api_key: str):
        self.session = requests.Session()
        self.session.headers.update({
            "X-Riot-Token": api_key,
            "Accept": "application/json",
        })

    def _get(self, url: str, log_endpoint: str = "") -> dict | list | None:
        """Make a GET request with rate limiting and error handling."""
        time.sleep(RATE_LIMIT_DELAY)
        try:
            resp = self.session.get(url)
            self._log_api_call(log_endpoint or url, resp.status_code)

            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 404:
                log.warning(f"Not found: {url}")
                return None
            elif resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 10))
                log.warning(f"Rate limited. Waiting {retry_after}s...")
                time.sleep(retry_after)
                return self._get(url, log_endpoint)  # retry
            else:
                log.error(f"API error {resp.status_code}: {resp.text[:200]}")
                return None
        except requests.RequestException as e:
            log.error(f"Request failed: {e}")
            return None

    def _log_api_call(self, endpoint: str, status_code: int):
        """Log API call to Supabase for debugging."""
        try:
            db = get_supabase()
            db.table("riot_api_log").insert({
                "endpoint": endpoint[:200],
                "status_code": status_code,
            }).execute()
        except Exception:
            pass  # Don't let logging failures break ingestion

    def get_match_ids_by_puuid(
        self, puuid: str, count: int = 5, queue: Optional[int] = 3130
    ) -> list[str]:
        """
        Get recent match IDs for a player.
        queue=3130 is tournament code games, queue=420 is ranked solo.
        Pass queue=None to skip queue filtering.
        """
        url = (
            f"{self.BASE_REGIONAL}/lol/match/v5/matches/by-puuid/{puuid}/ids"
            f"?count={count}" + (f"&queue={queue}" if queue is not None else "")
        )
        result = self._get(url, f"match-v5/by-puuid/{puuid[:8]}../ids")
        return result if isinstance(result, list) else []

    def get_match(self, match_id: str) -> dict | None:
        """Get full match data by match ID."""
        url = f"{self.BASE_REGIONAL}/lol/match/v5/matches/{match_id}"
        result = self._get(url, f"match-v5/matches/{match_id}")
        return result if isinstance(result, dict) else None


# ── Champion ID Resolver ─────────────────────────────────

_CHAMP_ID_MAP: dict[int, str] = {}

def get_champion_name(champ_id: int) -> str | None:
    """Resolve champion ID to name using Data Dragon."""
    if not _CHAMP_ID_MAP:
        try:
            versions = requests.get("https://ddragon.leagueoflegends.com/api/versions.json").json()
            ver = versions[0] if versions else "14.24.1"
            data = requests.get(f"https://ddragon.leagueoflegends.com/cdn/{ver}/data/en_US/champion.json").json()
            for champ in data.get("data", {}).values():
                _CHAMP_ID_MAP[int(champ["key"])] = champ["name"]
        except Exception:
            pass
    return _CHAMP_ID_MAP.get(champ_id)


# ── Match Parser ─────────────────────────────────────────

# Map Riot's teamPosition to our role format
POSITION_MAP = {
    "TOP": "top",
    "JUNGLE": "jungle",
    "MIDDLE": "mid",
    "BOTTOM": "adc",
    "UTILITY": "support",
    "": None,  # Sometimes empty in custom games
}


def parse_match_to_game(match_data: dict) -> dict:
    """
    Parse Riot API match response into a dict for the `games` table.
    """
    info = match_data["info"]

    # Team-level aggregates
    teams = {t["teamId"]: t for t in info.get("teams", [])}
    blue_team = teams.get(100, {})
    red_team = teams.get(200, {})

    def count_objectives(team_data, obj_name):
        return team_data.get("objectives", {}).get(obj_name, {}).get("kills", 0)

    # Aggregate kills/gold from participants
    blue_kills = sum(
        p["kills"] for p in info["participants"] if p["teamId"] == 100
    )
    red_kills = sum(
        p["kills"] for p in info["participants"] if p["teamId"] == 200
    )
    blue_gold = sum(
        p["goldEarned"] for p in info["participants"] if p["teamId"] == 100
    )
    red_gold = sum(
        p["goldEarned"] for p in info["participants"] if p["teamId"] == 200
    )

    # First objectives
    first_blood = None
    for p in info["participants"]:
        if p.get("firstBloodKill"):
            first_blood = "blue" if p["teamId"] == 100 else "red"
            break

    # Convert epoch ms to ISO timestamp
    game_start = None
    if info.get("gameStartTimestamp"):
        game_start = datetime.fromtimestamp(
            info["gameStartTimestamp"] / 1000, tz=timezone.utc
        ).isoformat()

    game_end = None
    if info.get("gameEndTimestamp"):
        game_end = datetime.fromtimestamp(
            info["gameEndTimestamp"] / 1000, tz=timezone.utc
        ).isoformat()

    return {
        "riot_match_id": match_data["metadata"]["matchId"],
        "riot_game_id": info.get("gameId"),
        "platform_id": match_data["metadata"].get("platformId", RIOT_REGION.upper()),
        "game_duration": info.get("gameDuration", 0),
        "game_version": info.get("gameVersion", ""),
        "game_mode": info.get("gameMode", "CLASSIC"),
        "queue_id": info.get("queueId", 0),
        # Team aggregates
        "blue_total_kills": blue_kills,
        "blue_total_gold": blue_gold,
        "blue_total_towers": count_objectives(blue_team, "tower"),
        "blue_total_dragons": count_objectives(blue_team, "dragon"),
        "blue_total_barons": count_objectives(blue_team, "baron"),
        "blue_total_heralds": count_objectives(blue_team, "riftHerald"),
        "red_total_kills": red_kills,
        "red_total_gold": red_gold,
        "red_total_towers": count_objectives(red_team, "tower"),
        "red_total_dragons": count_objectives(red_team, "dragon"),
        "red_total_barons": count_objectives(red_team, "baron"),
        "red_total_heralds": count_objectives(red_team, "riftHerald"),
        # First objectives
        "first_blood_team": first_blood,
        # Timestamps
        "game_started_at": game_start,
        "game_ended_at": game_end,
        # Status
        "status": "completed",
        # Store raw JSON for future analysis
        "riot_data_raw": match_data,
    }


def parse_participant(participant: dict, game_duration_sec: int) -> dict:
    """
    Parse a single participant from Riot API into a dict
    for the `player_game_stats` table.
    """
    p = participant
    duration_min = max(game_duration_sec / 60, 1)  # avoid div by zero
    total_cs = p.get("totalMinionsKilled", 0) + p.get("neutralMinionsKilled", 0)

    return {
        # Identity (we'll resolve player_id and team_id in the ingestion step)
        "riot_puuid": p["puuid"],
        "team_side": "blue" if p["teamId"] == 100 else "red",
        # Champion & Role
        "champion_id": p.get("championId", 0),
        "champion_name": p.get("championName", "Unknown"),
        "role": POSITION_MAP.get(p.get("teamPosition", ""), None),
        # Core KDA
        "kills": p.get("kills", 0),
        "deaths": p.get("deaths", 0),
        "assists": p.get("assists", 0),
        # Farming
        "total_minions_killed": p.get("totalMinionsKilled", 0),
        "neutral_minions_killed": p.get("neutralMinionsKilled", 0),
        "cs_per_min": round(total_cs / duration_min, 2),
        # Economy
        "gold_earned": p.get("goldEarned", 0),
        "gold_spent": p.get("goldSpent", 0),
        "gold_per_min": round(p.get("goldEarned", 0) / duration_min, 2),
        # Damage
        "total_damage_dealt_to_champions": p.get("totalDamageDealtToChampions", 0),
        "physical_damage_dealt_to_champions": p.get("physicalDamageDealtToChampions", 0),
        "magic_damage_dealt_to_champions": p.get("magicDamageDealtToChampions", 0),
        "true_damage_dealt_to_champions": p.get("trueDamageDealtToChampions", 0),
        "total_damage_taken": p.get("totalDamageTaken", 0),
        "damage_self_mitigated": p.get("damageSelfMitigated", 0),
        # Healing & Shielding
        "total_heal": p.get("totalHeal", 0),
        "total_heals_on_teammates": p.get("totalHealsOnTeammates", 0),
        "total_damage_shielded_on_teammates": p.get("totalDamageShieldedOnTeammates", 0),
        # Vision
        "vision_score": p.get("visionScore", 0),
        "wards_placed": p.get("wardsPlaced", 0),
        "wards_killed": p.get("wardsKilled", 0),
        "control_wards_purchased": p.get("controlWardsPlaced", 0),
        # Objectives
        "turret_kills": p.get("turretKills", 0),
        "inhibitor_kills": p.get("inhibitorKills", 0),
        "dragon_kills": p.get("dragonKills", 0),
        "baron_kills": p.get("baronKills", 0),
        # Combat details
        "largest_killing_spree": p.get("largestKillingSpree", 0),
        "largest_multi_kill": p.get("largestMultiKill", 0),
        "double_kills": p.get("doubleKills", 0),
        "triple_kills": p.get("tripleKills", 0),
        "quadra_kills": p.get("quadraKills", 0),
        "penta_kills": p.get("pentaKills", 0),
        # Summoner spells & runes
        "summoner1_id": p.get("summoner1Id"),
        "summoner2_id": p.get("summoner2Id"),
        "primary_rune_path": (
            p.get("perks", {}).get("styles", [{}])[0].get("style")
            if p.get("perks", {}).get("styles") else None
        ),
        "primary_keystone": (
            p.get("perks", {}).get("styles", [{}])[0]
            .get("selections", [{}])[0].get("perk")
            if p.get("perks", {}).get("styles") else None
        ),
        "secondary_rune_path": (
            p.get("perks", {}).get("styles", [{}])[1].get("style")
            if len(p.get("perks", {}).get("styles", [])) > 1 else None
        ),
        # Items
        "item0": p.get("item0", 0),
        "item1": p.get("item1", 0),
        "item2": p.get("item2", 0),
        "item3": p.get("item3", 0),
        "item4": p.get("item4", 0),
        "item5": p.get("item5", 0),
        "item6": p.get("item6", 0),
        # Outcome
        "win": p.get("win", False),
        # Misc
        "time_played": p.get("timePlayed", 0),
        "first_blood_kill": p.get("firstBloodKill", False),
        "first_blood_assist": p.get("firstBloodAssist", False),
        "first_tower_kill": p.get("firstTowerKill", False),
    }


# ── Ingestion Logic ──────────────────────────────────────

def game_already_ingested(db: Client, riot_match_id: str) -> bool:
    """Check if we've already ingested this game."""
    result = (
        db.table("games")
        .select("id")
        .eq("riot_match_id", riot_match_id)
        .limit(1)
        .execute()
    )
    return len(result.data) > 0


def resolve_player_id(db: Client, riot_puuid: str) -> Optional[str]:
    """Look up a player's UUID by their Riot PUUID."""
    result = (
        db.table("players")
        .select("id")
        .eq("riot_puuid", riot_puuid)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["id"]
    return None


def resolve_team_id_for_player(
    db: Client, player_id: str, split_id: str
) -> Optional[str]:
    """Look up which team a player is on for the current split."""
    result = (
        db.table("rosters")
        .select("team_id")
        .eq("player_id", player_id)
        .eq("split_id", split_id)
        .is_("left_at", "null")
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["team_id"]
    return None


def get_active_split(db: Client) -> Optional[dict]:
    """Get the currently active split."""
    result = (
        db.table("splits")
        .select("*")
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]
    return None


def get_registered_puuids(db: Client) -> list[str]:
    """Get all PUUIDs of registered players."""
    result = (
        db.table("players")
        .select("riot_puuid")
        .eq("is_active", True)
        .not_.is_("riot_puuid", "null")
        .execute()
    )
    return [r["riot_puuid"] for r in result.data]


def find_or_create_match(
    db: Client,
    split_id: str,
    blue_team_id: Optional[str],
    red_team_id: Optional[str],
) -> Optional[str]:
    """
    Find an existing scheduled match for these two teams,
    or create a new one. Returns match UUID.
    """
    if not blue_team_id or not red_team_id:
        log.warning("Cannot resolve both teams — creating unlinked match")

    # Try to find a scheduled match between these teams
    if blue_team_id and red_team_id:
        result = (
            db.table("matches")
            .select("id")
            .eq("split_id", split_id)
            .eq("status", "scheduled")
            .or_(
                f"and(team_blue_id.eq.{blue_team_id},team_red_id.eq.{red_team_id}),"
                f"and(team_blue_id.eq.{red_team_id},team_red_id.eq.{blue_team_id})"
            )
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]["id"]

    # Create a new match
    insert_data = {
        "split_id": split_id,
        "team_blue_id": blue_team_id,
        "team_red_id": red_team_id,
        "match_format": "bo1",
        "status": "completed",
    }
    # Only insert if we have both teams
    if blue_team_id and red_team_id:
        result = db.table("matches").insert(insert_data).execute()
        if result.data:
            return result.data[0]["id"]

    return None


def update_standings(db: Client, split_id: str):
    """
    Recalculate standings for all teams in a split
    based on completed matches.
    """
    log.info("Recalculating standings...")

    # Get all teams in this split
    teams_result = (
        db.table("teams")
        .select("id, division")
        .eq("season_id", (
            db.table("splits")
            .select("season_id")
            .eq("id", split_id)
            .limit(1)
            .execute()
            .data[0]["season_id"]
        ))
        .execute()
    )

    for team in teams_result.data:
        team_id = team["id"]

        # Count match wins/losses
        wins_blue = (
            db.table("matches")
            .select("id", count="exact")
            .eq("split_id", split_id)
            .eq("team_blue_id", team_id)
            .eq("winner_team_id", team_id)
            .eq("status", "completed")
            .execute()
        )
        wins_red = (
            db.table("matches")
            .select("id", count="exact")
            .eq("split_id", split_id)
            .eq("team_red_id", team_id)
            .eq("winner_team_id", team_id)
            .eq("status", "completed")
            .execute()
        )
        losses_blue = (
            db.table("matches")
            .select("id", count="exact")
            .eq("split_id", split_id)
            .eq("team_blue_id", team_id)
            .neq("winner_team_id", team_id)
            .eq("status", "completed")
            .not_.is_("winner_team_id", "null")
            .execute()
        )
        losses_red = (
            db.table("matches")
            .select("id", count="exact")
            .eq("split_id", split_id)
            .eq("team_red_id", team_id)
            .neq("winner_team_id", team_id)
            .eq("status", "completed")
            .not_.is_("winner_team_id", "null")
            .execute()
        )

        total_wins = (wins_blue.count or 0) + (wins_red.count or 0)
        total_losses = (losses_blue.count or 0) + (losses_red.count or 0)

        # Calculate streak from recent matches (ordered by completion)
        recent = (
            db.table("matches")
            .select("winner_team_id, completed_at")
            .eq("split_id", split_id)
            .eq("status", "completed")
            .or_(f"team_blue_id.eq.{team_id},team_red_id.eq.{team_id}")
            .not_.is_("winner_team_id", "null")
            .order("completed_at", desc=True)
            .limit(10)
            .execute()
        )

        streak_type = ""
        streak_count = 0
        for m in recent.data:
            won = m["winner_team_id"] == team_id
            current = "W" if won else "L"
            if streak_type == "":
                streak_type = current
                streak_count = 1
            elif current == streak_type:
                streak_count += 1
            else:
                break

        streak = f"{streak_type}{streak_count}" if streak_type else "W0"

        # Upsert standings
        db.table("standings").upsert({
            "team_id": team_id,
            "split_id": split_id,
            "wins": total_wins,
            "losses": total_losses,
            "streak": streak,
            "streak_count": streak_count,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="team_id,split_id").execute()

    log.info("Standings updated.")


def ingest_match(riot_match_id: str, split_id: Optional[str] = None) -> bool:
    """
    Main ingestion function: pull a match from Riot API and store it.
    Returns True if successfully ingested.
    """
    db = get_supabase()
    riot = RiotAPI(RIOT_API_KEY)

    # Check if already ingested
    if game_already_ingested(db, riot_match_id):
        log.info(f"Already ingested: {riot_match_id}")
        return False

    # Resolve active split
    if not split_id:
        split = get_active_split(db)
        if not split:
            log.error("No active split found!")
            return False
        split_id = split["id"]

    # Fetch match data from Riot
    log.info(f"Fetching match: {riot_match_id}")
    match_data = riot.get_match(riot_match_id)
    if not match_data:
        log.error(f"Could not fetch match: {riot_match_id}")
        return False

    # Parse game-level data
    game_data = parse_match_to_game(match_data)

    # Parse all 10 participants
    participants = []
    for p in match_data["info"]["participants"]:
        parsed = parse_participant(p, match_data["info"].get("gameDuration", 0))
        participants.append(parsed)

    # Resolve player IDs and team IDs
    blue_team_id = None
    red_team_id = None

    for p in participants:
        player_id = resolve_player_id(db, p["riot_puuid"])
        if player_id:
            p["player_id"] = player_id
            team_id = resolve_team_id_for_player(db, player_id, split_id)
            p["team_id"] = team_id

            # Track team sides
            if p["team_side"] == "blue" and team_id:
                blue_team_id = team_id
            elif p["team_side"] == "red" and team_id:
                red_team_id = team_id
        else:
            log.warning(f"Unknown player PUUID: {p['riot_puuid'][:16]}...")
            p["player_id"] = None
            p["team_id"] = None

    # Find or create the match (series) record
    match_uuid = find_or_create_match(db, split_id, blue_team_id, red_team_id)

    if not match_uuid:
        log.warning("Could not link to a match record. Storing game standalone.")

    # Determine winner
    winner_team_id = None
    blue_win = match_data["info"]["teams"][0].get("win", False)
    if match_data["info"]["teams"][0]["teamId"] == 100:
        winner_team_id = blue_team_id if blue_win else red_team_id
    else:
        winner_team_id = red_team_id if blue_win else blue_team_id

    # Insert game
    game_data["match_id"] = match_uuid
    game_data["game_number"] = 1  # TODO: detect game number in series
    game_data["blue_team_id"] = blue_team_id
    game_data["red_team_id"] = red_team_id
    game_data["winner_team_id"] = winner_team_id

    log.info(f"Inserting game: {riot_match_id}")
    game_result = db.table("games").insert(game_data).execute()

    if not game_result.data:
        log.error("Failed to insert game!")
        return False

    game_uuid = game_result.data[0]["id"]

    # Insert player stats (only for registered players)
    stats_inserted = 0
    for p in participants:
        if not p.get("player_id") or not p.get("team_id"):
            continue  # Skip unregistered players

        stat_row = {k: v for k, v in p.items() if k not in ("riot_puuid", "team_side")}
        stat_row["game_id"] = game_uuid

        try:
            db.table("player_game_stats").insert(stat_row).execute()
            stats_inserted += 1
        except Exception as e:
            log.error(f"Failed to insert stats for {p.get('player_id')}: {e}")

    log.info(f"Inserted {stats_inserted}/10 player stat rows")

    # Insert bans
    bans_inserted = 0
    for team_data in match_data["info"].get("teams", []):
        team_id_num = team_data["teamId"]
        team_side = "blue" if team_id_num == 100 else "red"
        ban_team_id = blue_team_id if team_side == "blue" else red_team_id

        for ban in team_data.get("bans", []):
            champ_id = ban.get("championId", 0)
            if champ_id <= 0:
                continue  # No ban in this slot
            pick_turn = ban.get("pickTurn", 0)
            champ_name = get_champion_name(champ_id)
            try:
                db.table("team_bans").insert({
                    "game_id": game_uuid,
                    "team_id": ban_team_id,
                    "team_side": team_side,
                    "ban_order": pick_turn,
                    "champion_id": champ_id,
                    "champion_name": champ_name,
                }).execute()
                bans_inserted += 1
            except Exception as e:
                log.error(f"Failed to insert ban: {e}")

    log.info(f"Inserted {bans_inserted} bans")

    # Update the match record
    if match_uuid and winner_team_id:
        db.table("matches").update({
            "winner_team_id": winner_team_id,
            "score_blue": 1 if winner_team_id == blue_team_id else 0,
            "score_red": 1 if winner_team_id == red_team_id else 0,
            "status": "completed",
            "completed_at": game_data.get("game_ended_at"),
            "started_at": game_data.get("game_started_at"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", match_uuid).execute()

    # Update standings
    update_standings(db, split_id)

    log.info(f"✅ Successfully ingested: {riot_match_id}")
    return True


def scan_for_new_games(split_id: Optional[str] = None):
    """
    Scan all registered players for new custom games
    and ingest any that haven't been processed yet.
    """
    db = get_supabase()
    riot = RiotAPI(RIOT_API_KEY)

    if not split_id:
        split = get_active_split(db)
        if not split:
            log.error("No active split found!")
            return
        split_id = split["id"]

    puuids = get_registered_puuids(db)
    log.info(f"Scanning {len(puuids)} registered players for new games...")

    # Collect unique new match IDs
    new_match_ids = set()
    seen_match_ids = set()

    for puuid in puuids:
        # Only need to check one player per game, but we check all
        # to catch games where teams are mixed
        match_ids = riot.get_match_ids_by_puuid(puuid, count=5, queue=3130)

        for mid in match_ids:
            if mid in seen_match_ids:
                continue
            seen_match_ids.add(mid)

            if not game_already_ingested(db, mid):
                new_match_ids.add(mid)

    if not new_match_ids:
        log.info("No new games found.")
        return

    log.info(f"Found {len(new_match_ids)} new game(s) to ingest")

    for mid in sorted(new_match_ids):
        try:
            ingest_match(mid, split_id)
        except Exception as e:
            log.error(f"Error ingesting {mid}: {e}")
            continue


# ── CLI ───────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="InHouse League — Riot API Ingestion")
    parser.add_argument("--match-id", help="Ingest a specific Riot match ID (e.g., NA1_4953286179)")
    parser.add_argument("--match-ids", nargs="+", help="Ingest multiple Riot match IDs (space-separated)")
    parser.add_argument("--scan", action="store_true", help="Scan all players for new games")
    parser.add_argument("--split-id", help="Override the active split UUID")

    args = parser.parse_args()

    if not RIOT_API_KEY:
        log.error("RIOT_API_KEY environment variable not set!")
        sys.exit(1)

    if args.match_id:
        success = ingest_match(args.match_id, args.split_id)
        sys.exit(0 if success else 1)
    elif args.match_ids:
        failed = 0
        for mid in args.match_ids:
            try:
                if not ingest_match(mid, args.split_id):
                    failed += 1
            except Exception as e:
                log.error(f"Error ingesting {mid}: {e}")
                failed += 1
        log.info(f"Done: {len(args.match_ids) - failed}/{len(args.match_ids)} ingested")
        sys.exit(1 if failed == len(args.match_ids) else 0)
    elif args.scan:
        scan_for_new_games(args.split_id)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
