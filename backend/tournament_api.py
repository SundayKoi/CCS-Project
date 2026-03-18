"""
CCS League — Tournament API Management + Webhook Receiver
==============================================================
Handles:
  1. Registering as a tournament provider with Riot
  2. Creating tournaments for each split
  3. Generating tournament codes for scheduled matches
  4. Receiving Riot's POST callback when games end
  5. Auto-ingesting match data on callback

FastAPI endpoints:
  POST /api/webhook/riot          — Riot callback (game completed)
  POST /api/admin/tournament/setup — Register provider + create tournament
  POST /api/admin/codes/generate   — Generate codes for upcoming matches
  GET  /api/admin/codes/{match_id} — Get code for a specific match

Requirements:
  - Production Riot API key with Tournament API access
  - Publicly accessible server (Riot must reach your callback URL)
  - Callback URL must use a valid gTLD approved before March 2011
  - HTTP (port 80) or HTTPS (port 443) only

Environment variables:
  RIOT_API_KEY, SUPABASE_URL, SUPABASE_KEY, RIOT_REGION,
  RIOT_MASS_REGION, CALLBACK_BASE_URL
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional

import requests
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

from riot_ingest import ingest_match

# ── Config ────────────────────────────────────────────────

RIOT_API_KEY = os.environ.get("RIOT_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
RIOT_REGION = os.environ.get("RIOT_REGION", "NA")           # For tournament API: "NA", "EUW", etc.
RIOT_MASS_REGION = os.environ.get("RIOT_MASS_REGION", "americas")
CALLBACK_BASE_URL = os.environ.get("CALLBACK_BASE_URL", "")  # e.g. "https://api.yourleague.com"

RIOT_BASE = f"https://{RIOT_MASS_REGION}.api.riotgames.com"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("tournament")

# ── FastAPI App ───────────────────────────────────────────

app = FastAPI(title="CCS League API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock this down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def riot_headers():
    return {"X-Riot-Token": RIOT_API_KEY, "Content-Type": "application/json"}


# ══════════════════════════════════════════════════════════
# RIOT TOURNAMENT API V5 — Provider & Tournament Management
# ══════════════════════════════════════════════════════════

class TournamentSetupRequest(BaseModel):
    split_id: str
    tournament_name: str  # e.g. "Season 1 Split 1"


@app.post("/api/admin/tournament/setup")
async def setup_tournament(req: TournamentSetupRequest):
    """
    One-time setup: register as a provider + create a tournament.
    Only needs to be done once per region and once per split.
    """
    db = get_db()
    callback_url = f"{CALLBACK_BASE_URL}/api/webhook/riot"

    # Step 1: Register provider (if not already registered)
    existing = db.table("tournament_providers").select("*").limit(1).execute()

    if existing.data:
        provider = existing.data[0]
        riot_provider_id = provider["riot_provider_id"]
        provider_uuid = provider["id"]
        log.info(f"Using existing provider: {riot_provider_id}")
    else:
        log.info("Registering new tournament provider with Riot...")
        resp = requests.post(
            f"{RIOT_BASE}/lol/tournament/v5/providers",
            headers=riot_headers(),
            json={"region": RIOT_REGION, "url": callback_url},
        )
        if resp.status_code != 200:
            raise HTTPException(500, f"Failed to register provider: {resp.text}")

        riot_provider_id = resp.json()
        result = db.table("tournament_providers").insert({
            "riot_provider_id": riot_provider_id,
            "region": RIOT_REGION,
            "callback_url": callback_url,
        }).execute()
        provider_uuid = result.data[0]["id"]
        log.info(f"Registered provider: {riot_provider_id}")

    # Step 2: Create tournament for this split
    existing_tourney = (
        db.table("tournaments")
        .select("*")
        .eq("split_id", req.split_id)
        .limit(1)
        .execute()
    )

    if existing_tourney.data:
        return {
            "message": "Tournament already exists for this split",
            "tournament": existing_tourney.data[0],
        }

    log.info(f"Creating tournament: {req.tournament_name}")
    resp = requests.post(
        f"{RIOT_BASE}/lol/tournament/v5/tournaments",
        headers=riot_headers(),
        json={"name": req.tournament_name, "providerId": riot_provider_id},
    )
    if resp.status_code != 200:
        raise HTTPException(500, f"Failed to create tournament: {resp.text}")

    riot_tournament_id = resp.json()
    result = db.table("tournaments").insert({
        "riot_tournament_id": riot_tournament_id,
        "provider_id": provider_uuid,
        "split_id": req.split_id,
        "name": req.tournament_name,
    }).execute()

    return {
        "message": "Tournament created",
        "provider_id": riot_provider_id,
        "tournament_id": riot_tournament_id,
        "tournament": result.data[0],
    }


# ══════════════════════════════════════════════════════════
# TOURNAMENT CODE GENERATION
# ══════════════════════════════════════════════════════════

class GenerateCodesRequest(BaseModel):
    match_ids: list[str]         # List of match UUIDs to generate codes for
    pick_type: str = "TOURNAMENT_DRAFT"
    map_type: str = "SUMMONERS_RIFT"
    spectator_type: str = "ALL"
    team_size: int = 5


@app.post("/api/admin/codes/generate")
async def generate_codes(req: GenerateCodesRequest):
    """
    Generate tournament codes for one or more scheduled matches.
    Each match gets one code. The match UUID is embedded in the
    metadata so the callback can link back to it.
    """
    db = get_db()

    # Find the active tournament
    active_split = (
        db.table("splits").select("id").eq("is_active", True).limit(1).execute()
    )
    if not active_split.data:
        raise HTTPException(400, "No active split found")
    split_id = active_split.data[0]["id"]

    tournament = (
        db.table("tournaments")
        .select("*")
        .eq("split_id", split_id)
        .limit(1)
        .execute()
    )
    if not tournament.data:
        raise HTTPException(400, "No tournament found for active split. Run setup first.")

    riot_tournament_id = tournament.data[0]["riot_tournament_id"]
    tournament_uuid = tournament.data[0]["id"]

    generated = []
    for match_id in req.match_ids:
        # Check if code already exists for this match
        existing = (
            db.table("tournament_codes")
            .select("code")
            .eq("match_id", match_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            generated.append({
                "match_id": match_id,
                "code": existing.data[0]["code"],
                "status": "already_exists",
            })
            continue

        # Get the match to find team participants
        match_data = (
            db.table("matches")
            .select("*, team_blue:teams!matches_team_blue_id_fkey(id), team_red:teams!matches_team_red_id_fkey(id)")
            .eq("id", match_id)
            .limit(1)
            .execute()
        )

        # Embed match UUID in metadata so callback can find it
        metadata = json.dumps({"match_id": match_id})

        log.info(f"Generating tournament code for match {match_id}")
        resp = requests.post(
            f"{RIOT_BASE}/lol/tournament/v5/codes",
            headers=riot_headers(),
            params={"count": 1, "tournamentId": riot_tournament_id},
            json={
                "mapType": req.map_type,
                "pickType": req.pick_type,
                "spectatorType": req.spectator_type,
                "teamSize": req.team_size,
                "metadata": metadata,
            },
        )

        if resp.status_code != 200:
            log.error(f"Code generation failed for {match_id}: {resp.text}")
            generated.append({
                "match_id": match_id,
                "status": "error",
                "error": resp.text[:200],
            })
            continue

        codes = resp.json()  # Returns a list of code strings
        code = codes[0]

        # Store the code
        db.table("tournament_codes").insert({
            "code": code,
            "tournament_id": tournament_uuid,
            "match_id": match_id,
            "team_size": req.team_size,
            "pick_type": req.pick_type,
            "map_type": req.map_type,
            "spectator_type": req.spectator_type,
            "metadata": metadata,
        }).execute()

        generated.append({
            "match_id": match_id,
            "code": code,
            "status": "created",
        })

    return {"codes": generated}


@app.get("/api/admin/codes/{match_id}")
async def get_code_for_match(match_id: str):
    """Get the tournament code for a specific match."""
    db = get_db()
    result = (
        db.table("tournament_codes")
        .select("*")
        .eq("match_id", match_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "No code found for this match")
    return result.data[0]


# ══════════════════════════════════════════════════════════
# RIOT WEBHOOK CALLBACK — Game Completed
# ══════════════════════════════════════════════════════════

@app.post("/api/webhook/riot")
async def riot_callback(request: Request):
    """
    Riot POSTs here when a tournament code game ends.

    The callback body is a JSON string containing:
    {
        "startTime": 1234567890,
        "shortCode": "NA1234-TOURNAMENT-CODE",
        "metaData": "{\"match_id\": \"uuid\"}",
        "gameId": 1234567890,
        "gameName": "...",
        "gameType": "MATCHED_GAME",
        "gameMap": 11,
        "gameMode": "CLASSIC",
        "region": "NA1"
    }

    We then use the match ID from the callback to fetch full
    stats from Match-V5 and ingest them.
    """
    try:
        body = await request.body()
        # Riot sends the callback as a JSON-encoded string
        callback_data = json.loads(body)
        log.info(f"Riot callback received: gameId={callback_data.get('gameId')}")
    except Exception as e:
        log.error(f"Failed to parse callback: {e}")
        raise HTTPException(400, "Invalid callback data")

    db = get_db()

    # Extract info from callback
    short_code = callback_data.get("shortCode", "")
    game_id = callback_data.get("gameId")
    region = callback_data.get("region", "NA1")
    metadata_str = callback_data.get("metaData", "{}")

    # Parse metadata to get our match UUID
    try:
        metadata = json.loads(metadata_str) if metadata_str else {}
    except json.JSONDecodeError:
        metadata = {}

    match_uuid = metadata.get("match_id")

    # Construct the Riot match ID: "{region}_{gameId}"
    riot_match_id = f"{region}_{game_id}"
    log.info(f"Game completed: {riot_match_id} (code: {short_code})")

    # Update the tournament code record
    if short_code:
        db.table("tournament_codes").update({
            "is_used": True,
            "riot_match_id": riot_match_id,
            "callback_received_at": datetime.now(timezone.utc).isoformat(),
        }).eq("code", short_code).execute()

    # Resolve the split from the tournament code
    split_id = None
    if short_code:
        tc = (
            db.table("tournament_codes")
            .select("tournament_id, tournaments(split_id)")
            .eq("code", short_code)
            .limit(1)
            .execute()
        )
        if tc.data and tc.data[0].get("tournaments"):
            split_id = tc.data[0]["tournaments"]["split_id"]

    # Ingest the match data
    # Note: Riot data may take a few seconds to be available via Match-V5
    # after the callback. We add a small retry mechanism.
    import time
    max_retries = 3
    for attempt in range(max_retries):
        try:
            success = ingest_match(riot_match_id, split_id)
            if success:
                log.info(f"✅ Auto-ingested: {riot_match_id}")

                # Update the match status to completed if we know which match
                if match_uuid:
                    db.table("matches").update({
                        "status": "completed",
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("id", match_uuid).execute()

                return {"status": "ok", "match_id": riot_match_id, "ingested": True}
            else:
                log.info(f"Match already ingested or not found: {riot_match_id}")
                return {"status": "ok", "match_id": riot_match_id, "ingested": False}
        except Exception as e:
            if attempt < max_retries - 1:
                log.warning(f"Retry {attempt + 1}/{max_retries} for {riot_match_id}: {e}")
                time.sleep(5 * (attempt + 1))  # 5s, 10s backoff
            else:
                log.error(f"Failed to ingest after {max_retries} attempts: {e}")
                # Store the callback data so we can retry manually later
                db.table("riot_api_log").insert({
                    "endpoint": "webhook/riot/callback",
                    "riot_match_id": riot_match_id,
                    "error_message": str(e)[:500],
                    "status_code": 500,
                }).execute()
                return {"status": "error", "match_id": riot_match_id, "error": str(e)[:200]}


# ══════════════════════════════════════════════════════════
# FALLBACK — Manual fetch by tournament code
# ══════════════════════════════════════════════════════════

@app.post("/api/admin/codes/{code}/fetch")
async def fetch_by_tournament_code(code: str):
    """
    Fallback: if the callback was never received, manually
    pull match IDs associated with a tournament code.
    """
    resp = requests.get(
        f"{RIOT_BASE}/lol/match/v5/matches/by-puuid/tournament-codes/{code}",
        headers=riot_headers(),
    )

    # Actually the correct endpoint is:
    # GET /lol/tournament/v5/codes/{tournamentCode}
    # to get the code details, and then use the match ID

    # For fetching match IDs by tournament code:
    resp = requests.get(
        f"{RIOT_BASE}/lol/match/v5/matches/by-tournament-code/{code}/ids",
        headers=riot_headers(),
    )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"Riot API error: {resp.text[:200]}")

    match_ids = resp.json()
    if not match_ids:
        return {"message": "No matches found for this code", "code": code}

    results = []
    for mid in match_ids:
        success = ingest_match(mid)
        results.append({"match_id": mid, "ingested": success})

    return {"code": code, "results": results}


# ══════════════════════════════════════════════════════════
# DISCORD BOT COMMANDS — Updated for tournament codes
# ══════════════════════════════════════════════════════════

"""
Add these commands to your Discord bot for tournament code workflow:

!newcode <match_id>     — Generate a tournament code for a match
!code <match_id>        — Display the code for a match  
!codes                  — List all codes for this week's matches
!ingest <match_id>      — Force re-ingest from Riot (fallback)

Example workflow:
  1. Admin schedules matches in the DB or via admin panel
  2. Admin runs !newcode <match_id> — bot returns the tournament code
  3. Admin shares the code with team captains
  4. Teams use the code to create the custom game lobby
  5. Game ends → Riot POSTs to your webhook → auto-ingested
  6. Website updates automatically
"""


# ══════════════════════════════════════════════════════════
# Health check
# ══════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ══════════════════════════════════════════════════════════
# Run with: uvicorn tournament_api:app --host 0.0.0.0 --port 8000
# ══════════════════════════════════════════════════════════
