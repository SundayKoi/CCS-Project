import { useState } from "react";
import { TeamBadge } from "../TeamBadge";
import type { Standing, Team } from "../../hooks/useLeagueData";

interface Props {
  standings: Standing[];
  teams: Team[];
}

export function StandingsWidget({ standings, teams }: Props) {
  const divs = [...new Set(standings.map(s => s.teams?.divisions?.name).filter(Boolean))] as string[];
  const [div, setDiv] = useState(divs[0] || "All");
  const filtered = div === "All" ? standings : standings.filter(s => s.teams?.divisions?.name === div);
  const sorted = [...filtered].sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  if (!standings.length && teams.length) {
    return (
      <div className="bg-bg2 rounded-md overflow-hidden border border-border">
        <div className="px-3.5 py-3 border-b border-border">
          <span className="font-display text-[15px] text-text-bright tracking-widest">TEAMS</span>
        </div>
        {teams.map((t, i) => (
          <div key={t.id} className={`flex items-center gap-2 px-3 py-2.5 ${i < teams.length - 1 ? "border-b border-bg2" : ""}`}>
            <TeamBadge team={t} size={28} />
            <span className="font-heading text-[13px] text-text font-medium">{t.name}</span>
            <span className="text-[10px] text-text-dim font-mono ml-auto">{t.abbreviation}</span>
          </div>
        ))}
      </div>
    );
  }

  if (!standings.length) return null;

  return (
    <div className="bg-bg2 rounded-md overflow-hidden border border-border">
      {divs.length > 1 && (
        <div className="flex border-b border-border">
          {divs.map(d => (
            <button
              key={d}
              onClick={() => setDiv(d)}
              className={`flex-1 border-none cursor-pointer py-2.5 font-display text-[13px] tracking-widest ${
                div === d ? "bg-bg-input text-text-bright border-b-2 border-b-accent" : "bg-transparent text-text-muted border-b-2 border-b-transparent"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-[10px] text-text-muted font-heading font-normal tracking-wider border-b border-border">TEAM</th>
            <th className="px-2 py-2 text-center text-[10px] text-text-muted font-heading font-normal border-b border-border">W-L</th>
            <th className="px-2 py-2 text-center text-[10px] text-text-muted font-heading font-normal border-b border-border">STRK</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => {
            const t = s.teams || {} as Team;
            return (
              <tr key={s.id} className="cursor-pointer">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-text-dim font-mono min-w-[14px] text-right">{i + 1}</span>
                    <TeamBadge team={t} />
                    <span className="font-heading text-[13px] text-text font-medium">{t.name}</span>
                  </div>
                </td>
                <td className="text-center font-mono text-[13px] text-text-secondary">{s.wins}-{s.losses}</td>
                <td className={`text-center font-mono text-xs font-bold ${(s.streak || "").startsWith("W") ? "text-ccs-green" : "text-ccs-red"}`}>
                  {s.streak || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
