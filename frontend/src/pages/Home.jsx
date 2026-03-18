import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";

function useWindowSize() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return w;
}

function useLeagueData() {
  const [data, setData] = useState({ teams: [], matches: [], standings: [], players: [], rosters: [], articles: [], splits: [], games: [], loading: true });
  const load = useCallback(async () => {
    try {
      const [teams, matches, standings, articles, splits] = await Promise.all([
        db("teams", { query: "?select=*,divisions(name)&is_active=eq.true&order=name" }),
        db("matches", { query: "?select=*,team_blue:teams!matches_team_blue_id_fkey(id,name,abbreviation,color_primary,color_accent),team_red:teams!matches_team_red_id_fkey(id,name,abbreviation,color_primary,color_accent)&order=scheduled_at.desc.nullslast&limit=50" }),
        db("standings", { query: "?select=*,teams(id,name,abbreviation,color_primary,color_accent,divisions(name))&order=wins.desc" }),
        db("articles", { query: "?select=*&is_published=eq.true&order=published_at.desc.nullslast&limit=10" }),
        db("splits", { query: "?select=*,seasons(name)&is_active=eq.true&limit=1" }),
      ]);
      let players = [], rosters = [], games = [];
      try {
        const [roster, stats, gamesData] = await Promise.all([
          db("rosters", { query: "?select=*,players(id,display_name,riot_game_name,riot_tag_line),teams(id,name,abbreviation,color_primary,color_accent)&left_at=is.null" }),
          db("player_game_stats", { query: "?select=player_id,kills,deaths,assists,total_minions_killed,neutral_minions_killed,vision_score,total_damage_dealt_to_champions,gold_earned,win,is_mvp" }),
          db("games", { query: "?select=id,match_id,riot_match_id,blue_team_id,red_team_id,winner_team_id,game_duration,game_started_at&order=game_started_at.desc.nullslast&limit=50" }),
        ]);
        rosters = roster || [];
        games = gamesData || [];
        const agg = {};
        (stats || []).forEach(s => {
          if (!agg[s.player_id]) agg[s.player_id] = { gp: 0, kills: 0, deaths: 0, assists: 0, cs: 0, wins: 0, mvps: 0, damage: 0, gold: 0 };
          const a = agg[s.player_id]; a.gp++; a.kills += s.kills; a.deaths += s.deaths; a.assists += s.assists;
          a.cs += (s.total_minions_killed || 0) + (s.neutral_minions_killed || 0);
          a.damage += s.total_damage_dealt_to_champions || 0; a.gold += s.gold_earned || 0;
          if (s.win) a.wins++; if (s.is_mvp) a.mvps++;
        });
        players = rosters.filter(r => r.is_starter).map(r => {
          const s = agg[r.players?.id] || { gp: 0, kills: 0, deaths: 0, assists: 0, cs: 0, wins: 0, mvps: 0, damage: 0, gold: 0 };
          const kda = s.deaths === 0 ? (s.kills + s.assists) : ((s.kills + s.assists) / s.deaths);
          return { id: r.players?.id, name: r.players?.display_name || "Unknown", riot_name: r.players?.riot_game_name, riot_tag: r.players?.riot_tag_line, role: r.role, team: r.teams, is_captain: r.is_captain, gp: s.gp, kills: s.kills, deaths: s.deaths, assists: s.assists, kda: kda.toFixed(1), cs: s.gp > 0 ? Math.round(s.cs / s.gp) : 0, mvps: s.mvps, damage: s.gp > 0 ? Math.round(s.damage / s.gp) : 0, gold: s.gp > 0 ? Math.round(s.gold / s.gp) : 0, winRate: s.gp > 0 ? Math.round((s.wins / s.gp) * 100) : 0 };
        });
      } catch {}
      setData({ teams: teams || [], matches: matches || [], standings: standings || [], players, rosters, articles: articles || [], splits: splits || [], games: games || [], loading: false });
    } catch (e) { console.error(e); setData(d => ({ ...d, loading: false })); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return data;
}

function teamInitial(name) { return (name || "?").charAt(0).toUpperCase(); }
function timeAgo(d) { if (!d) return ""; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`; }
function fmtTime(d) { if (!d) return ""; const dt = new Date(d); const t = dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); const diff = Math.floor((dt - Date.now()) / 86400000); if (diff === 0) return `Today · ${t}`; if (diff === 1) return `Tomorrow · ${t}`; return dt.toLocaleDateString([], { month: "short", day: "numeric" }) + ` · ${t}`; }
function TeamBadge({ team, size = 24 }) { return <div style={{ width: size, height: size, borderRadius: size > 24 ? 6 : 4, background: `linear-gradient(135deg, ${team?.color_primary || "#333"}, ${team?.color_accent || "#555"})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.max(8, size * 0.4), color: "#fff", fontWeight: 700, fontFamily: "'Oswald', sans-serif", flexShrink: 0 }}>{teamInitial(team?.name)}</div>; }

function ScoreboardTicker({ matches, isMobile }) {
  if (!matches.length) return null;
  return (<div style={{ background: "var(--bg)", borderBottom: "1px solid var(--border3)", overflow: "hidden" }}>
    <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", padding: "0 8px" }}>
      {matches.map((m, i) => { const b = m.team_blue || {}, r = m.team_red || {}, isLive = m.status === "live", isFinal = m.status === "completed";
        return (<div key={m.id} style={{ display: "flex", flexDirection: "column", minWidth: isMobile ? 150 : 180, padding: isMobile ? "8px 12px" : "10px 16px", borderRight: i < matches.length - 1 ? "1px solid var(--border)" : "none", flexShrink: 0, cursor: "pointer" }}>
          {isLive ? <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red)", animation: "pulse 1.5s infinite", boxShadow: "0 0 6px var(--red)" }} /><span style={{ fontSize: 10, color: "var(--red)", fontWeight: 700, letterSpacing: 1, fontFamily: "'Bebas Neue', sans-serif" }}>LIVE</span></div>
            : <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4, letterSpacing: 0.5, fontFamily: "'Bebas Neue', sans-serif" }}>{isFinal ? "FINAL" : fmtTime(m.scheduled_at)}</span>}
          {[{ t: b, score: m.score_blue, win: isFinal && m.winner_team_id === b.id }, { t: r, score: m.score_red, win: isFinal && m.winner_team_id === r.id }].map((row, ri) => (
            <div key={ri} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginTop: ri ? 2 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }}><TeamBadge team={row.t} size={isMobile ? 18 : 20} /><span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: "var(--text)", fontFamily: "'Oswald', sans-serif" }}>{row.t.abbreviation || "TBD"}</span></div>
              <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: row.win || isLive ? "var(--text-bright)" : "var(--text-muted)", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>{row.score}</span>
            </div>))}
        </div>); })}
    </div>
  </div>);
}

