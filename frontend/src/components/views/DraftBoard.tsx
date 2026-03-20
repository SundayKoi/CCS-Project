import { useState, useEffect, useMemo } from "react";
import { db } from "../../lib/supabase";
import { timeAgo } from "../../lib/utils";
import { TeamBadge } from "../TeamBadge";

interface Props {
  isMobile: boolean;
}

interface TeamData {
  id: string;
  name: string;
  abbreviation: string;
  logo_url?: string;
  color_primary?: string;
}

interface DraftListing {
  id: string;
  listing_type: "team_lft" | "player_lft";
  is_active: boolean;
  created_at: string;
  expires_at?: string;
  team_id?: string;
  teams?: TeamData;
  player_name?: string;
  riot_id?: string;
  rank?: string;
  roles_needed?: string[];
  preferred_roles?: string[];
  description?: string;
  discord_tag?: string;
  opgg_url?: string;
}

interface RosterEntry {
  team_id: string;
}

const ROLE_COLORS: Record<string, string> = {
  top: "#d20708",
  jungle: "#d7a52a",
  mid: "#d1d2d4",
  adc: "#7a2021",
  support: "#a07820",
};

const ROLES = ["Top", "Jungle", "Mid", "ADC", "Support"];

const RANKS = [
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Emerald",
  "Diamond",
  "Master",
  "Grandmaster",
  "Challenger",
];

type ListingFilter = "all" | "team_lft" | "player_lft";

