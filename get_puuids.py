"""
Riot ID → PUUID Lookup Tool
============================
Takes a list of Riot IDs and outputs a CSV ready for bulk import.

Usage:
    # From a text file (one Riot ID per line, e.g. "ZephyrBlade#NA1")
    python get_puuids.py --input players.txt

    # Directly from command line
    python get_puuids.py "ZephyrBlade#NA1" "ShadowFox#NA1" "DragonSlayer#1234"

    # Custom output file
    python get_puuids.py --input players.txt --output my_players.csv

Output CSV columns: display_name, riot_game_name, riot_tag_line, riot_puuid

Environment variables:
    RIOT_API_KEY       - Your Riot API key
    RIOT_MASS_REGION   - Routing region (default: americas)

You can also create a .env file in this directory or in backend/.env.
"""

import os
import sys
import csv
import time
import argparse

try:
    from dotenv import load_dotenv
    # Try backend/.env first, then root .env
    load_dotenv(os.path.join(os.path.dirname(__file__), "backend", ".env"))
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass  # dotenv not installed, rely on environment variables

import requests

RIOT_API_KEY = os.environ.get("RIOT_API_KEY", "")
RIOT_MASS_REGION = os.environ.get("RIOT_MASS_REGION", "americas")
RATE_LIMIT_DELAY = 1.2  # conservative delay for dev keys


def lookup_puuid(session: requests.Session, game_name: str, tag_line: str) -> str | None:
    """Look up a PUUID by Riot ID using the Account-V1 endpoint."""
    url = (
        f"https://{RIOT_MASS_REGION}.api.riotgames.com"
        f"/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
    )
    time.sleep(RATE_LIMIT_DELAY)
    try:
        resp = session.get(url)
        if resp.status_code == 200:
            return resp.json().get("puuid")
        elif resp.status_code == 404:
            print(f"  NOT FOUND: {game_name}#{tag_line}")
            return None
        elif resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 10))
            print(f"  Rate limited, waiting {retry_after}s...")
            time.sleep(retry_after)
            return lookup_puuid(session, game_name, tag_line)
        else:
            print(f"  ERROR {resp.status_code}: {resp.text[:100]}")
            return None
    except requests.RequestException as e:
        print(f"  Request failed: {e}")
        return None


def parse_riot_id(riot_id: str) -> tuple[str, str] | None:
    """Parse 'GameName#TagLine' into (game_name, tag_line)."""
    riot_id = riot_id.strip()
    if not riot_id or riot_id.startswith("#"):
        return None
    if "#" not in riot_id:
        print(f"  SKIPPING (no # found): {riot_id}")
        return None
    parts = riot_id.rsplit("#", 1)
    game_name = parts[0].strip()
    tag_line = parts[1].strip()
    if not game_name or not tag_line:
        print(f"  SKIPPING (empty name or tag): {riot_id}")
        return None
    return game_name, tag_line


def main():
    parser = argparse.ArgumentParser(description="Look up PUUIDs for Riot IDs and output a CSV")
    parser.add_argument("riot_ids", nargs="*", help='Riot IDs like "Name#Tag"')
    parser.add_argument("--input", "-i", help="Text file with one Riot ID per line")
    parser.add_argument("--output", "-o", default="players_output.csv", help="Output CSV path (default: players_output.csv)")
    args = parser.parse_args()

    if not RIOT_API_KEY or RIOT_API_KEY == "your_riot_api_key_here":
        print("ERROR: RIOT_API_KEY not set. Set it in your environment or backend/.env")
        sys.exit(1)

    # Collect Riot IDs from all sources
    raw_ids: list[str] = list(args.riot_ids)
    if args.input:
        try:
            with open(args.input, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        raw_ids.append(line)
        except FileNotFoundError:
            print(f"ERROR: File not found: {args.input}")
            sys.exit(1)

    if not raw_ids:
        print("No Riot IDs provided. Use --input file.txt or pass them as arguments.")
        print('Example: python get_puuids.py "PlayerName#NA1" "Another#1234"')
        sys.exit(1)

    # Parse and deduplicate
    to_lookup: list[tuple[str, str]] = []
    seen: set[str] = set()
    for raw in raw_ids:
        parsed = parse_riot_id(raw)
        if not parsed:
            continue
        key = f"{parsed[0].lower()}#{parsed[1].lower()}"
        if key in seen:
            continue
        seen.add(key)
        to_lookup.append(parsed)

    print(f"\nLooking up {len(to_lookup)} Riot ID(s)...\n")

    session = requests.Session()
    session.headers.update({
        "X-Riot-Token": RIOT_API_KEY,
        "Accept": "application/json",
    })

    results: list[dict] = []
    for game_name, tag_line in to_lookup:
        print(f"  {game_name}#{tag_line} ... ", end="", flush=True)
        puuid = lookup_puuid(session, game_name, tag_line)
        if puuid:
            print(f"OK")
            results.append({
                "display_name": game_name,
                "riot_game_name": game_name,
                "riot_tag_line": tag_line,
                "riot_puuid": puuid,
            })
        else:
            print(f"FAILED")

    if not results:
        print("\nNo PUUIDs found.")
        sys.exit(1)

    # Write CSV
    with open(args.output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["display_name", "riot_game_name", "riot_tag_line", "riot_puuid"])
        writer.writeheader()
        writer.writerows(results)

    print(f"\nDone! {len(results)}/{len(to_lookup)} players written to {args.output}")
    print(f"You can import this CSV in the Admin portal under Players → Bulk Import.")


if __name__ == "__main__":
    main()