function NavBar({ active, setActive, isMobile }) {
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState(() => document.documentElement.getAttribute("data-theme") || localStorage.getItem("theme") || "dark");
  const toggleTheme = () => { const next = theme === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", next); localStorage.setItem("theme", next); setThemeState(next); };
  const tabs = ["Home", "Scores", "Schedule", "Standings", "Stats", "Teams", "Players"];
  if (isMobile) return (<nav style={{ background: "var(--bg2)", borderBottom: "2px solid var(--accent)", position: "relative", zIndex: 150 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0" }}><span style={{ fontSize: 20 }}>⚔️</span><span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-bright)", letterSpacing: 2 }}>CCS<span style={{ color: "var(--accent)" }}>LEAGUE</span></span></div>
      <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", cursor: "pointer", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        {[0, 1, 2].map(idx => <span key={idx} style={{ display: "block", width: 22, height: 2, background: open ? "var(--accent)" : "var(--text-secondary)", borderRadius: 1, transition: "all 0.2s", transform: open ? (idx === 0 ? "rotate(45deg) translate(4px,4px)" : idx === 2 ? "rotate(-45deg) translate(4px,-4px)" : "scaleX(0)") : "none" }} />)}
      </button>
    </div>
    {open && <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg2)", borderBottom: "2px solid var(--accent)", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}>
      {tabs.map(t => t === "Stats" ? <a key={t} href="/stats.html" style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: "14px 20px", color: "var(--text-secondary)", fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 400, letterSpacing: 1, textTransform: "uppercase", borderLeft: "3px solid transparent", textDecoration: "none" }}>Stats</a> : <button key={t} onClick={() => { setActive(t); setOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: active === t ? "var(--bg-input)" : "transparent", border: "none", cursor: "pointer", padding: "14px 20px", color: active === t ? "var(--text-bright)" : "var(--text-secondary)", fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: active === t ? 700 : 400, letterSpacing: 1, textTransform: "uppercase", borderLeft: active === t ? "3px solid var(--accent)" : "3px solid transparent" }}>{t}</button>)}
      <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)" }}><button onClick={toggleTheme} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>{theme === "dark" ? "\u{1F319}" : "\u{2600}\u{FE0F}"}</button></div>
    </div>}
  </nav>);
  return (<nav style={{ background: "var(--bg2)", borderBottom: "2px solid var(--accent)", display: "flex", alignItems: "center", padding: "0 20px", overflowX: "auto", scrollbarWidth: "none" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 24, padding: "10px 0", minWidth: "fit-content" }}><span style={{ fontSize: 22 }}>⚔️</span><span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-bright)", letterSpacing: 2 }}>CCS<span style={{ color: "var(--accent)" }}>LEAGUE</span></span></div>
    {tabs.map(t => t === "Stats" ? <a key={t} href="/stats.html" style={{ background: "none", border: "none", cursor: "pointer", padding: "12px 14px", color: "var(--text-secondary)", fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 400, letterSpacing: 0.8, borderBottom: "2px solid transparent", whiteSpace: "nowrap", textTransform: "uppercase", textDecoration: "none" }}>Stats</a> : <button key={t} onClick={() => setActive(t)} style={{ background: "none", border: "none", cursor: "pointer", padding: "12px 14px", color: active === t ? "var(--text-bright)" : "var(--text-secondary)", fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: active === t ? 700 : 400, letterSpacing: 0.8, borderBottom: active === t ? "2px solid var(--accent)" : "2px solid transparent", whiteSpace: "nowrap", textTransform: "uppercase" }}>{t}</button>)}
    <button onClick={toggleTheme} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", fontSize: 16, cursor: "pointer", lineHeight: 1, marginLeft: "auto" }}>{theme === "dark" ? "\u{1F319}" : "\u{2600}\u{FE0F}"}</button>
    <Link to="/admin" style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "'Oswald', sans-serif", textDecoration: "none", letterSpacing: 0.5, padding: "12px 8px" }}>ADMIN</Link>
  </nav>);
}

function HeroArticle({ article, isMobile }) {
  return (<div style={{ background: article.image_url || "linear-gradient(135deg, #6B21A8 0%, #1E1B4B 100%)", borderRadius: isMobile ? 6 : 8, position: "relative", overflow: "hidden", cursor: "pointer", minHeight: isMobile ? 200 : 280, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)" }} />
    <div style={{ position: "relative", padding: isMobile ? "20px 16px" : "32px 28px", zIndex: 2 }}>
      {article.tag && <span style={{ display: "inline-block", background: "var(--accent)", color: "#fff", fontSize: isMobile ? 9 : 10, fontWeight: 800, padding: "3px 8px", borderRadius: 3, letterSpacing: 1.2, fontFamily: "'Bebas Neue', sans-serif", marginBottom: 8 }}>{article.tag}</span>}
      <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile ? 22 : 30, fontWeight: 400, color: "#fff", margin: "0 0 6px", lineHeight: 1.1 }}>{article.title}</h2>
      {article.subtitle && <p style={{ fontSize: isMobile ? 12 : 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{article.subtitle}</p>}
      <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, display: "block" }}>{article.author} · {timeAgo(article.published_at)}</span>
    </div>
  </div>);
}

