"""
Discord Bot Cog — Match Ingestion Trigger
==========================================
Add this cog to your existing CCS League Discord bot
or run it as a standalone bot.

Commands:
    !ingest NA1_4953286179    — Ingest a specific match
    !scan                     — Scan all players for new games
    !lastgame                 — Ingest the most recent game from any registered player

Setup:
    pip install discord.py requests supabase
    
    Environment variables:
        DISCORD_BOT_TOKEN
        RIOT_API_KEY
        SUPABASE_URL
        SUPABASE_KEY
        ALLOWED_CHANNEL_IDS    — comma-separated channel IDs where commands work
        ADMIN_ROLE_NAME        — role name that can trigger ingestion (default: "League Admin")
"""

import os
import discord
from discord.ext import commands, tasks
from riot_ingest import ingest_match, scan_for_new_games, RiotAPI, get_supabase, get_registered_puuids

ALLOWED_CHANNELS = [
    int(x.strip())
    for x in os.environ.get("ALLOWED_CHANNEL_IDS", "").split(",")
    if x.strip()
]
ADMIN_ROLE = os.environ.get("ADMIN_ROLE_NAME", "League Admin")


def is_admin():
    """Check if user has the admin role."""
    async def predicate(ctx):
        if not ctx.guild:
            return False
        role = discord.utils.get(ctx.author.roles, name=ADMIN_ROLE)
        return role is not None
    return commands.check(predicate)


def in_allowed_channel():
    """Check if command is in an allowed channel."""
    async def predicate(ctx):
        if not ALLOWED_CHANNELS:
            return True  # No restriction if not configured
        return ctx.channel.id in ALLOWED_CHANNELS
    return commands.check(predicate)


class MatchIngestion(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        # Start the cron backup scanner
        self.auto_scan.start()

    def cog_unload(self):
        self.auto_scan.cancel()

    @commands.command(name="ingest")
    @is_admin()
    @in_allowed_channel()
    async def ingest_cmd(self, ctx, riot_match_id: str):
        """Ingest a specific Riot match by ID."""
        if not riot_match_id.startswith(("NA1_", "EUW1_", "KR_")):
            await ctx.send("⚠️ That doesn't look like a valid match ID. Example: `NA1_4953286179`")
            return

        msg = await ctx.send(f"⏳ Ingesting `{riot_match_id}`...")
        try:
            success = ingest_match(riot_match_id)
            if success:
                await msg.edit(content=f"✅ Successfully ingested `{riot_match_id}` — standings updated!")
            else:
                await msg.edit(content=f"⚠️ Match `{riot_match_id}` was already ingested or could not be found.")
        except Exception as e:
            await msg.edit(content=f"❌ Error: {str(e)[:200]}")

    @commands.command(name="scan")
    @is_admin()
    @in_allowed_channel()
    async def scan_cmd(self, ctx):
        """Scan all registered players for new games."""
        msg = await ctx.send("🔍 Scanning all players for new games...")
        try:
            scan_for_new_games()
            await msg.edit(content="✅ Scan complete — check logs for details.")
        except Exception as e:
            await msg.edit(content=f"❌ Error: {str(e)[:200]}")

    @commands.command(name="lastgame")
    @is_admin()
    @in_allowed_channel()
    async def lastgame_cmd(self, ctx):
        """Find and ingest the most recent game from any registered player."""
        msg = await ctx.send("🔍 Looking for the most recent game...")
        try:
            db = get_supabase()
            riot = RiotAPI(os.environ.get("RIOT_API_KEY", ""))
            puuids = get_registered_puuids(db)

            if not puuids:
                await msg.edit(content="⚠️ No registered players found.")
                return

            # Check first player's recent games (they all share the same custom game)
            match_ids = riot.get_match_ids_by_puuid(puuids[0], count=1, queue=0)

            if not match_ids:
                await msg.edit(content="⚠️ No recent custom games found.")
                return

            latest_id = match_ids[0]
            await msg.edit(content=f"⏳ Found `{latest_id}`, ingesting...")

            success = ingest_match(latest_id)
            if success:
                await msg.edit(content=f"✅ Ingested `{latest_id}` — standings updated!")
            else:
                await msg.edit(content=f"⚠️ `{latest_id}` was already ingested.")

        except Exception as e:
            await msg.edit(content=f"❌ Error: {str(e)[:200]}")

    # ── Cron Backup: Auto-scan every 10 minutes ──────────

    @tasks.loop(minutes=10)
    async def auto_scan(self):
        """Background task: scan for new games every 10 minutes."""
        try:
            scan_for_new_games()
        except Exception as e:
            print(f"Auto-scan error: {e}")

    @auto_scan.before_loop
    async def before_auto_scan(self):
        """Wait until bot is ready before starting auto-scan."""
        await self.bot.wait_until_ready()


# ── Standalone bot setup (if not adding to existing bot) ──

async def setup(bot):
    """Add this cog to an existing bot."""
    await bot.add_cog(MatchIngestion(bot))


if __name__ == "__main__":
    intents = discord.Intents.default()
    intents.message_content = True
    bot = commands.Bot(command_prefix="!", intents=intents)

    @bot.event
    async def on_ready():
        print(f"✅ Bot ready: {bot.user}")
        await bot.add_cog(MatchIngestion(bot))

    bot.run(os.environ["DISCORD_BOT_TOKEN"])
