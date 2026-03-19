import { useState } from "react";
import { TeamBadge } from "../TeamBadge";
import { getPlayoffScenario } from "../../lib/playoffScenarios";
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

  const showScenarios = div !== "All" || divs.length <= 1;

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
              {showScenarios && <th className="px-3.5 py-3 text-left text-[10px] text-text-muted font-heading font-normal tracking-wider border-b border-border">SCENARIO</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const t = s.teams || {} as Team;
              const total = s.wins + s.losses;
              const pct = total > 0 ? Math.round((s.wins / total) * 100) : 0;
              const pos = i + 1;
              const scenario = showScenarios ? getPlayoffScenario(pos) : null;
              return (
                <tr
                  key={s.id}
                  className="border-b border-bg3"
                  style={scenario ? { borderLeft: `3px solid ${scenario.borderColor}` } : undefined}
                >
                  <td className={`px-3.5 py-3 font-display text-base ${i < 3 ? "text-accent" : "text-text-dim"}`}>{pos}</td>
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
                    {s.streak || "—"}
                  </td>
                  {!isMobile && <td className="px-3.5 py-3 text-xs text-text-muted">{t.divisions?.name || "—"}</td>}
                  {showScenarios && (
                    <td className="px-3.5 py-3">
                      {scenario && (
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[10px] font-heading tracking-wider uppercase font-medium"
                          style={{ background: scenario.bgColor, color: scenario.color }}
                        >
                          {scenario.label}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      {showScenarios && (
        <div className="mt-4 bg-bg2 border border-border rounded-md p-4">
          <div className="font-display text-[13px] text-text-bright tracking-widest mb-3">PLAYOFF SCENARIOS</div>
          <div className="grid grid-cols-2 gap-2" style={{ maxWidth: 500 }}>
            {[
              { pos: "1st", label: "Upper Bracket Bye", color: "var(--gold)", bg: "rgba(212,160,23,0.15)" },
              { pos: "2nd-3rd", label: "Upper Bracket", color: "var(--green)", bg: "rgba(16,185,129,0.15)" },
              { pos: "4th", label: "Lower Bracket Bye", color: "var(--blue)", bg: "rgba(59,130,246,0.15)" },
              { pos: "5th", label: "Lower Bracket", color: "var(--blue)", bg: "rgba(59,130,246,0.10)" },
              { pos: "6th", label: "Gauntlet Qualifier", color: "var(--orange)", bg: "rgba(245,158,11,0.12)" },
              { pos: "7th-8th", label: "Gauntlet Prelim", color: "var(--red)", bg: "rgba(239,68,68,0.12)" },
            ].map(s => (
              <div key={s.pos} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
                <span className="text-[11px] text-text-secondary">
                  <span className="font-mono font-bold" style={{ color: s.color }}>{s.pos}</span>
                  {" — "}
                  <span className="font-heading">{s.label}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