function NewsFeed({ articles, isMobile }) {
  const features = articles.filter(a => a.article_type === "feature").slice(0, 2);
  const items = articles.filter(a => !["hero", "feature"].includes(a.article_type)).slice(0, 5);
  if (!articles.length) return <div style={{ padding: 30, textAlign: "center", color: "var(--text-subtle)", fontSize: 13 }}>No articles yet.</div>;
  return (<div>
    {features.length > 0 && <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
      {features.map(f => <div key={f.id} style={{ background: "var(--bg3)", borderRadius: 6, padding: isMobile ? "14px 12px" : "18px 16px", cursor: "pointer", borderLeft: "3px solid var(--accent)" }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "var(--accent)", letterSpacing: 1, fontFamily: "'Bebas Neue', sans-serif" }}>{f.tag}</span>
        <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: isMobile ? 14 : 15, fontWeight: 600, color: "var(--text)", margin: "6px 0 4px", lineHeight: 1.3 }}>{f.title}</h3>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.4 }}>{f.subtitle}</p>
        <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, display: "block" }}>{timeAgo(f.published_at)}</span>
      </div>)}
    </div>}
    {items.map((n, i) => <div key={n.id} style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 12, padding: "12px 0", borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: "var(--accent)", letterSpacing: 1, fontFamily: "'Bebas Neue', sans-serif", minWidth: 80 }}>{n.tag}</span>
      <span style={{ fontSize: 13, color: "var(--text)", flex: 1 }}>{n.title}</span>
      {!isMobile && <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{timeAgo(n.published_at)}</span>}
    </div>)}
  </div>);
}

function StandingsWidget({ standings, teams }) {
  const divs = [...new Set(standings.map(s => s.teams?.divisions?.name).filter(Boolean))];
  const [div, setDiv] = useState(divs[0] || "All");
  const filtered = div === "All" ? standings : standings.filter(s => s.teams?.divisions?.name === div);
  const sorted = [...filtered].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
  if (!standings.length && teams.length) return (<div style={{ background: "var(--bg2)", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
    <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}><span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: "var(--text-bright)", letterSpacing: 1.5 }}>TEAMS</span></div>
    {teams.map((t, i) => <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: i < teams.length - 1 ? "1px solid var(--bg2)" : "none" }}>
      <TeamBadge team={t} size={28} /><span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{t.name}</span><span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "monospace", marginLeft: "auto" }}>{t.abbreviation}</span>
    </div>)}
  </div>);
  if (!standings.length) return null;
  return (<div style={{ background: "var(--bg2)", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
    {divs.length > 1 && <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>{divs.map(d => <button key={d} onClick={() => setDiv(d)} style={{ flex: 1, background: div === d ? "var(--bg-input)" : "transparent", border: "none", color: div === d ? "var(--text-bright)" : "var(--text-muted)", padding: "10px", cursor: "pointer", fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1.5, borderBottom: div === d ? "2px solid var(--accent)" : "2px solid transparent" }}>{d}</button>)}</div>}
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr><th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", fontWeight: 400, letterSpacing: 1, borderBottom: "1px solid var(--border)" }}>TEAM</th><th style={{ padding: "8px 8px", textAlign: "center", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", fontWeight: 400, borderBottom: "1px solid var(--border)" }}>W-L</th><th style={{ padding: "8px 8px", textAlign: "center", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", fontWeight: 400, borderBottom: "1px solid var(--border)" }}>STRK</th></tr></thead>
      <tbody>{sorted.map((s, i) => { const t = s.teams || {}; return (<tr key={s.id} style={{ cursor: "pointer" }}>
        <td style={{ padding: "10px 12px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "monospace", minWidth: 14, textAlign: "right" }}>{i + 1}</span><TeamBadge team={t} /><span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{t.name}</span></div></td>
        <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: 13, color: "var(--text-secondary)" }}>{s.wins}-{s.losses}</td>
        <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: 12, color: (s.streak || "").startsWith("W") ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{s.streak || "—"}</td>
      </tr>); })}</tbody>
    </table>
  </div>);
}

function PlayerLeaders({ players, isMobile }) {
  const [stat, setStat] = useState("kda");
  const labels = { kda: "KDA", kills: "Kills", assists: "Assists", cs: "CS/Game", mvps: "MVPs" };
  if (!players.length) return null;
  const sorted = [...players].sort((a, b) => stat === "kda" ? parseFloat(b.kda) - parseFloat(a.kda) : (b[stat] || 0) - (a[stat] || 0)).slice(0, 5);
  return (<div style={{ background: "var(--bg2)", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
    <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: "var(--text-bright)", letterSpacing: 1.5 }}>STAT LEADERS</span>
      <select value={stat} onChange={e => setStat(e.target.value)} style={{ background: "var(--bg-input)", border: "1px solid var(--text-subtle)", color: "var(--text)", padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "'Oswald', sans-serif", cursor: "pointer" }}>{Object.entries(labels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
    </div>
    {sorted.map((p, i) => <div key={p.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "10px 12px" : "10px 14px", borderBottom: i < sorted.length - 1 ? "1px solid var(--bg3)" : "none" }}>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: i === 0 ? "var(--accent)" : "var(--text-subtle)", minWidth: 24, textAlign: "center" }}>{i + 1}</span>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: p.team ? `linear-gradient(135deg, ${p.team.color_primary || "#333"}, ${p.team.color_accent || "#555"})` : "var(--text-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700, fontFamily: "'Oswald', sans-serif", flexShrink: 0 }}>{teamInitial(p.team?.name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div><div style={{ fontSize: 10, color: "var(--text-muted)" }}>{p.team?.name || "FA"} · {p.role || "—"}</div></div>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: i === 0 ? "var(--accent)" : "var(--text-bright)", letterSpacing: 1 }}>{stat === "kda" ? p.kda : p[stat]}</span>
    </div>)}
  </div>);
}

function UpcomingSchedule({ matches, isMobile }) {
  const upcoming = matches.filter(m => m.status === "scheduled").slice(0, 4);
  if (!upcoming.length) return null;
  return (<div style={{ background: "var(--bg2)", borderRadius: 6, border: "1px solid var(--border)", overflow: "hidden" }}>
    <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}><span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: "var(--text-bright)", letterSpacing: 1.5 }}>UPCOMING</span></div>
    {upcoming.map((m, i) => { const b = m.team_blue || {}, r = m.team_red || {}; return (<div key={m.id} style={{ padding: "12px 14px", borderBottom: i < upcoming.length - 1 ? "1px solid var(--bg3)" : "none" }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, fontFamily: "'Oswald', sans-serif", letterSpacing: 0.5 }}>{fmtTime(m.scheduled_at)}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: isMobile ? 10 : 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}><span style={{ fontFamily: "'Oswald', sans-serif", fontSize: isMobile ? 12 : 13, color: "var(--text)", fontWeight: 500 }}>{isMobile ? b.abbreviation : b.name}</span><TeamBadge team={b} /></div>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "var(--text-dim)", letterSpacing: 2, padding: "2px 8px", background: "var(--bg-input)", borderRadius: 4 }}>VS</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}><TeamBadge team={r} /><span style={{ fontFamily: "'Oswald', sans-serif", fontSize: isMobile ? 12 : 13, color: "var(--text)", fontWeight: 500 }}>{isMobile ? r.abbreviation : r.name}</span></div>
      </div>
    </div>); })}
  </div>);
}