export function DraftBoard({ isMobile }: Props) {
  const [listings, setListings] = useState<DraftListing[]>([]);
  const [rosterCounts, setRosterCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<ListingFilter>("all");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [rankFilter, setRankFilter] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [listingsData, rostersData] = await Promise.all([
          db("draft_listings", {
            query:
              "?select=*,teams(id,name,abbreviation,logo_url,color_primary)&is_active=eq.true&order=created_at.desc",
          }),
          db("rosters", {
            query: "?select=team_id&left_at=is.null&is_starter=eq.true",
          }),
        ]);

        setListings(listingsData || []);

        const counts: Record<string, number> = {};
        if (rostersData) {
          for (const r of rostersData as RosterEntry[]) {
            counts[r.team_id] = (counts[r.team_id] || 0) + 1;
          }
        }
        setRosterCounts(counts);
      } catch (err) {
        console.error("Failed to fetch draft board data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    return listings.filter((listing) => {
      // Filter expired
      if (listing.expires_at && new Date(listing.expires_at).getTime() < now) {
        return false;
      }

      // Filter by listing type
      if (filterType !== "all" && listing.listing_type !== filterType) {
        return false;
      }

      // Filter by roles
      if (selectedRoles.length > 0) {
        if (listing.listing_type === "team_lft") {
          const needed = (listing.roles_needed || []).map((r) =>
            r.toLowerCase()
          );
          if (!selectedRoles.some((r) => needed.includes(r.toLowerCase()))) {
            return false;
          }
        } else {
          const preferred = (listing.preferred_roles || []).map((r) =>
            r.toLowerCase()
          );
          if (
            !selectedRoles.some((r) => preferred.includes(r.toLowerCase()))
          ) {
            return false;
          }
        }
      }

      // Filter by search
      if (search) {
        const q = search.toLowerCase();
        const haystack = [
          listing.teams?.name,
          listing.player_name,
          listing.riot_id,
          listing.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // Filter by rank (player listings only, team listings always show)
      if (rankFilter) {
        if (listing.listing_type === "player_lft") {
          if (
            !listing.rank ||
            !listing.rank.toLowerCase().startsWith(rankFilter.toLowerCase())
          ) {
            return false;
          }
        }
      }

      return true;
    });
  }, [listings, filterType, selectedRoles, search, rankFilter]);

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function RoleBadge({ role }: { role: string }) {
    const key = role.toLowerCase();
    const color = ROLE_COLORS[key] || "#666";
    return (
      <span
        className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-heading font-semibold tracking-wide"
        style={{
          backgroundColor: color + "22",
          color: color,
          border: `1px solid ${color}44`,
        }}
      >
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  }

  function TeamCard({ listing }: { listing: DraftListing }) {
    const team = listing.teams;
    const count = team ? rosterCounts[team.id] || 0 : 0;

    return (
      <div className="bg-bg2 border border-border rounded-lg overflow-hidden p-4 flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <TeamBadge team={team} size={36} />
          <div className="flex-1 min-w-0">
            <div className="font-heading text-sm text-text-bright font-semibold truncate">
              {team?.name || "Unknown Team"}{" "}
              {team?.abbreviation && (
                <span className="text-text-muted font-normal">
                  ({team.abbreviation})
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-[12px] font-mono text-text-secondary bg-bg3 rounded px-2 py-0.5">
            Roster: {count}/5
          </div>
        </div>

        {listing.roles_needed && listing.roles_needed.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-text-muted font-heading">
              Roles needed:
            </span>
            {listing.roles_needed.map((role) => (
              <RoleBadge key={role} role={role} />
            ))}
          </div>
        )}

        {listing.description && (
          <p className="text-[13px] text-text-secondary italic leading-relaxed">
            &ldquo;{listing.description}&rdquo;
          </p>
        )}

        <div className="flex items-center justify-between text-[11px] text-text-muted mt-auto">
          <div>
            {listing.discord_tag && (
              <span className="font-mono">Discord: {listing.discord_tag}</span>
            )}
          </div>
          <span>Posted {timeAgo(listing.created_at)}</span>
        </div>
      </div>
    );
  }

  function PlayerCard({ listing }: { listing: DraftListing }) {
    return (
      <div className="bg-bg2 border border-border rounded-lg overflow-hidden p-4 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="font-heading text-sm text-text-bright font-semibold">
            {listing.player_name || "Unknown Player"}
          </div>
          {listing.rank && (
            <span className="text-[12px] text-text-secondary">
              &mdash; {listing.rank}
            </span>
          )}
        </div>

        {listing.preferred_roles && listing.preferred_roles.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-text-muted font-heading">
              Preferred:
            </span>
            {listing.preferred_roles.map((role) => (
              <RoleBadge key={role} role={role} />
            ))}
          </div>
        )}

        {listing.description && (
          <p className="text-[13px] text-text-secondary italic leading-relaxed">
            &ldquo;{listing.description}&rdquo;
          </p>
        )}

        <div className="flex items-center justify-between text-[11px] text-text-muted mt-auto flex-wrap gap-1">
          <div className="flex items-center gap-2">
            {listing.opgg_url && (
              <a
                href={listing.opgg_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline font-mono"
              >
                OP.GG
              </a>
            )}
            {listing.opgg_url && listing.discord_tag && (
              <span className="text-text-muted">|</span>
            )}
            {listing.discord_tag && (
              <span className="font-mono">Discord: {listing.discord_tag}</span>
            )}
          </div>
          <span>Posted {timeAgo(listing.created_at)}</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-text-muted text-[13px]">
        Loading draft board...
      </div>
    );
  }

  const typeButtons: { label: string; value: ListingFilter }[] = [
    { label: "All", value: "all" },
    { label: "Teams LFP", value: "team_lft" },
    { label: "Players LFT", value: "player_lft" },
  ];

  return (
    <div className="max-w-[900px] mx-auto">
      <h2 className="font-display text-[22px] text-text-bright tracking-widest mb-4">
        DRAFT BOARD
      </h2>

      {/* Type toggle */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {typeButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setFilterType(btn.value)}
            className={`px-4 py-2 rounded-md text-[13px] font-heading font-semibold transition-colors ${
              filterType === btn.value
                ? "bg-accent text-white"
                : "bg-bg3 text-text-secondary hover:text-text border border-border"
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {ROLES.map((role) => {
          const key = role.toLowerCase();
          const active = selectedRoles.includes(role);
          const color = ROLE_COLORS[key] || "#666";
          return (
            <button
              key={role}
              onClick={() => toggleRole(role)}
              className="rounded-md px-3 py-1.5 text-[12px] font-heading font-semibold transition-colors border"
              style={{
                backgroundColor: active ? color + "33" : "transparent",
                color: active ? color : "var(--text-secondary)",
                borderColor: active ? color + "66" : "var(--border)",
              }}
            >
              {role}
            </button>
          );
        })}
        <input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg-input border border-border3 rounded-md text-text py-2 px-3 text-[13px] font-body flex-1 min-w-[120px] outline-none"
        />
        <select
          value={rankFilter}
          onChange={(e) => setRankFilter(e.target.value)}
          className="bg-bg-input border border-border3 rounded-md text-text py-2 px-3 text-[13px] font-heading cursor-pointer"
        >
          <option value="">All Ranks</option>
          {RANKS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-text-muted text-[14px]">
          No listings right now — check back later!
        </div>
      ) : (
        <div
          className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {filtered.map((listing) =>
            listing.listing_type === "team_lft" ? (
              <TeamCard key={listing.id} listing={listing} />
            ) : (
              <PlayerCard key={listing.id} listing={listing} />
            )
          )}
        </div>
      )}
    </div>
  );
}
