import { useState } from "react";
import { Link } from "react-router-dom";
import { useWindowSize } from "../hooks/useWindowSize";
import { useLeagueData } from "../hooks/useLeagueData";
import { ScoreboardTicker } from "../components/home/ScoreboardTicker";
import { NavBar } from "../components/home/NavBar";
import { HeroArticle } from "../components/home/HeroArticle";
import { NewsFeed } from "../components/home/NewsFeed";
import { StandingsWidget } from "../components/home/StandingsWidget";
import { PlayerLeaders } from "../components/home/PlayerLeaders";
import { UpcomingSchedule } from "../components/home/UpcomingSchedule";
import { MobileBottomBar } from "../components/home/MobileBottomBar";
import { TwitterFeedSection } from "../components/home/TwitterFeed";
import { TwitchStreams } from "../components/home/TwitchStreams";
import { ScoresView } from "../components/views/ScoresView";
import { ScheduleView } from "../components/views/ScheduleView";
import { StandingsView } from "../components/views/StandingsView";
import { TeamsView } from "../components/views/TeamsView";
import { PlayersView } from "../components/views/PlayersView";

export default function Home() {
  const [tab, setTab] = useState("Home");
  const w = useWindowSize();
  const isMobile = w < 768;
  const isTablet = w >= 768 && w < 1024;
  const { teams, matches, standings, players, rosters, articles, splits, twitterFeeds, twitchEmbeds, loading } = useLeagueData();
  const parentDomain = window.location.hostname;
  const split = splits[0];
  const hero = articles.find(a => a.article_type === "hero");
  const rest = articles.filter(a => a.id !== hero?.id);

  return (
    <div className="bg-bg min-h-screen w-full text-text font-body" style={{ paddingBottom: isMobile ? 72 : 0 }}>
      {/* Season Bar */}
      <div className="bg-bg flex justify-between items-center border-b border-bg2" style={{ padding: isMobile ? "6px 12px" : "6px 20px" }}>
        <span className="text-text-muted font-heading tracking-wider" style={{ fontSize: isMobile ? 9 : 10 }}>
          {split ? `${split.seasons?.name || "SEASON"} · ${split.name}` : "PRESEASON"}
        </span>
        <span className="text-[#0a0a0a] bg-accent rounded font-heading font-semibold tracking-wide cursor-pointer" style={{ fontSize: isMobile ? 9 : 10, padding: "3px 10px" }}>
          JOIN CCS
        </span>
      </div>

      <ScoreboardTicker matches={matches} isMobile={isMobile} />
      <NavBar active={tab} setActive={setTab} isMobile={isMobile} />

      {loading ? (
        <div className="py-16 text-center text-text-subtle">Loading...</div>
      ) : !teams.length ? (
        <div className="max-w-[500px] mx-auto mt-16 text-center px-5">
          <span className="text-5xl block mb-4">⚔️</span>
          <h2 className="font-display text-[28px] text-text-bright tracking-widest mb-2">CCS IS BEING SET UP</h2>
          <p className="text-sm text-text-muted leading-relaxed mb-6">Teams and players haven't been added yet.</p>
          <Link to="/admin" className="inline-block bg-accent text-white rounded-md py-3 px-7 text-sm font-heading font-medium tracking-wider no-underline uppercase">
            Open Admin
          </Link>
        </div>
      ) : tab === "Stats" ? (
        <iframe
          src="/stats.html?embed=1"
          className="w-full border-0"
          style={{ height: "calc(100vh - 100px)", minHeight: 600 }}
          title="CCS Stats"
        />
      ) : (
        <div className="max-w-[1440px] mx-auto" style={{ padding: isMobile ? 12 : "24px 32px" }}>
          {tab === "Scores" ? <ScoresView matches={matches} isMobile={isMobile} />
          : tab === "Schedule" ? <ScheduleView matches={matches} isMobile={isMobile} />
          : tab === "Standings" ? <StandingsView standings={standings} teams={teams} isMobile={isMobile} />
          : tab === "Teams" ? <TeamsView teams={teams} standings={standings} rosters={rosters} isMobile={isMobile} />
          : tab === "Players" ? <PlayersView players={players} isMobile={isMobile} />
          : (
            <div className={`grid ${isMobile ? "grid-cols-1" : isTablet ? "grid-cols-1" : "grid-cols-[280px_1fr_280px]"}`} style={{ gap: isMobile ? 16 : 24 }}>
              {/* LEFT COLUMN — Articles + Twitter */}
              <div className="flex flex-col gap-5">
                {hero && <HeroArticle article={hero} isMobile={isMobile} />}
                {rest.length > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="font-display text-text-bright tracking-widest" style={{ fontSize: isMobile ? 16 : 18 }}>TOP STORIES</span>
                    </div>
                    <NewsFeed articles={rest} isMobile={isMobile} />
                  </>
                )}
                {!articles.length && (
                  <div className="bg-bg2 rounded-md border border-border p-6 text-center">
                    <span className="text-text-dim text-[13px]">No news yet. Publish articles from the admin dashboard.</span>
                  </div>
                )}
                <TwitterFeedSection feeds={twitterFeeds} />
              </div>

              {/* MIDDLE COLUMN — Welcome banner + Streams/VODs */}
              <div className="flex flex-col gap-5">
                {!hero && (
                  <div className="rounded-lg relative overflow-hidden" style={{ background: "linear-gradient(135deg, #6B21A8 0%, #1E1B4B 100%)", padding: isMobile ? "24px 16px" : "32px 24px" }}>
                    <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
                    <div className="relative">
                      <h2 className="font-display text-white tracking-wider mb-2" style={{ fontSize: isMobile ? 22 : 28 }}>WELCOME TO CCS</h2>
                      <p className="text-text-secondary text-sm">{teams.length} teams registered · {split?.name || "Season starting soon"}</p>
                    </div>
                  </div>
                )}
                <TwitchStreams embeds={twitchEmbeds} parentDomain={parentDomain} />
                <UpcomingSchedule matches={matches} isMobile={isMobile} />
              </div>

              {/* RIGHT COLUMN — Standings + Stats */}
              <div className="flex flex-col gap-5">
                <StandingsWidget standings={standings} teams={teams} />
                <PlayerLeaders players={players} isMobile={isMobile} />
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="border-t border-bg3 text-center mt-10" style={{ padding: isMobile ? "20px 12px" : "24px 20px" }}>
        <span className="font-display text-lg text-text-subtle tracking-widest">CCS</span>
        <div className="text-[10px] text-text-subtle mt-2">Amateur Esports · Community Driven</div>
      </footer>
      {isMobile && <MobileBottomBar active={tab} setActive={setTab} />}
    </div>
  );
}