function QuickLinks({ isMobile }) {
  const links = [{ label: "Power Rankings", icon: "📊" }, { label: "Scouting", icon: "🔍" }, { label: "Meta", icon: "🎮" }, { label: "Fantasy", icon: "🏆" }, { label: "Discord", icon: "💬" }, { label: "Admin", icon: "⚙️", to: "/admin" }];
  if (isMobile) return (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>{links.map(l => { const c = <div style={{ background: "var(--bg2)", borderRadius: 6, border: "1px solid var(--border)", padding: "14px 8px", textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}><span style={{ fontSize: 20 }}>{l.icon}</span><span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 10, color: "var(--text)", letterSpacing: 0.5 }}>{l.label}</span></div>; return l.to ? <Link key={l.label} to={l.to} style={{ textDecoration: "none" }}>{c}</Link> : <div key={l.label}>{c}</div>; })}</div>);
  return (<div style={{ background: "var(--bg2)", borderRadius: 6, border: "1px solid var(--border)", overflow: "hidden" }}>
    <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}><span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: "var(--text-bright)", letterSpacing: 1.5 }}>QUICK LINKS</span></div>
    {links.map((l, i) => { const c = <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: i < links.length - 1 ? "1px solid var(--bg3)" : "none", cursor: "pointer" }}><span style={{ fontSize: 16 }}>{l.icon}</span><span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, color: "var(--text)" }}>{l.label}</span></div>; return l.to ? <Link key={l.label} to={l.to} style={{ textDecoration: "none", color: "inherit" }}>{c}</Link> : <div key={l.label}>{c}</div>; })}
  </div>);
}

function MobileBottomBar({ active, setActive }) {
  return (<div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(12px)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-around", alignItems: "center", padding: "6px 0 env(safe-area-inset-bottom, 8px)", zIndex: 200 }}>
    {[{ k: "Home", i: "🏠" }, { k: "Scores", i: "📋" }, { k: "Standings", i: "🏆" }, { k: "Stats", i: "📊" }, { k: "Teams", i: "⚔️" }].map(t => <button key={t.k} onClick={() => setActive(t.k)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 12px", minWidth: 56 }}>
      <span style={{ fontSize: 18, filter: active === t.k ? "none" : "grayscale(1) opacity(0.5)" }}>{t.i}</span>
      <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 9, letterSpacing: 0.5, color: active === t.k ? "var(--accent)" : "var(--text-muted)", fontWeight: active === t.k ? 700 : 400, textTransform: "uppercase" }}>{t.k}</span>
    </button>)}
  </div>);
}

// ══════════════════════════════════════════════════════════
// TAB VIEWS
// ══════════════════════════════════════════════════════════

