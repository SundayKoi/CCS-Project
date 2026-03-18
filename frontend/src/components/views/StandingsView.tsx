import { useState } from "react";
import { TeamBadge } from "../TeamBadge";
import type { Standing, Team } from "../../hooks/useLeagueData";

interface Props {
  standings: Standing[];
  teams: Team[];
  isMobile: boolean;
}

export function StandingsView({ standings, teams, isMobile }: Props) {
  const divs = [...new Set(standings.map(s => s.teams?.divisions?.name).filter(Boolean))] as string[];
  const [div, setDiv] = useState(divs[0] || "All");
  const filtered = div === "All" ? standings : standings.filter(s => s.teams?.divisions?.name === div);
  const sorted = [...filtered].sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  if (!standings.length) return <div className="py-10 text-center text-text-dim text-[13px]">No standings data yet. Ingest some matches first.</div>;

  return (
    <div className="max-w-[900px] mx-auto">
      <h2 className="font-display text-[22px] text-text-bright tracking-widest mb-4">STANDINGS</h2>
      {divs.length > 1 && (
        <div className="flex gap-0 mb-4 border-b-2 border-accent">
          {["All", ...divs].map(d => (
            <button
              key={d}
              onClick={() => setDiv(d)}
              className={`bg-transparent border-none cursor-pointer px-4 py-2.5 font-heading text-[13px] tracking-wider uppercase -mb-0.5 ${
                div === d ? "bg-bg-input text-text-bright border-b-2 border-b-accent" : "text-text-muted border-b-2 border-b-transparent"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      <div className="bg-bg2 border border-border rounded-md overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["#", "TEAM", "W", "L", "WIN%", "STREAK"].map(h => (
                <th
                  key={h}
                  className={`px-3.5 py-3 text-[10px] text-text-muted font-heading font-normal tracking-wider border-b border-border ${
                    ["W", "L", "WIN%", "STREAK"].includes(h) ? "text-center" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
              {!isMobile && <th className="px-3.5 py-3 text-left text-[10px] text-text-muted font-heading font-normal tracking-wider border-b border-border">DIVISION</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const t = s.teams || {} as Team;
              const total = s.wins + s.losses;
              const pct = total > 0 ? Math.round((s.wins / total) * 100) : 0;
              return (
                <tr key={s.id} className="border-b border-bg3">
                  <td className={`px-3.5 py-3 font-display text-base ${i < 3 ? "text-accent" : "text-text-dim"}`}>{i + 1}</td>
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-2.5">
                      <TeamBadge team={t} size={28} />
                      <div>
                        <span className="font-heading text-sm text-text font-medium">{t.name}</span>
                        <span className="text-[10px] text-text-dim font-mono ml-2">{t.abbreviation}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-center font-mono text-sm text-ccs-green font-bold">{s.wins}</td>
                  <td className="px-3.5 py-3 text-center font-mono text-sm text-ccs-red font-bold">{s.losses}</td>
                  <td className="px-3.5 py-3 text-center font-mono text-[13px] text-text-secondary">{pct}%</td>
                  <td className={`px-3.5 py-3 text-center font-mono text-[13px] font-bold ${(s.streak || "").startsWith("W") ? "text-ccs-green" : "text-ccs-red"}`}>
                    {s.streak || "\u2014"}
                  </td>
                  {!isMobile && <td className="px-3.5 py-3 text-xs text-text-muted">{t.divisions?.name || "\u2014"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
