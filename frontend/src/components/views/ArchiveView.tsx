import { useEffect, useState } from "react";
import { archiveApi, type ArchiveTournament } from "../../lib/archiveApi";
import { TournamentPicker } from "../archive/TournamentPicker";
import { ArchiveTeams } from "../archive/ArchiveTeams";
import { ArchivePlayers } from "../archive/ArchivePlayers";
import { ArchiveChampions } from "../archive/ArchiveChampions";
import { ArchiveTeamDetail } from "../archive/ArchiveTeamDetail";
import { ArchiveMatchDetail } from "../archive/ArchiveMatchDetail";

const SUB_TABS = ["Teams", "Players", "Champions"] as const;
type SubTab = typeof SUB_TABS[number];

type View =
  | { kind: "list"; tab: SubTab }
  | { kind: "team"; code: string }
  | { kind: "match"; matchId: string; returnTo?: { kind: "team"; code: string } };

export function ArchiveView() {
  const [tournaments, setTournaments] = useState<ArchiveTournament[]>([]);
  const [conf, setConf] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "list", tab: "Teams" });

  useEffect(() => {
    archiveApi.tournaments()
      .then(data => {
        setTournaments(data);
        if (data.length > 0) {
          const ccsTourneys = data.filter(t => t.name.toLowerCase().includes("ccs"));
          const pool = ccsTourneys.length > 0 ? ccsTourneys : data;
          setConf(pool[pool.length - 1].conf);
        }
      })
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const onConfChange = (c: string) => {
    setConf(c);
    setView({ kind: "list", tab: "Teams" });
  };

  if (loading) return <div className="text-center py-10 text-text-subtle">Loading archive...</div>;
  if (err) return <div className="text-center py-10 text-ccs-red">{err}</div>;
  if (!tournaments.length) return <div className="text-center py-10 text-text-dim">No tournaments available.</div>;

  return (
    <div className="max-w-[1200px] mx-auto">
      <h2 className="font-display text-[22px] text-text-bright tracking-widest mb-1">ARCHIVE</h2>
      <p className="text-xs text-text-dim mb-4">Historical tournament data from past CCS seasons.</p>

      <TournamentPicker tournaments={tournaments} selected={conf} onChange={onConfChange} />

      {view.kind === "list" && (
        <>
          <div className="flex gap-1 border-b border-border mb-5">
            {SUB_TABS.map(t => (
              <button
                key={t}
                onClick={() => setView({ kind: "list", tab: t })}
                className={`py-2.5 px-4 font-heading text-xs tracking-wider uppercase border-b-2 ${
                  view.tab === t ? "text-text-bright border-accent font-bold" : "text-text-secondary border-transparent"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {view.tab === "Teams" && (
            <ArchiveTeams conf={conf} onSelectTeam={code => setView({ kind: "team", code })} />
          )}
          {view.tab === "Players" && <ArchivePlayers conf={conf} />}
          {view.tab === "Champions" && <ArchiveChampions conf={conf} />}
        </>
      )}

      {view.kind === "team" && (
        <ArchiveTeamDetail
          conf={conf}
          code={view.code}
          onBack={() => setView({ kind: "list", tab: "Teams" })}
          onSelectMatch={matchId => setView({ kind: "match", matchId, returnTo: { kind: "team", code: view.code } })}
        />
      )}

      {view.kind === "match" && (
        <ArchiveMatchDetail
          matchId={view.matchId}
          onBack={() => view.returnTo ? setView(view.returnTo) : setView({ kind: "list", tab: "Teams" })}
        />
      )}
    </div>
  );
}