function ScoresView({ matches, isMobile }) {
  const completed = matches.filter(m => m.status === "completed");
  if (!completed.length) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>No completed matches yet.</div>;
  return (<div style={{ maxWidth: 800, margin: "0 auto" }}>
    <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-bright)", letterSpacing: 2, marginBottom: 16 }}>SCORES</h2>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {completed.map(m => {
        const b = m.team_blue || {}, r = m.team_red || {};
        const bWin = m.winner_team_id === b.id, rWin = m.winner_team_id === r.id;
        return (<div key={m.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: isMobile ? "14px 12px" : "16px 20px" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 10, fontFamily: "'Oswald', sans-serif", letterSpacing: 0.5 }}>FINAL{m.completed_at ? ` · ${new Date(m.completed_at).toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: isMobile ? 12 : 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "flex-end" }}>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: isMobile ? 14 : 16, color: bWin ? "var(--text-bright)" : "var(--text-muted)", fontWeight: bWin ? 700 : 400 }}>{isMobile ? b.abbreviation : b.name}</span>
              <TeamBadge team={b} size={isMobile ? 28 : 36} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 60, justifyContent: "center" }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile ? 22 : 28, color: bWin ? "var(--text-bright)" : "var(--text-muted)" }}>{m.score_blue ?? 0}</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: "var(--text-subtle)" }}>-</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile ? 22 : 28, color: rWin ? "var(--text-bright)" : "var(--text-muted)" }}>{m.score_red ?? 0}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <TeamBadge team={r} size={isMobile ? 28 : 36} />
              <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: isMobile ? 14 : 16, color: rWin ? "var(--text-bright)" : "var(--text-muted)", fontWeight: rWin ? 700 : 400 }}>{isMobile ? r.abbreviation : r.name}</span>
            </div>
          </div>
        </div>);
      })}
    </div>
  </div>);
}

function ScheduleView({ matches, isMobile }) {
  const upcoming = matches.filter(m => m.status === "scheduled");
  if (!upcoming.length) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>No upcoming matches scheduled.</div>;
  return (<div style={{ maxWidth: 800, margin: "0 auto" }}>
    <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-bright)", letterSpacing: 2, marginBottom: 16 }}>SCHEDULE</h2>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {upcoming.map(m => {
        const b = m.team_blue || {}, r = m.team_red || {};
        return (<div key={m.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: isMobile ? "14px 12px" : "16px 20px" }}>
          <div style={{ fontSize: 10, color: "var(--accent)", marginBottom: 10, fontFamily: "'Oswald', sans-serif", letterSpacing: 0.5, fontWeight: 600 }}>{fmtTime(m.scheduled_at)}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: isMobile ? 12 : 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "flex-end" }}>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: isMobile ? 14 : 16, color: "var(--text)", fontWeight: 500 }}>{isMobile ? b.abbreviation : b.name}</span>
              <TeamBadge team={b} size={isMobile ? 28 : 36} />
            </div>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: "var(--text-dim)", letterSpacing: 2, padding: "4px 12px", background: "var(--bg-input)", borderRadius: 4 }}>VS</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <TeamBadge team={r} size={isMobile ? 28 : 36} />
              <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: isMobile ? 14 : 16, color: "var(--text)", fontWeight: 500 }}>{isMobile ? r.abbreviation : r.name}</span>
            </div>
          </div>
        </div>);
      })}
    </div>
  </div>);
}

function StandingsView({ standings, teams, isMobile }) {
  const divs = [...new Set(standings.map(s => s.teams?.divisions?.name).filter(Boolean))];
  const [div, setDiv] = useState(divs[0] || "All");
  const filtered = div === "All" ? standings : standings.filter(s => s.teams?.divisions?.name === div);
  const sorted = [...filtered].sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  if (!standings.length) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>No standings data yet. Ingest some matches first.</div>;
  return (<div style={{ maxWidth: 900, margin: "0 auto" }}>
    <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-bright)", letterSpacing: 2, marginBottom: 16 }}>STANDINGS</h2>
    {divs.length > 1 && <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid var(--accent)" }}>
      {["All", ...divs].map(d => <button key={d} onClick={() => setDiv(d)} style={{ background: div === d ? "var(--bg-input)" : "transparent", border: "none", color: div === d ? "var(--text-bright)" : "var(--text-muted)", padding: "10px 18px", cursor: "pointer", fontFamily: "'Oswald', sans-serif", fontSize: 13, letterSpacing: 1, textTransform: "uppercase", borderBottom: div === d ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -2 }}>{d}</button>)}
    </div>}
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", fontWeight: 400, letterSpacing: 1, borderBottom: "1px solid var(--border)" }}>#</th>
          <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", fontWeight: 400, letterSpacing: 1, borderBottom: "1px solid var(--border)" }}>TEAM</th>
          <th style={{ padding: "12px 14px", textAlign: "center", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", fontWeight: 400, letterSpacing: 1, borderBottom: "1px solid var(--border)" }}>W</th>
          <th style={{ padding: "12px 14px", textAlign: "center", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", fontWeight: 400, letterSpacing: 1, borderBottom: "1px solid var(--border)" }}>L</th>
          <th style={{ padding: "12px 14px", textAlign: "center", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", fontWeight: 400, letterSpacing: 1, borderBottom: "1px solid var(--border)" }}>WIN%</th>
          <th style={{ padding: "12px 14px", textAlign: "center", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", fontWeight: 400, letterSpacing: 1, borderBottom: "1px solid var(--border)" }}>STREAK</th>
          {!isMobile && <th style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", fontWeight: 400, letterSpacing: 1, borderBottom: "1px solid var(--border)" }}>DIVISION</th>}
        </tr></thead>
        <tbody>{sorted.map((s, i) => {
          const t = s.teams || {};
          const total = s.wins + s.losses;
          const pct = total > 0 ? Math.round((s.wins / total) * 100) : 0;
          return (<tr key={s.id} style={{ borderBottom: "1px solid var(--bg3)" }}>
            <td style={{ padding: "12px 14px", fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: i < 3 ? "var(--accent)" : "var(--text-dim)" }}>{i + 1}</td>
            <td style={{ padding: "12px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><TeamBadge team={t} size={28} /><div><span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{t.name}</span><span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "monospace", marginLeft: 8 }}>{t.abbreviation}</span></div></div></td>
            <td style={{ padding: "12px 14px", textAlign: "center", fontFamily: "monospace", fontSize: 14, color: "var(--green)", fontWeight: 700 }}>{s.wins}</td>
            <td style={{ padding: "12px 14px", textAlign: "center", fontFamily: "monospace", fontSize: 14, color: "var(--red)", fontWeight: 700 }}>{s.losses}</td>
            <td style={{ padding: "12px 14px", textAlign: "center", fontFamily: "monospace", fontSize: 13, color: "var(--text-secondary)" }}>{pct}%</td>
            <td style={{ padding: "12px 14px", textAlign: "center", fontFamily: "monospace", fontSize: 13, color: (s.streak || "").startsWith("W") ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{s.streak || "—"}</td>
            {!isMobile && <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-muted)" }}>{t.divisions?.name || "—"}</td>}
          </tr>);
        })}</tbody>
      </table>
    </div>
  </div>);
}

function StatsView({ players, isMobile }) {
  const statOptions = [
    { key: "kda", label: "KDA", format: v => parseFloat(v).toFixed(2) },
    { key: "kills", label: "Kills/G", format: v => parseFloat(v).toFixed(1), perGame: true },
    { key: "deaths", label: "Deaths/G", format: v => parseFloat(v).toFixed(1), perGame: true },
    { key: "assists", label: "Assists/G", format: v => parseFloat(v).toFixed(1), perGame: true },
    { key: "cs", label: "CS/G", format: v => parseFloat(v).toFixed(1) },
    { key: "damage", label: "DMG/G", format: v => Math.round(v).toLocaleString() },
    { key: "gold", label: "Gold/G", format: v => Math.round(v).toLocaleString() },
    { key: "winRate", label: "Win Rate", format: v => `${parseFloat(v).toFixed(1)}%` },
  ];
  const [selectedStat, setSelectedStat] = useState("kda");
  const [roleFilter, setRoleFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [tableSortBy, setTableSortBy] = useState("kda");
  const [tableSortDir, setTableSortDir] = useState(-1);
  const [barsVisible, setBarsVisible] = useState(false);

  const roles = ["All", "Top", "Jng", "Mid", "ADC", "Sup"];

  const getStatValue = (p, key) => {
    const opt = statOptions.find(o => o.key === key);
    if (!opt) return 0;
    if (opt.perGame && p.gp > 0) return (p[key] || 0) / p.gp;
    return parseFloat(p[key]) || 0;
  };

  const formatStatValue = (p, key) => {
    const opt = statOptions.find(o => o.key === key);
    if (!opt) return p[key];
    if (opt.perGame && p.gp > 0) return opt.format((p[key] || 0) / p.gp);
    return opt.format(p[key] || 0);
  };

  const filteredPlayers = players.filter(p => {
    if (roleFilter !== "All" && (p.role || "").toLowerCase() !== roleFilter.toLowerCase()) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.riot_name || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const leaderboardPlayers = [...filteredPlayers]
    .filter(p => p.gp > 0)
    .sort((a, b) => getStatValue(b, selectedStat) - getStatValue(a, selectedStat))
    .slice(0, 10);

  const maxStatValue = leaderboardPlayers.length > 0 ? getStatValue(leaderboardPlayers[0], selectedStat) : 1;

  const handleTableSort = (col) => {
    if (tableSortBy === col) setTableSortDir(d => d * -1);
    else { setTableSortBy(col); setTableSortDir(-1); }
  };

  const tableSorted = [...filteredPlayers].sort((a, b) => {
    const av = getStatValue(a, tableSortBy);
    const bv = getStatValue(b, tableSortBy);
    return (bv - av) * tableSortDir;
  });

  // Trigger bar animation on stat/filter change
  useState(() => { setBarsVisible(false); const t = setTimeout(() => setBarsVisible(true), 50); return () => clearTimeout(t); });
  const handleStatChange = (key) => { setBarsVisible(false); setSelectedStat(key); setTimeout(() => setBarsVisible(true), 50); };
  const handleRoleChange = (role) => { setBarsVisible(false); setRoleFilter(role); setTimeout(() => setBarsVisible(true), 50); };

  if (!players.length) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>No player stats yet. Ingest some matches first.</div>;

  const currentStatLabel = statOptions.find(o => o.key === selectedStat)?.label || selectedStat;
  const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32"];

  const thStyle = (col) => ({
    padding: isMobile ? "10px 6px" : "12px 10px", textAlign: "center", fontSize: 10,
    color: tableSortBy === col ? "var(--accent)" : "var(--text-muted)", fontFamily: "'Oswald', sans-serif",
    fontWeight: tableSortBy === col ? 700 : 400, letterSpacing: 1,
    borderBottom: "1px solid var(--border)", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
  });
  const tdStyle = { padding: isMobile ? "10px 6px" : "10px 10px", textAlign: "center", fontFamily: "monospace", fontSize: 13, color: "var(--text-secondary)" };

  const tableCols = isMobile
    ? [["gp", "GP"], ["kda", "KDA"], ["kills", "K"], ["deaths", "D"], ["assists", "A"]]
    : [["gp", "GP"], ["kills", "K"], ["deaths", "D"], ["assists", "A"], ["kda", "KDA"], ["cs", "CS/G"], ["damage", "DMG/G"], ["gold", "GOLD/G"], ["winRate", "WIN%"], ["mvps", "MVP"]];

  return (<div style={{ maxWidth: 1100, margin: "0 auto" }}>
    <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-bright)", letterSpacing: 2, marginBottom: 16 }}>PLAYER STATS</h2>

    {/* Controls Row: Stat Selector, Role Filter, Search */}
    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
      <select
        value={selectedStat}
        onChange={e => handleStatChange(e.target.value)}
        style={{ background: "var(--bg-input)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "10px 14px", fontSize: 13, fontFamily: "'Oswald', sans-serif", cursor: "pointer", letterSpacing: 0.5 }}
      >
        {statOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>

      <div style={{ display: "flex", gap: 4 }}>
        {roles.map(role => (
          <button
            key={role}
            onClick={() => handleRoleChange(role)}
            style={{
              background: roleFilter === role ? "var(--accent)" : "var(--bg-input)",
              border: roleFilter === role ? "1px solid var(--accent)" : "1px solid var(--border3)",
              borderRadius: 4, color: roleFilter === role ? "var(--text-bright)" : "var(--text-secondary)",
              padding: isMobile ? "8px 10px" : "8px 14px", fontSize: 11,
              fontFamily: "'Oswald', sans-serif", cursor: "pointer", letterSpacing: 0.5,
              fontWeight: roleFilter === role ? 700 : 400, transition: "all 0.15s ease",
            }}
          >{role === "All" ? "ALL" : role.toUpperCase()}</button>
        ))}
      </div>

      <input
        placeholder="Search players..."
        value={search}
        onChange={e => { setSearch(e.target.value); setBarsVisible(false); setTimeout(() => setBarsVisible(true), 50); }}
        style={{ background: "var(--bg-input)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "10px 14px", fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", flex: 1, minWidth: 140, outline: "none" }}
      />
    </div>

    {/* Top 10 Visual Leaderboard */}
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: isMobile ? "16px 12px" : "24px 24px", marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: "var(--text-bright)", letterSpacing: 2, margin: 0 }}>
          TOP 10 — {currentStatLabel.toUpperCase()}
        </h3>
        {roleFilter !== "All" && (
          <span style={{ fontSize: 10, color: "var(--accent)", fontFamily: "'Oswald', sans-serif", letterSpacing: 1 }}>{roleFilter.toUpperCase()} ONLY</span>
        )}
      </div>

      {leaderboardPlayers.length === 0
        ? <div style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>No qualifying players found.</div>
        : leaderboardPlayers.map((p, i) => {
          const val = getStatValue(p, selectedStat);
          const barPct = maxStatValue > 0 ? (val / maxStatValue) * 100 : 0;
          const teamColor = p.team?.color_primary || "#555";
          const isTopThree = i < 3;

          return (
            <div key={p.id || i} style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, marginBottom: i < leaderboardPlayers.length - 1 ? 8 : 0, padding: "6px 0" }}>
              {/* Rank */}
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: isTopThree ? 18 : 14,
                color: isTopThree ? rankColors[i] : "var(--text-muted)",
                minWidth: 24, textAlign: "right", fontWeight: 700,
                textShadow: isTopThree ? `0 0 8px ${rankColors[i]}44` : "none",
              }}>{i + 1}</span>

              {/* Player Info */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: isMobile ? 90 : 140, flexShrink: 0 }}>
                <TeamBadge team={p.team} size={isMobile ? 18 : 22} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Oswald', sans-serif", fontSize: isTopThree ? 14 : 13,
                    color: isTopThree ? "var(--text-bright)" : "var(--text)", fontWeight: isTopThree ? 700 : 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{p.name}</div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", letterSpacing: 0.5 }}>
                    {p.team?.abbreviation || "FA"}{!isMobile && ` · ${(p.role || "—").toUpperCase()}`}
                  </div>
                </div>
              </div>

              {/* Bar */}
              <div style={{ flex: 1, height: isTopThree ? 26 : 22, background: "var(--bg)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  background: `linear-gradient(90deg, ${teamColor}, ${teamColor}88)`,
                  width: barsVisible ? `${barPct}%` : "0%",
                  transition: "width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  boxShadow: isTopThree ? `0 0 12px ${teamColor}44` : "none",
                  opacity: isTopThree ? 1 : 0.8,
                }} />
              </div>

              {/* Value */}
              <span style={{
                fontFamily: "monospace", fontSize: isTopThree ? 15 : 13,
                color: isTopThree ? "var(--text-bright)" : "var(--text-secondary)", fontWeight: isTopThree ? 700 : 400,
                minWidth: isMobile ? 44 : 56, textAlign: "right",
              }}>{formatStatValue(p, selectedStat)}</span>
            </div>
          );
        })}
    </div>

    {/* Full Stats Table */}
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 400 : 700 }}>
        <thead><tr>
          <th style={{ ...thStyle("name"), textAlign: "left", cursor: "default", color: "var(--text-muted)" }}>PLAYER</th>
          {!isMobile && <th style={{ ...thStyle("team"), textAlign: "left", cursor: "default", color: "var(--text-muted)" }}>TEAM</th>}
          {!isMobile && <th style={{ ...thStyle("role"), cursor: "default", color: "var(--text-muted)" }}>ROLE</th>}
          {tableCols.map(([k, label]) => <th key={k} style={thStyle(k)} onClick={() => handleTableSort(k)}>{label}{tableSortBy === k ? (tableSortDir === -1 ? " \u25BC" : " \u25B2") : ""}</th>)}
        </tr></thead>
        <tbody>{tableSorted.map((p, i) => (
          <tr key={p.id || i} style={{ borderBottom: "1px solid var(--bg3)" }}>
            <td style={{ padding: isMobile ? "10px 6px" : "10px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!isMobile && <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "monospace", minWidth: 18, textAlign: "right" }}>{i + 1}</span>}
                <TeamBadge team={p.team} size={22} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  {isMobile && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{p.team?.abbreviation || "FA"} · {(p.role || "—").toUpperCase()}</div>}
                </div>
              </div>
            </td>
            {!isMobile && <td style={{ padding: "10px 10px", fontSize: 12, color: "var(--text-secondary)" }}><span style={{ fontFamily: "'Oswald', sans-serif" }}>{p.team?.abbreviation || "FA"}</span></td>}
            {!isMobile && <td style={{ padding: "10px 10px", fontSize: 11, color: "var(--text-muted)", textAlign: "center", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>{p.role || "—"}</td>}
            {tableCols.map(([k]) => <td key={k} style={{ ...tdStyle, color: k === "kda" ? "var(--text-bright)" : k === "winRate" ? (p.winRate >= 50 ? "var(--green)" : "var(--red)") : "var(--text-secondary)", fontWeight: k === "kda" ? 700 : 400 }}>{k === "winRate" ? `${p[k]}%` : k === "damage" || k === "gold" ? (p[k] || 0).toLocaleString() : p[k]}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  </div>);
}

function TeamsView({ teams, standings, rosters, isMobile }) {
  const standingsMap = {};
  standings.forEach(s => { if (s.teams?.id) standingsMap[s.teams.id] = s; });

  return (<div style={{ maxWidth: 1000, margin: "0 auto" }}>
    <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-bright)", letterSpacing: 2, marginBottom: 16 }}>TEAMS</h2>
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
      {teams.map(t => {
        const record = standingsMap[t.id];
        const teamRoster = rosters.filter(r => r.teams?.id === t.id);
        return (<div key={t.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: `linear-gradient(135deg, ${t.color_primary || "#333"}, ${t.color_accent || "#555"})`, padding: "20px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", fontWeight: 700, fontFamily: "'Oswald', sans-serif" }}>{teamInitial(t.name)}</div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "#fff", letterSpacing: 1.5 }}>{t.name}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>{t.abbreviation}</span>
                {t.divisions?.name && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>· {t.divisions.name}</span>}
                {record && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", fontFamily: "monospace", fontWeight: 700 }}>({record.wins}W-{record.losses}L)</span>}
              </div>
            </div>
          </div>
          <div style={{ padding: "12px 18px" }}>
            {teamRoster.length === 0 ? <div style={{ padding: "8px 0", fontSize: 12, color: "var(--text-dim)" }}>No roster set</div>
            : <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>{teamRoster.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: i < teamRoster.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "8px 0", fontFamily: "'Oswald', sans-serif", fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
                      {r.players?.display_name || "Unknown"}
                      {r.is_captain && <span style={{ fontSize: 9, color: "#f59e0b", marginLeft: 6, fontWeight: 700, letterSpacing: 0.5 }}>C</span>}
                    </td>
                    <td style={{ padding: "8px 0", fontSize: 11, color: "var(--text-muted)", textAlign: "right", fontFamily: "'Oswald', sans-serif", textTransform: "uppercase", letterSpacing: 0.5 }}>{r.role || "—"}</td>
                    <td style={{ padding: "8px 0", paddingLeft: 12, fontSize: 10, color: "var(--text-dim)", textAlign: "right" }}>
                      {r.is_starter ? <span style={{ color: "var(--green)" }}>Starter</span> : <span style={{ color: "var(--red)" }}>Sub</span>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>}
          </div>
        </div>);
      })}
    </div>
  </div>);
}

function PlayersView({ players, isMobile }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const roles = ["All", ...new Set(players.map(p => p.role).filter(Boolean))];
  const filtered = players.filter(p => {
    if (roleFilter !== "All" && p.role !== roleFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.riot_name || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!players.length) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>No players on any roster yet.</div>;
  return (<div style={{ maxWidth: 900, margin: "0 auto" }}>
    <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-bright)", letterSpacing: 2, marginBottom: 16 }}>PLAYERS</h2>
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <input placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "var(--bg-input)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "10px 14px", fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", flex: 1, minWidth: 160, outline: "none" }} />
      <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ background: "var(--bg-input)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "10px 14px", fontSize: 13, fontFamily: "'Oswald', sans-serif", cursor: "pointer" }}>
        {roles.map(r => <option key={r} value={r}>{r === "All" ? "All Roles" : r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
      </select>
    </div>
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
      {filtered.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>No players match your search.</div>
      : filtered.map((p, i) => (
        <div key={p.id || i} style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, padding: isMobile ? "12px" : "12px 18px", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: p.team ? `linear-gradient(135deg, ${p.team.color_primary || "#333"}, ${p.team.color_accent || "#555"})` : "var(--border3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700, fontFamily: "'Oswald', sans-serif", flexShrink: 0 }}>{teamInitial(p.team?.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{p.name}{p.is_captain && <span style={{ fontSize: 9, color: "#f59e0b", marginLeft: 6 }}>CAPTAIN</span>}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {p.team?.name || "Free Agent"} · {(p.role || "—").toUpperCase()}
              {p.riot_name && <span style={{ color: "var(--text-dim)" }}> · {p.riot_name}#{p.riot_tag || "?"}</span>}
            </div>
          </div>
          {p.gp > 0 && !isMobile && <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", letterSpacing: 0.5 }}>GP</div><div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text-secondary)" }}>{p.gp}</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", letterSpacing: 0.5 }}>KDA</div><div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text-bright)", fontWeight: 700 }}>{p.kda}</div></div>
            <div style={{ textAlign: "center" }}><div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", letterSpacing: 0.5 }}>WIN%</div><div style={{ fontFamily: "monospace", fontSize: 13, color: p.winRate >= 50 ? "var(--green)" : "var(--red)" }}>{p.winRate}%</div></div>
          </div>}
        </div>
      ))}
    </div>
  </div>);
}

export default function Home() {
  const [tab, setTab] = useState("Home");
  const w = useWindowSize();
  const isMobile = w < 768, isTablet = w >= 768 && w < 1024;
  const { teams, matches, standings, players, rosters, articles, splits, loading } = useLeagueData();
  const split = splits[0], hero = articles.find(a => a.article_type === "hero"), rest = articles.filter(a => a.id !== hero?.id);

  return (<div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)", fontFamily: "'Source Sans 3', sans-serif", paddingBottom: isMobile ? 72 : 0 }}>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{display:none}::selection{background:var(--accent);color:#fff}`}</style>

    <div style={{ background: "var(--bg)", padding: isMobile ? "6px 12px" : "6px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--bg2)" }}>
      <span style={{ fontSize: isMobile ? 9 : 10, color: "var(--text-muted)", fontFamily: "'Oswald', sans-serif", letterSpacing: 1 }}>{split ? `${split.seasons?.name || "SEASON"} · ${split.name}` : "PRESEASON"}</span>
      <span style={{ fontSize: isMobile ? 9 : 10, color: "#0a0a0a", background: "var(--accent)", padding: "3px 10px", borderRadius: 3, cursor: "pointer", fontFamily: "'Oswald', sans-serif", fontWeight: 600, letterSpacing: 0.5 }}>JOIN LEAGUE</span>
    </div>

    <ScoreboardTicker matches={matches} isMobile={isMobile} />
    <NavBar active={tab} setActive={setTab} isMobile={isMobile} />

    {loading ? <div style={{ padding: 60, textAlign: "center", color: "var(--text-subtle)" }}>Loading...</div>
    : !teams.length ? <div style={{ maxWidth: 500, margin: "60px auto", textAlign: "center", padding: "0 20px" }}>
        <span style={{ fontSize: 48, display: "block", marginBottom: 16 }}>⚔️</span>
        <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--text-bright)", letterSpacing: 2, marginBottom: 8 }}>LEAGUE IS BEING SET UP</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 24 }}>Teams and players haven't been added yet.</p>
        <Link to="/admin" style={{ display: "inline-block", background: "var(--accent)", color: "#fff", borderRadius: 6, padding: "12px 28px", fontSize: 14, fontFamily: "'Oswald', sans-serif", fontWeight: 500, letterSpacing: 1, textDecoration: "none", textTransform: "uppercase" }}>Open Admin</Link>
      </div>
    : <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "12px" : "20px" }}>
        {tab === "Scores" ? <ScoresView matches={matches} isMobile={isMobile} />
        : tab === "Schedule" ? <ScheduleView matches={matches} isMobile={isMobile} />
        : tab === "Standings" ? <StandingsView standings={standings} teams={teams} isMobile={isMobile} />
        : tab === "Stats" ? <StatsView players={players} isMobile={isMobile} />
        : tab === "Teams" ? <TeamsView teams={teams} standings={standings} rosters={rosters} isMobile={isMobile} />
        : tab === "Players" ? <PlayersView players={players} isMobile={isMobile} />
        : <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 280px" : "1fr 320px", gap: isMobile ? 16 : 20 }}>
          <div>
            {hero ? <HeroArticle article={hero} isMobile={isMobile} />
            : <div style={{ background: "linear-gradient(135deg, #6B21A8 0%, #1E1B4B 100%)", borderRadius: 8, padding: isMobile ? "24px 16px" : "40px 28px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, opacity: 0.5, backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
                <div style={{ position: "relative" }}><h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile ? 24 : 32, color: "#fff", letterSpacing: 1, marginBottom: 8 }}>WELCOME TO CCS LEAGUE</h2><p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{teams.length} teams registered · {split?.name || "Season starting soon"}</p></div>
              </div>}
            <div style={{ marginTop: isMobile ? 16 : 20 }}>
              {rest.length > 0 && <><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile ? 18 : 20, color: "var(--text-bright)", letterSpacing: 1.5 }}>TOP STORIES</span></div><NewsFeed articles={rest} isMobile={isMobile} /></>}
              {!articles.length && <div style={{ background: "var(--bg2)", borderRadius: 6, border: "1px solid var(--border)", padding: 24, textAlign: "center" }}><span style={{ color: "var(--text-dim)", fontSize: 13 }}>No news yet. Publish articles from the admin dashboard.</span></div>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <StandingsWidget standings={standings} teams={teams} />
            <PlayerLeaders players={players} isMobile={isMobile} />
            {isMobile && <QuickLinks isMobile={isMobile} />}
            <UpcomingSchedule matches={matches} isMobile={isMobile} />
            {!isMobile && <QuickLinks isMobile={isMobile} />}
          </div>
        </div>}
      </div>}

    <footer style={{ borderTop: "1px solid var(--bg3)", padding: isMobile ? "20px 12px" : "24px 20px", marginTop: 40, textAlign: "center" }}>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "var(--text-subtle)", letterSpacing: 3 }}>CCS<span style={{ color: "var(--accent)" }}>LEAGUE</span></span>
      <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 8 }}>Amateur Esports · Community Driven</div>
    </footer>
    {isMobile && <MobileBottomBar active={tab} setActive={setTab} />}
  </div>);
}
