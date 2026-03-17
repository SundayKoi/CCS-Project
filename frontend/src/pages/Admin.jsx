import { useState, useEffect, useCallback, useRef } from "react";
import { Auth, db, uploadFile } from "../lib/supabase";

// ── Shared Styles ────────────────────────────────────────
const S = {
  page: { background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", fontFamily: "'Source Sans 3', sans-serif", padding: 0 },
  topBar: { background: "#050505", borderBottom: "1px solid #1a1a1a", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  brand: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "#fff", letterSpacing: 2 },
  accent: { color: "#c2185b" },
  content: { maxWidth: 1100, margin: "0 auto", padding: "20px" },
  card: { background: "#111", border: "1px solid #1a1a1a", borderRadius: 8, overflow: "hidden", marginBottom: 16 },
  cardHeader: { padding: "14px 18px", borderBottom: "1px solid #1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, color: "#fff", letterSpacing: 1.5 },
  cardBody: { padding: 18 },
  input: {
    background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e5e5e5",
    padding: "10px 14px", fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", width: "100%",
    outline: "none", transition: "border-color 0.15s",
  },
  select: {
    background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6, color: "#e5e5e5",
    padding: "10px 14px", fontSize: 13, fontFamily: "'Source Sans 3', sans-serif", width: "100%",
    outline: "none", cursor: "pointer",
  },
  label: { fontSize: 11, color: "#888", fontFamily: "'Oswald', sans-serif", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4, display: "block" },
  btnPrimary: {
    background: "#c2185b", color: "#fff", border: "none", borderRadius: 6, padding: "10px 20px",
    fontSize: 13, fontFamily: "'Oswald', sans-serif", fontWeight: 500, letterSpacing: 0.8,
    cursor: "pointer", textTransform: "uppercase",
  },
  btnSecondary: {
    background: "#1a1a1a", color: "#ccc", border: "1px solid #2a2a2a", borderRadius: 6, padding: "10px 20px",
    fontSize: 13, fontFamily: "'Oswald', sans-serif", fontWeight: 400, letterSpacing: 0.8,
    cursor: "pointer", textTransform: "uppercase",
  },
  btnDanger: {
    background: "transparent", color: "#ef4444", border: "1px solid #3a1a1a", borderRadius: 6,
    padding: "6px 12px", fontSize: 11, fontFamily: "'Oswald', sans-serif", cursor: "pointer",
    letterSpacing: 0.5, textTransform: "uppercase",
  },
  row: { display: "flex", gap: 12, marginBottom: 12 },
  col: { flex: 1, display: "flex", flexDirection: "column" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "10px 14px", textAlign: "left", fontSize: 10, color: "#555", fontFamily: "'Oswald', sans-serif", fontWeight: 400, letterSpacing: 1, borderBottom: "1px solid #1a1a1a", textTransform: "uppercase" },
  td: { padding: "10px 14px", fontSize: 13, borderBottom: "1px solid #111", verticalAlign: "middle" },
  badge: (color) => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10,
    fontFamily: "'Oswald', sans-serif", letterSpacing: 0.5, fontWeight: 500,
    background: color + "22", color: color, textTransform: "uppercase",
  }),
  mono: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#888" },
  empty: { padding: 40, textAlign: "center", color: "#444", fontSize: 13 },
};

// ── Toast ────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  if (!message) return null;
  return <div style={{
    position: "fixed", bottom: 20, right: 20, padding: "12px 20px", borderRadius: 8,
    background: type === "success" ? "#065F46" : "#991B1B", color: "#fff", fontSize: 13,
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)", zIndex: 999,
  }}>{message}</div>;
}

// ── Login Screen ─────────────────────────────────────────
function LoginScreen({ onLogin, toast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);
  useEffect(() => { emailRef.current?.focus(); }, []);

  const submit = async () => {
    if (!email || !password) { toast("Email and password required", "error"); return; }
    setLoading(true);
    try {
      await Auth.signIn(email, password);
      if (!Auth.isAdmin()) { Auth.signOut(); toast("Access denied — admin role required", "error"); setLoading(false); return; }
      onLogin();
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  };

  return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ width: 380 }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -70%)",
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(194,24,91,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ textAlign: "center", marginBottom: 32, position: "relative" }}>
          <span style={{ fontSize: 36 }}>⚔️</span>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#fff", letterSpacing: 3, marginTop: 8 }}>
            INHOUSE<span style={S.accent}>LEAGUE</span>
          </div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 12, color: "#555", letterSpacing: 2, marginTop: 4, textTransform: "uppercase" }}>Admin Dashboard</div>
        </div>
        <div style={{ ...S.card, position: "relative" }}>
          <div style={{ ...S.cardBody, padding: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Email</label>
              <input ref={emailRef} style={S.input} type="email" placeholder="admin@yourleague.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={S.label}>Password</label>
              <input style={S.input} type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
            </div>
            <button style={{ ...S.btnPrimary, width: "100%", padding: "12px", fontSize: 14, opacity: loading ? 0.6 : 1 }} onClick={submit} disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────
function AdminTabs({ active, setActive }) {
  const tabs = ["Teams", "Players", "Rosters", "Schedule", "Divisions", "Seasons"];
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #c2185b", marginBottom: 20, overflowX: "auto", scrollbarWidth: "none" }}>
      {tabs.map(t => (
        <button key={t} onClick={() => setActive(t)} style={{
          background: active === t ? "#1a1a1a" : "transparent", border: "none", cursor: "pointer",
          padding: "12px 20px", color: active === t ? "#fff" : "#666",
          fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: active === t ? 600 : 400,
          letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap",
          borderBottom: active === t ? "2px solid #c2185b" : "2px solid transparent", marginBottom: -2,
        }}>{t}</button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// TEAMS
// ══════════════════════════════════════════════════════════
function TeamsTab({ seasons, divisions, toast }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", abbreviation: "", color_primary: "#6B21A8", color_accent: "#A855F7", logo_url: "", division_id: "", season_id: "" });
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const logoFileRef = useRef(null);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Please select an image file", "error"); return; }
    if (file.size > 2 * 1024 * 1024) { toast("Image must be under 2MB", "error"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}_${(form.abbreviation || "team").toLowerCase()}.${ext}`;
      const publicUrl = await uploadFile("team-logos", path, file);
      setForm(f => ({ ...f, logo_url: publicUrl }));
      toast("Logo uploaded", "success");
    } catch (err) { toast(err.message, "error"); }
    setUploading(false);
    e.target.value = "";
  };

  const load = useCallback(async () => {
    setLoading(true);
    try { setTeams(await db("teams", { query: "?select=*,divisions(name)&order=name" }) || []); }
    catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name || !form.abbreviation) { toast("Name and abbreviation required", "error"); return; }
    const body = { ...form }; if (!body.division_id) body.division_id = null; if (!body.season_id) body.season_id = null; if (!body.logo_url) body.logo_url = null;
    try {
      if (editing) { await db(`teams?id=eq.${editing}`, { method: "PATCH", body }); toast("Team updated", "success"); }
      else { await db("teams", { method: "POST", body }); toast("Team created", "success"); }
      setForm({ name: "", abbreviation: "", color_primary: "#6B21A8", color_accent: "#A855F7", logo_url: "", division_id: "", season_id: "" }); setEditing(null); load();
    } catch (e) { toast(e.message, "error"); }
  };

  const del = async (id) => { if (!confirm("Delete this team?")) return; try { await db(`teams?id=eq.${id}`, { method: "DELETE" }); toast("Deleted", "success"); load(); } catch (e) { toast(e.message, "error"); } };
  const edit = (t) => { setEditing(t.id); setForm({ name: t.name, abbreviation: t.abbreviation, color_primary: t.color_primary || "#6B21A8", color_accent: t.color_accent || "#A855F7", logo_url: t.logo_url || "", division_id: t.division_id || "", season_id: t.season_id || "" }); };

  return (<div>
    <div style={S.card}>
      <div style={S.cardHeader}>
        <span style={S.cardTitle}>{editing ? "EDIT TEAM" : "ADD NEW TEAM"}</span>
        {editing && <button style={S.btnSecondary} onClick={() => { setEditing(null); setForm({ name: "", abbreviation: "", color_primary: "#6B21A8", color_accent: "#A855F7", logo_url: "", division_id: "", season_id: "" }); }}>Cancel</button>}
      </div>
      <div style={S.cardBody}>
        <div style={S.row}>
          <div style={{ ...S.col, flex: 2 }}><label style={S.label}>Team Name</label><input style={S.input} placeholder="Shadow Wolves" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div style={S.col}><label style={S.label}>Abbreviation</label><input style={S.input} placeholder="SHW" maxLength={5} value={form.abbreviation} onChange={e => setForm({ ...form, abbreviation: e.target.value.toUpperCase() })} /></div>
        </div>
        <div style={S.row}>
          <div style={S.col}><label style={S.label}>Primary Color</label><div style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="color" value={form.color_primary} onChange={e => setForm({ ...form, color_primary: e.target.value })} style={{ width: 40, height: 36, border: "none", background: "transparent", cursor: "pointer" }} /><input style={{ ...S.input, ...S.mono }} value={form.color_primary} onChange={e => setForm({ ...form, color_primary: e.target.value })} /></div></div>
          <div style={S.col}><label style={S.label}>Accent Color</label><div style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="color" value={form.color_accent} onChange={e => setForm({ ...form, color_accent: e.target.value })} style={{ width: 40, height: 36, border: "none", background: "transparent", cursor: "pointer" }} /><input style={{ ...S.input, ...S.mono }} value={form.color_accent} onChange={e => setForm({ ...form, color_accent: e.target.value })} /></div></div>
        </div>
        <div style={S.row}>
          <div style={S.col}>
            <label style={S.label}>Team Logo</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input ref={logoFileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} />
              <button style={{ ...S.btnSecondary, opacity: uploading ? 0.6 : 1 }} onClick={() => logoFileRef.current?.click()} disabled={uploading}>{uploading ? "Uploading..." : "Upload Image"}</button>
              <span style={{ fontSize: 11, color: "#555" }}>or</span>
              <input style={{ ...S.input, flex: 1 }} placeholder="Paste image URL..." value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} />
              {form.logo_url && <button style={{ ...S.btnDanger, padding: "6px 10px", fontSize: 10 }} onClick={() => setForm({ ...form, logo_url: "" })}>Clear</button>}
            </div>
          </div>
        </div>
        <div style={S.row}>
          <div style={S.col}><label style={S.label}>Division</label><select style={S.select} value={form.division_id} onChange={e => setForm({ ...form, division_id: e.target.value })}><option value="">No division</option>{divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div style={S.col}><label style={S.label}>Season</label><select style={S.select} value={form.season_id} onChange={e => setForm({ ...form, season_id: e.target.value })}><option value="">No season</option>{seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
          {form.logo_url ? <img src={form.logo_url} alt="Logo" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "contain", background: "#1a1a1a", border: "1px solid #2a2a2a" }} onError={e => { e.target.style.display = "none"; }} /> : <div style={{ width: 48, height: 48, borderRadius: 8, background: `linear-gradient(135deg, ${form.color_primary}, ${form.color_accent})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "'Oswald', sans-serif", color: "#fff", fontWeight: 600, letterSpacing: 1 }}>{form.abbreviation || "?"}</div>}
          <button style={S.btnPrimary} onClick={save}>{editing ? "Update Team" : "Add Team"}</button>
        </div>
      </div>
    </div>
    <div style={S.card}>
      <div style={S.cardHeader}><span style={S.cardTitle}>ALL TEAMS ({teams.length})</span></div>
      {teams.length === 0 ? <div style={S.empty}>{loading ? "Loading..." : "No teams yet."}</div> : (
        <table style={S.table}><thead><tr><th style={S.th}></th><th style={S.th}>Name</th><th style={S.th}>Abbr</th><th style={S.th}>Division</th><th style={S.th}>Colors</th><th style={S.th}></th></tr></thead>
          <tbody>{teams.map(t => (
            <tr key={t.id}>
              <td style={S.td}>{t.logo_url ? <img src={t.logo_url} alt={t.abbreviation} style={{ width: 32, height: 32, borderRadius: 6, objectFit: "contain", background: "#1a1a1a" }} onError={e => { e.target.style.display = "none"; e.target.nextSibling && (e.target.nextSibling.style.display = "flex"); }} /> : null}<div style={{ width: 32, height: 32, borderRadius: 6, background: `linear-gradient(135deg, ${t.color_primary || "#333"}, ${t.color_accent || "#555"})`, display: t.logo_url ? "none" : "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 600, fontFamily: "'Oswald', sans-serif" }}>{(t.abbreviation || "?").charAt(0)}</div></td>
              <td style={{ ...S.td, fontFamily: "'Oswald', sans-serif", fontWeight: 500 }}>{t.name}</td>
              <td style={{ ...S.td, ...S.mono }}>{t.abbreviation}</td>
              <td style={S.td}>{t.divisions?.name || <span style={{ color: "#333" }}>—</span>}</td>
              <td style={S.td}><div style={{ display: "flex", gap: 4 }}><div style={{ width: 16, height: 16, borderRadius: 3, background: t.color_primary || "#333" }} /><div style={{ width: 16, height: 16, borderRadius: 3, background: t.color_accent || "#555" }} /></div></td>
              <td style={{ ...S.td, textAlign: "right" }}>
                <button style={{ ...S.btnSecondary, padding: "6px 12px", fontSize: 11, marginRight: 6 }} onClick={() => edit(t)}>Edit</button>
                <button style={S.btnDanger} onClick={() => del(t.id)}>Delete</button>
              </td>
            </tr>
          ))}</tbody></table>
      )}
    </div>
  </div>);
}

// ══════════════════════════════════════════════════════════
// PLAYERS
// ══════════════════════════════════════════════════════════
function PlayersTab({ toast }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ display_name: "", riot_game_name: "", riot_tag_line: "", riot_puuid: "" });
  const [editing, setEditing] = useState(null);
  const [csvRows, setCsvRows] = useState([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => { setLoading(true); try { setPlayers(await db("players", { query: "?select=*&order=display_name" }) || []); } catch (e) { toast(e.message, "error"); } setLoading(false); }, [toast]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.display_name) { toast("Display name required", "error"); return; }
    const body = { ...form }; Object.keys(body).forEach(k => { if (body[k] === "") body[k] = null; });
    try {
      if (editing) { await db(`players?id=eq.${editing}`, { method: "PATCH", body }); toast("Updated", "success"); }
      else { await db("players", { method: "POST", body }); toast("Player added", "success"); }
      setForm({ display_name: "", riot_game_name: "", riot_tag_line: "", riot_puuid: "" }); setEditing(null); load();
    } catch (e) { toast(e.message, "error"); }
  };

  const del = async (id) => { if (!confirm("Delete?")) return; try { await db(`players?id=eq.${id}`, { method: "DELETE" }); toast("Deleted", "success"); load(); } catch (e) { toast(e.message, "error"); } };
  const edit = (p) => { setEditing(p.id); setForm({ display_name: p.display_name || "", riot_game_name: p.riot_game_name || "", riot_tag_line: p.riot_tag_line || "", riot_puuid: p.riot_puuid || "" }); };

  // ── CSV Import ──
  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const rawHeaders = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
    const colMap = {};
    const aliases = {
      display_name: ["display_name", "displayname", "name", "player", "player_name", "summoner", "summoner_name"],
      riot_game_name: ["riot_game_name", "riotgamename", "game_name", "gamename", "riot_name", "riotname", "riot_id"],
      riot_tag_line: ["riot_tag_line", "riottagline", "tag_line", "tagline", "tag"],
      riot_puuid: ["riot_puuid", "riotpuuid", "puuid"],
    };
    for (const [field, names] of Object.entries(aliases)) {
      const idx = rawHeaders.findIndex(h => names.includes(h));
      if (idx !== -1) colMap[field] = idx;
    }
    if (colMap.display_name === undefined) return [];
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim());
      const name = cols[colMap.display_name] || "";
      if (!name) continue;
      rows.push({
        display_name: name,
        riot_game_name: colMap.riot_game_name !== undefined ? cols[colMap.riot_game_name] || "" : "",
        riot_tag_line: colMap.riot_tag_line !== undefined ? cols[colMap.riot_tag_line] || "" : "",
        riot_puuid: colMap.riot_puuid !== undefined ? cols[colMap.riot_puuid] || "" : "",
      });
    }
    return rows;
  };

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCsv(ev.target.result);
      if (rows.length === 0) { toast("No valid rows found. Make sure the CSV has a 'display_name' (or 'name') column header.", "error"); return; }
      setCsvRows(rows);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const importCsv = async () => {
    if (csvRows.length === 0) return;
    setCsvImporting(true);
    let added = 0, failed = 0;
    for (const row of csvRows) {
      const body = { ...row };
      Object.keys(body).forEach(k => { if (body[k] === "") body[k] = null; });
      try { await db("players", { method: "POST", body }); added++; }
      catch { failed++; }
    }
    setCsvImporting(false);
    setCsvRows([]);
    toast(`Imported ${added} player${added !== 1 ? "s" : ""}${failed ? `, ${failed} failed` : ""}`, failed ? "error" : "success");
    load();
  };

  return (<div>
    <div style={S.card}>
      <div style={S.cardHeader}>
        <span style={S.cardTitle}>{editing ? "EDIT PLAYER" : "ADD NEW PLAYER"}</span>
        {editing && <button style={S.btnSecondary} onClick={() => { setEditing(null); setForm({ display_name: "", riot_game_name: "", riot_tag_line: "", riot_puuid: "" }); }}>Cancel</button>}
      </div>
      <div style={S.cardBody}>
        <div style={S.row}><div style={{ ...S.col, flex: 2 }}><label style={S.label}>Display Name</label><input style={S.input} placeholder="ZephyrBlade" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></div></div>
        <div style={S.row}>
          <div style={S.col}><label style={S.label}>Riot Game Name</label><input style={S.input} placeholder="ZephyrBlade" value={form.riot_game_name} onChange={e => setForm({ ...form, riot_game_name: e.target.value })} /></div>
          <div style={S.col}><label style={S.label}>Riot Tag Line</label><input style={S.input} placeholder="NA1" value={form.riot_tag_line} onChange={e => setForm({ ...form, riot_tag_line: e.target.value })} /></div>
        </div>
        <div style={S.row}><div style={S.col}><label style={S.label}>Riot PUUID</label><input style={{ ...S.input, ...S.mono }} placeholder="Paste PUUID here..." value={form.riot_puuid} onChange={e => setForm({ ...form, riot_puuid: e.target.value })} /></div></div>
        <button style={S.btnPrimary} onClick={save}>{editing ? "Update Player" : "Add Player"}</button>
      </div>
    </div>

    {/* CSV Bulk Import */}
    <div style={S.card}>
      <div style={S.cardHeader}><span style={S.cardTitle}>BULK IMPORT (CSV)</span></div>
      <div style={S.cardBody}>
        <div style={{ marginBottom: 12, fontSize: 12, color: "#888", lineHeight: 1.6 }}>
          Upload a <span style={{ ...S.mono, color: "#bbb" }}>.csv</span> file with columns: <span style={{ ...S.mono, color: "#bbb" }}>display_name</span>, <span style={{ ...S.mono, color: "#bbb" }}>riot_game_name</span>, <span style={{ ...S.mono, color: "#bbb" }}>riot_tag_line</span>, <span style={{ ...S.mono, color: "#bbb" }}>riot_puuid</span><br />
          Only <span style={{ ...S.mono, color: "#bbb" }}>display_name</span> is required. You can also use <span style={{ ...S.mono, color: "#bbb" }}>name</span> or <span style={{ ...S.mono, color: "#bbb" }}>player</span> as the column header.
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleCsvFile} style={{ display: "none" }} />
        <button style={S.btnSecondary} onClick={() => fileRef.current?.click()}>Choose CSV File</button>

        {csvRows.length > 0 && (<div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "#bbb" }}>{csvRows.length} player{csvRows.length !== 1 ? "s" : ""} ready to import</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btnSecondary} onClick={() => setCsvRows([])}>Clear</button>
              <button style={{ ...S.btnPrimary, opacity: csvImporting ? 0.6 : 1 }} onClick={importCsv} disabled={csvImporting}>
                {csvImporting ? "Importing..." : `Import ${csvRows.length} Players`}
              </button>
            </div>
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #1a1a1a", borderRadius: 6 }}>
            <table style={S.table}>
              <thead><tr><th style={S.th}>#</th><th style={S.th}>Display Name</th><th style={S.th}>Riot ID</th><th style={S.th}>PUUID</th></tr></thead>
              <tbody>{csvRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...S.td, ...S.mono }}>{i + 1}</td>
                  <td style={{ ...S.td, fontFamily: "'Oswald', sans-serif", fontWeight: 500 }}>{r.display_name}</td>
                  <td style={S.td}>{r.riot_game_name ? <span>{r.riot_game_name}<span style={{ color: "#555" }}>#{r.riot_tag_line || "?"}</span></span> : <span style={{ color: "#333" }}>—</span>}</td>
                  <td style={{ ...S.td, ...S.mono, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.riot_puuid ? r.riot_puuid.slice(0, 16) + "..." : <span style={{ color: "#333" }}>—</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>)}
      </div>
    </div>
    <div style={S.card}>
      <div style={S.cardHeader}><span style={S.cardTitle}>ALL PLAYERS ({players.length})</span></div>
      {players.length === 0 ? <div style={S.empty}>{loading ? "Loading..." : "No players yet."}</div> : (
        <table style={S.table}><thead><tr><th style={S.th}>Display Name</th><th style={S.th}>Riot ID</th><th style={S.th}>PUUID</th><th style={S.th}>Status</th><th style={S.th}></th></tr></thead>
          <tbody>{players.map(p => (
            <tr key={p.id}>
              <td style={{ ...S.td, fontFamily: "'Oswald', sans-serif", fontWeight: 500 }}>{p.display_name}</td>
              <td style={S.td}>{p.riot_game_name ? <span>{p.riot_game_name}<span style={{ color: "#555" }}>#{p.riot_tag_line || "?"}</span></span> : <span style={{ color: "#333" }}>—</span>}</td>
              <td style={{ ...S.td, ...S.mono, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.riot_puuid ? p.riot_puuid.slice(0, 20) + "..." : <span style={{ color: "#333" }}>Not set</span>}</td>
              <td style={S.td}><span style={S.badge(p.is_active ? "#10b981" : "#ef4444")}>{p.is_active ? "Active" : "Inactive"}</span></td>
              <td style={{ ...S.td, textAlign: "right" }}>
                <button style={{ ...S.btnSecondary, padding: "6px 12px", fontSize: 11, marginRight: 6 }} onClick={() => edit(p)}>Edit</button>
                <button style={S.btnDanger} onClick={() => del(p.id)}>Delete</button>
              </td>
            </tr>
          ))}</tbody></table>
      )}
    </div>
  </div>);
}

// ══════════════════════════════════════════════════════════
// ROSTERS
// ══════════════════════════════════════════════════════════
function RostersTab({ toast }) {
  const [rosters, setRosters] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ player_id: "", team_id: "", split_id: "", role: "", is_captain: false, is_starter: true });
  const roles = ["top", "jungle", "mid", "adc", "support", "fill", "sub"];
  const [csvRows, setCsvRows] = useState([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvSplitId, setCsvSplitId] = useState("");
  const rosterFileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, t, p, sp] = await Promise.all([
        db("rosters", { query: "?select=*,players(display_name),teams(name,abbreviation),splits(name)&order=created_at.desc" }),
        db("teams", { query: "?select=id,name,abbreviation&order=name" }),
        db("players", { query: "?select=id,display_name&is_active=eq.true&order=display_name" }),
        db("splits", { query: "?select=*&order=split_number" }),
      ]);
      setRosters(r || []); setTeams(t || []); setPlayers(p || []); setSplits(sp || []);
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.player_id || !form.team_id || !form.split_id) { toast("Player, team, and split required", "error"); return; }
    try { await db("rosters", { method: "POST", body: { ...form, role: form.role || null } }); toast("Assigned", "success"); setForm({ player_id: "", team_id: "", split_id: "", role: "", is_captain: false, is_starter: true }); load(); }
    catch (e) { toast(e.message, "error"); }
  };
  const del = async (id) => { if (!confirm("Remove?")) return; try { await db(`rosters?id=eq.${id}`, { method: "DELETE" }); toast("Removed", "success"); load(); } catch (e) { toast(e.message, "error"); } };

  // ── CSV Import ──
  const fuzzyMatch = (input, list, nameKey) => {
    if (!input) return null;
    const lower = input.trim().toLowerCase();
    // Exact match on name
    let match = list.find(item => (item[nameKey] || "").toLowerCase() === lower);
    if (match) return match;
    // Exact match on abbreviation (for teams)
    if (nameKey === "name") match = list.find(item => (item.abbreviation || "").toLowerCase() === lower);
    if (match) return match;
    // Partial match
    match = list.find(item => (item[nameKey] || "").toLowerCase().includes(lower) || lower.includes((item[nameKey] || "").toLowerCase()));
    return match || null;
  };

  const parseRosterCsv = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const rawHeaders = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
    const colMap = {};
    const aliases = {
      player: ["player", "player_name", "playername", "name", "display_name", "displayname", "summoner"],
      team: ["team", "team_name", "teamname"],
      role: ["role", "position", "lane"],
      captain: ["captain", "is_captain", "iscaptain", "cap"],
      starter: ["starter", "is_starter", "isstarter"],
    };
    for (const [field, names] of Object.entries(aliases)) {
      const idx = rawHeaders.findIndex(h => names.includes(h));
      if (idx !== -1) colMap[field] = idx;
    }
    if (colMap.player === undefined || colMap.team === undefined) return [];
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim());
      const playerName = cols[colMap.player] || "";
      const teamName = cols[colMap.team] || "";
      if (!playerName || !teamName) continue;
      const roleVal = colMap.role !== undefined ? (cols[colMap.role] || "").toLowerCase() : "";
      const captainVal = colMap.captain !== undefined ? cols[colMap.captain] || "" : "";
      const starterVal = colMap.starter !== undefined ? cols[colMap.starter] || "" : "";
      rows.push({
        player_name: playerName,
        team_name: teamName,
        role: roles.includes(roleVal) ? roleVal : "",
        is_captain: ["true", "yes", "1", "y", "c"].includes(captainVal.toLowerCase()),
        is_starter: starterVal === "" || ["true", "yes", "1", "y"].includes(starterVal.toLowerCase()),
        _player: null,
        _team: null,
        _error: null,
      });
    }
    return rows;
  };

  const resolveRows = (rows) => {
    return rows.map(r => {
      const player = fuzzyMatch(r.player_name, players, "display_name");
      const team = fuzzyMatch(r.team_name, teams, "name");
      return { ...r, _player: player, _team: team, _error: !player ? "Player not found" : !team ? "Team not found" : null };
    });
  };

  const handleRosterCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseRosterCsv(ev.target.result);
      if (rows.length === 0) { toast("No valid rows found. CSV needs 'player' and 'team' columns at minimum.", "error"); return; }
      setCsvRows(resolveRows(rows));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const importRosterCsv = async () => {
    if (!csvSplitId) { toast("Select a split for the import", "error"); return; }
    const valid = csvRows.filter(r => !r._error);
    if (valid.length === 0) { toast("No valid rows to import", "error"); return; }
    setCsvImporting(true);
    let added = 0, failed = 0;
    for (const row of valid) {
      try {
        await db("rosters", { method: "POST", body: {
          player_id: row._player.id,
          team_id: row._team.id,
          split_id: csvSplitId,
          role: row.role || null,
          is_captain: row.is_captain,
          is_starter: row.is_starter,
        }});
        added++;
      } catch { failed++; }
    }
    setCsvImporting(false);
    setCsvRows([]);
    toast(`Imported ${added} roster assignment${added !== 1 ? "s" : ""}${failed ? `, ${failed} failed` : ""}`, failed ? "error" : "success");
    load();
  };

  return (<div>
    <div style={S.card}>
      <div style={S.cardHeader}><span style={S.cardTitle}>ASSIGN PLAYER TO TEAM</span></div>
      <div style={S.cardBody}>
        <div style={S.row}>
          <div style={S.col}><label style={S.label}>Player</label><select style={S.select} value={form.player_id} onChange={e => setForm({ ...form, player_id: e.target.value })}><option value="">Select...</option>{players.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></div>
          <div style={S.col}><label style={S.label}>Team</label><select style={S.select} value={form.team_id} onChange={e => setForm({ ...form, team_id: e.target.value })}><option value="">Select...</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.abbreviation})</option>)}</select></div>
          <div style={S.col}><label style={S.label}>Split</label><select style={S.select} value={form.split_id} onChange={e => setForm({ ...form, split_id: e.target.value })}><option value="">Select...</option>{splits.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        </div>
        <div style={S.row}>
          <div style={S.col}><label style={S.label}>Role</label><select style={S.select} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="">No role</option>{roles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}</select></div>
          <div style={{ ...S.col, flexDirection: "row", alignItems: "flex-end", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}><input type="checkbox" checked={form.is_starter} onChange={e => setForm({ ...form, is_starter: e.target.checked })} /> Starter</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}><input type="checkbox" checked={form.is_captain} onChange={e => setForm({ ...form, is_captain: e.target.checked })} /> Captain</label>
          </div>
        </div>
        <button style={S.btnPrimary} onClick={save}>Assign to Roster</button>
      </div>
    </div>

    {/* Roster CSV Bulk Import */}
    <div style={S.card}>
      <div style={S.cardHeader}><span style={S.cardTitle}>BULK ROSTER IMPORT (CSV)</span></div>
      <div style={S.cardBody}>
        <div style={{ marginBottom: 12, fontSize: 12, color: "#888", lineHeight: 1.6 }}>
          Upload a <span style={{ ...S.mono, color: "#bbb" }}>.csv</span> with columns: <span style={{ ...S.mono, color: "#bbb" }}>player</span>, <span style={{ ...S.mono, color: "#bbb" }}>team</span>, <span style={{ ...S.mono, color: "#bbb" }}>role</span>, <span style={{ ...S.mono, color: "#bbb" }}>captain</span>, <span style={{ ...S.mono, color: "#bbb" }}>starter</span><br />
          Only <span style={{ ...S.mono, color: "#bbb" }}>player</span> and <span style={{ ...S.mono, color: "#bbb" }}>team</span> are required. Names are matched to existing players/teams. Select a split below before importing.
        </div>
        <div style={{ ...S.row, alignItems: "flex-end" }}>
          <div style={S.col}>
            <label style={S.label}>Split for Import</label>
            <select style={S.select} value={csvSplitId} onChange={e => setCsvSplitId(e.target.value)}>
              <option value="">Select split...</option>
              {splits.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={S.col}>
            <input ref={rosterFileRef} type="file" accept=".csv,text/csv" onChange={handleRosterCsvFile} style={{ display: "none" }} />
            <button style={S.btnSecondary} onClick={() => rosterFileRef.current?.click()}>Choose CSV File</button>
          </div>
        </div>

        {csvRows.length > 0 && (<div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "#bbb" }}>
              {csvRows.filter(r => !r._error).length} valid / {csvRows.length} total
              {csvRows.some(r => r._error) && <span style={{ color: "#ef4444", marginLeft: 8 }}>({csvRows.filter(r => r._error).length} with errors)</span>}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btnSecondary} onClick={() => setCsvRows([])}>Clear</button>
              <button style={{ ...S.btnPrimary, opacity: csvImporting || !csvSplitId ? 0.6 : 1 }} onClick={importRosterCsv} disabled={csvImporting || !csvSplitId}>
                {csvImporting ? "Importing..." : `Import ${csvRows.filter(r => !r._error).length} Assignments`}
              </button>
            </div>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #1a1a1a", borderRadius: 6 }}>
            <table style={S.table}>
              <thead><tr><th style={S.th}>#</th><th style={S.th}>Player</th><th style={S.th}>Team</th><th style={S.th}>Role</th><th style={S.th}>Flags</th><th style={S.th}>Status</th></tr></thead>
              <tbody>{csvRows.map((r, i) => (
                <tr key={i} style={{ opacity: r._error ? 0.5 : 1 }}>
                  <td style={{ ...S.td, ...S.mono }}>{i + 1}</td>
                  <td style={S.td}>
                    <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 500 }}>{r.player_name}</span>
                    {r._player && <span style={{ ...S.mono, color: "#555", marginLeft: 6 }}>→ {r._player.display_name}</span>}
                  </td>
                  <td style={S.td}>
                    <span>{r.team_name}</span>
                    {r._team && <span style={{ ...S.mono, color: "#555", marginLeft: 6 }}>→ {r._team.abbreviation}</span>}
                  </td>
                  <td style={S.td}>{r.role ? <span style={S.badge("#3b82f6")}>{r.role}</span> : <span style={{ color: "#333" }}>—</span>}</td>
                  <td style={S.td}><div style={{ display: "flex", gap: 4 }}>{r.is_starter && <span style={S.badge("#10b981")}>Starter</span>}{r.is_captain && <span style={S.badge("#f59e0b")}>Captain</span>}</div></td>
                  <td style={S.td}>{r._error ? <span style={{ color: "#ef4444", fontSize: 11 }}>{r._error}</span> : <span style={S.badge("#10b981")}>Ready</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>)}
      </div>
    </div>
    <div style={S.card}>
      <div style={S.cardHeader}><span style={S.cardTitle}>CURRENT ROSTERS ({rosters.length})</span></div>
      {rosters.length === 0 ? <div style={S.empty}>{loading ? "Loading..." : "No roster assignments."}</div> : (
        <table style={S.table}><thead><tr><th style={S.th}>Player</th><th style={S.th}>Team</th><th style={S.th}>Split</th><th style={S.th}>Role</th><th style={S.th}>Status</th><th style={S.th}></th></tr></thead>
          <tbody>{rosters.map(r => (
            <tr key={r.id}>
              <td style={{ ...S.td, fontFamily: "'Oswald', sans-serif", fontWeight: 500 }}>{r.players?.display_name}</td>
              <td style={S.td}>{r.teams?.name} <span style={S.mono}>({r.teams?.abbreviation})</span></td>
              <td style={S.td}>{r.splits?.name}</td>
              <td style={S.td}>{r.role ? <span style={S.badge("#3b82f6")}>{r.role}</span> : <span style={{ color: "#333" }}>—</span>}</td>
              <td style={S.td}><div style={{ display: "flex", gap: 4 }}>{r.is_starter && <span style={S.badge("#10b981")}>Starter</span>}{r.is_captain && <span style={S.badge("#f59e0b")}>Captain</span>}{!r.is_starter && <span style={S.badge("#ef4444")}>Sub</span>}</div></td>
              <td style={{ ...S.td, textAlign: "right" }}><button style={S.btnDanger} onClick={() => del(r.id)}>Remove</button></td>
            </tr>
          ))}</tbody></table>
      )}
    </div>
  </div>);
}

// ══════════════════════════════════════════════════════════
// DIVISIONS
// ══════════════════════════════════════════════════════════
function DivisionsTab({ seasons, toast, onRefresh }) {
  const [divisions, setDivisions] = useState([]);
  const [form, setForm] = useState({ name: "", season_id: "", sort_order: 0 });

  const load = useCallback(async () => { try { setDivisions(await db("divisions", { query: "?select=*,seasons(name)&order=sort_order" }) || []); } catch (e) { toast(e.message, "error"); } }, [toast]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name || !form.season_id) { toast("Name and season required", "error"); return; }
    try { await db("divisions", { method: "POST", body: form }); toast("Created", "success"); setForm({ name: "", season_id: "", sort_order: 0 }); load(); onRefresh(); }
    catch (e) { toast(e.message, "error"); }
  };
  const del = async (id) => { if (!confirm("Delete?")) return; try { await db(`divisions?id=eq.${id}`, { method: "DELETE" }); toast("Deleted", "success"); load(); onRefresh(); } catch (e) { toast(e.message, "error"); } };

  return (<div>
    <div style={S.card}>
      <div style={S.cardHeader}><span style={S.cardTitle}>ADD DIVISION</span></div>
      <div style={S.cardBody}>
        <div style={S.row}>
          <div style={S.col}><label style={S.label}>Name</label><input style={S.input} placeholder="Alpha" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div style={S.col}><label style={S.label}>Season</label><select style={S.select} value={form.season_id} onChange={e => setForm({ ...form, season_id: e.target.value })}><option value="">Select...</option>{seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div style={{ ...S.col, maxWidth: 100 }}><label style={S.label}>Order</label><input style={S.input} type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} /></div>
        </div>
        <button style={S.btnPrimary} onClick={save}>Add Division</button>
      </div>
    </div>
    <div style={S.card}>
      <div style={S.cardHeader}><span style={S.cardTitle}>DIVISIONS ({divisions.length})</span></div>
      {divisions.length === 0 ? <div style={S.empty}>No divisions yet.</div> : (
        <table style={S.table}><thead><tr><th style={S.th}>Name</th><th style={S.th}>Season</th><th style={S.th}>Order</th><th style={S.th}></th></tr></thead>
          <tbody>{divisions.map(d => (
            <tr key={d.id}>
              <td style={{ ...S.td, fontFamily: "'Oswald', sans-serif", fontWeight: 500 }}>{d.name}</td>
              <td style={S.td}>{d.seasons?.name}</td>
              <td style={{ ...S.td, ...S.mono }}>{d.sort_order}</td>
              <td style={{ ...S.td, textAlign: "right" }}><button style={S.btnDanger} onClick={() => del(d.id)}>Delete</button></td>
            </tr>
          ))}</tbody></table>
      )}
    </div>
  </div>);
}

// ══════════════════════════════════════════════════════════
// SEASONS
// ══════════════════════════════════════════════════════════
function SeasonsTab({ toast, onRefresh }) {
  const [seasons, setSeasons] = useState([]);
  const [splits, setSplits] = useState([]);
  const [sf, setSf] = useState({ name: "", is_active: true });
  const [spf, setSpf] = useState({ season_id: "", name: "", split_number: 1, is_active: true });

  const load = useCallback(async () => {
    try { const [se, sp] = await Promise.all([db("seasons", { query: "?select=*&order=created_at.desc" }), db("splits", { query: "?select=*,seasons(name)&order=split_number" })]); setSeasons(se || []); setSplits(sp || []); }
    catch (e) { toast(e.message, "error"); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const saveSeason = async () => { if (!sf.name) { toast("Name required", "error"); return; } try { await db("seasons", { method: "POST", body: sf }); toast("Created", "success"); setSf({ name: "", is_active: true }); load(); onRefresh(); } catch (e) { toast(e.message, "error"); } };
  const saveSplit = async () => { if (!spf.season_id || !spf.name) { toast("Season and name required", "error"); return; } try { await db("splits", { method: "POST", body: spf }); toast("Created", "success"); setSpf({ season_id: "", name: "", split_number: 1, is_active: true }); load(); onRefresh(); } catch (e) { toast(e.message, "error"); } };

  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>ADD SEASON</span></div>
        <div style={S.cardBody}>
          <label style={S.label}>Season Name</label>
          <input style={{ ...S.input, marginBottom: 12 }} placeholder="Season 2" value={sf.name} onChange={e => setSf({ ...sf, name: e.target.value })} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, marginBottom: 12 }}><input type="checkbox" checked={sf.is_active} onChange={e => setSf({ ...sf, is_active: e.target.checked })} /> Active</label>
          <button style={S.btnPrimary} onClick={saveSeason}>Add Season</button>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardHeader}><span style={S.cardTitle}>ADD SPLIT</span></div>
        <div style={S.cardBody}>
          <label style={S.label}>Season</label>
          <select style={{ ...S.select, marginBottom: 12 }} value={spf.season_id} onChange={e => setSpf({ ...spf, season_id: e.target.value })}><option value="">Select...</option>{seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <div style={S.row}>
            <div style={{ ...S.col, flex: 2 }}><label style={S.label}>Split Name</label><input style={S.input} placeholder="Split 2" value={spf.name} onChange={e => setSpf({ ...spf, name: e.target.value })} /></div>
            <div style={{ ...S.col, maxWidth: 80 }}><label style={S.label}>#</label><input style={S.input} type="number" value={spf.split_number} onChange={e => setSpf({ ...spf, split_number: parseInt(e.target.value) || 1 })} /></div>
          </div>
          <button style={{ ...S.btnPrimary, marginTop: 12 }} onClick={saveSplit}>Add Split</button>
        </div>
      </div>
    </div>
    <div style={{ ...S.card, marginTop: 16 }}>
      <div style={S.cardHeader}><span style={S.cardTitle}>SEASONS & SPLITS</span></div>
      {seasons.length === 0 ? <div style={S.empty}>No seasons yet.</div> : (
        <div style={S.cardBody}>{seasons.map(s => (
          <div key={s.id} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 500, color: "#e5e5e5" }}>{s.name}</span>
              <span style={S.badge(s.is_active ? "#10b981" : "#555")}>{s.is_active ? "Active" : "Inactive"}</span>
            </div>
            {splits.filter(sp => sp.season_id === s.id).map(sp => (
              <div key={sp.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0 6px 16px", borderLeft: "2px solid #1a1a1a" }}>
                <span style={{ fontSize: 13, color: "#bbb" }}>{sp.name}</span>
                <span style={S.badge(sp.is_active ? "#10b981" : "#555")}>{sp.is_active ? "Active" : "Inactive"}</span>
                <span style={S.mono}>#{sp.split_number}</span>
              </div>
            ))}
            {splits.filter(sp => sp.season_id === s.id).length === 0 && <div style={{ padding: "6px 16px", fontSize: 12, color: "#333" }}>No splits</div>}
          </div>
        ))}</div>
      )}
    </div>
  </div>);
}

// ══════════════════════════════════════════════════════════
// SCHEDULE
// ══════════════════════════════════════════════════════════
function ScheduleTab({ toast }) {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ team_blue_id: "", team_red_id: "", split_id: "", scheduled_at: "", match_format: "bo1", season_phase: "Regular" });
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, t, sp] = await Promise.all([
        db("matches", { query: "?select=*,team_blue:teams!matches_team_blue_id_fkey(id,name,abbreviation),team_red:teams!matches_team_red_id_fkey(id,name,abbreviation),splits(name)&order=scheduled_at.desc.nullslast,created_at.desc&limit=50" }),
        db("teams", { query: "?select=id,name,abbreviation&order=name" }),
        db("splits", { query: "?select=*&order=split_number" }),
      ]);
      setMatches(m || []); setTeams(t || []); setSplits(sp || []);
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.team_blue_id || !form.team_red_id || !form.split_id) { toast("Both teams and split required", "error"); return; }
    if (form.team_blue_id === form.team_red_id) { toast("Teams must be different", "error"); return; }
    const body = {
      team_blue_id: form.team_blue_id,
      team_red_id: form.team_red_id,
      split_id: form.split_id,
      match_format: form.match_format || "bo1",
      season_phase: form.season_phase || "Regular",
      status: "scheduled",
      scheduled_at: form.scheduled_at || null,
    };
    try {
      if (editing) { await db(`matches?id=eq.${editing}`, { method: "PATCH", body }); toast("Updated", "success"); }
      else { await db("matches", { method: "POST", body }); toast("Match scheduled", "success"); }
      setForm({ team_blue_id: "", team_red_id: "", split_id: "", scheduled_at: "", match_format: "bo1", season_phase: "Regular" }); setEditing(null); load();
    } catch (e) { toast(e.message, "error"); }
  };

  const del = async (id) => { if (!confirm("Delete this match?")) return; try { await db(`matches?id=eq.${id}`, { method: "DELETE" }); toast("Deleted", "success"); load(); } catch (e) { toast(e.message, "error"); } };
  const edit = (m) => { setEditing(m.id); setForm({ team_blue_id: m.team_blue_id || "", team_red_id: m.team_red_id || "", split_id: m.split_id || "", scheduled_at: m.scheduled_at ? m.scheduled_at.slice(0, 16) : "", match_format: m.match_format || "bo1", season_phase: m.season_phase || "Regular" }); };

  const statusColor = (s) => s === "completed" ? "#10b981" : s === "live" ? "#ef4444" : "#f59e0b";
  const scheduled = matches.filter(m => m.status === "scheduled");
  const completed = matches.filter(m => m.status === "completed");

  return (<div>
    <div style={S.card}>
      <div style={S.cardHeader}>
        <span style={S.cardTitle}>{editing ? "EDIT MATCH" : "SCHEDULE NEW MATCH"}</span>
        {editing && <button style={S.btnSecondary} onClick={() => { setEditing(null); setForm({ team_blue_id: "", team_red_id: "", split_id: "", scheduled_at: "", match_format: "bo1", season_phase: "Regular" }); }}>Cancel</button>}
      </div>
      <div style={S.cardBody}>
        <div style={S.row}>
          <div style={S.col}><label style={S.label}>Blue Side</label><select style={S.select} value={form.team_blue_id} onChange={e => setForm({ ...form, team_blue_id: e.target.value })}><option value="">Select team...</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.abbreviation})</option>)}</select></div>
          <div style={{ display: "flex", alignItems: "flex-end", padding: "0 8px 10px", fontSize: 13, color: "#555", fontFamily: "'Oswald', sans-serif" }}>VS</div>
          <div style={S.col}><label style={S.label}>Red Side</label><select style={S.select} value={form.team_red_id} onChange={e => setForm({ ...form, team_red_id: e.target.value })}><option value="">Select team...</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.abbreviation})</option>)}</select></div>
        </div>
        <div style={S.row}>
          <div style={S.col}><label style={S.label}>Split</label><select style={S.select} value={form.split_id} onChange={e => setForm({ ...form, split_id: e.target.value })}><option value="">Select split...</option>{splits.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div style={S.col}><label style={S.label}>Date & Time</label><input type="datetime-local" style={S.input} value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} /></div>
          <div style={{ ...S.col, maxWidth: 120 }}><label style={S.label}>Format</label><select style={S.select} value={form.match_format} onChange={e => setForm({ ...form, match_format: e.target.value })}><option value="bo1">Bo1</option><option value="bo3">Bo3</option><option value="bo5">Bo5</option></select></div>
          <div style={{ ...S.col, maxWidth: 140 }}><label style={S.label}>Phase</label><select style={S.select} value={form.season_phase} onChange={e => setForm({ ...form, season_phase: e.target.value })}><option value="Regular">Regular</option><option value="Playoffs">Playoffs</option></select></div>
        </div>
        <button style={S.btnPrimary} onClick={save}>{editing ? "Update Match" : "Schedule Match"}</button>
      </div>
    </div>

    {/* Upcoming */}
    <div style={S.card}>
      <div style={S.cardHeader}><span style={S.cardTitle}>UPCOMING MATCHES ({scheduled.length})</span></div>
      {scheduled.length === 0 ? <div style={S.empty}>{loading ? "Loading..." : "No upcoming matches."}</div> : (
        <table style={S.table}>
          <thead><tr><th style={S.th}>Blue</th><th style={S.th}></th><th style={S.th}>Red</th><th style={S.th}>Split</th><th style={S.th}>Date</th><th style={S.th}>Format</th><th style={S.th}></th></tr></thead>
          <tbody>{scheduled.map(m => (
            <tr key={m.id}>
              <td style={{ ...S.td, fontFamily: "'Oswald', sans-serif", fontWeight: 500, color: "#3b82f6" }}>{m.team_blue?.name || "TBD"}</td>
              <td style={{ ...S.td, color: "#333", textAlign: "center", fontSize: 11 }}>vs</td>
              <td style={{ ...S.td, fontFamily: "'Oswald', sans-serif", fontWeight: 500, color: "#ef4444" }}>{m.team_red?.name || "TBD"}</td>
              <td style={S.td}>{m.splits?.name || "—"}</td>
              <td style={{ ...S.td, ...S.mono }}>{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "TBD"}</td>
              <td style={{ ...S.td, ...S.mono }}>{(m.match_format || "bo1").toUpperCase()}</td>
              <td style={{ ...S.td, textAlign: "right" }}>
                <button style={{ ...S.btnSecondary, padding: "6px 12px", fontSize: 11, marginRight: 6 }} onClick={() => edit(m)}>Edit</button>
                <button style={S.btnDanger} onClick={() => del(m.id)}>Delete</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>

    {/* Completed */}
    <div style={S.card}>
      <div style={S.cardHeader}><span style={S.cardTitle}>COMPLETED MATCHES ({completed.length})</span></div>
      {completed.length === 0 ? <div style={S.empty}>No completed matches yet.</div> : (
        <table style={S.table}>
          <thead><tr><th style={S.th}>Blue</th><th style={S.th}>Score</th><th style={S.th}>Red</th><th style={S.th}>Winner</th><th style={S.th}>Split</th><th style={S.th}>Date</th></tr></thead>
          <tbody>{completed.map(m => {
            const bWin = m.winner_team_id === m.team_blue?.id;
            const rWin = m.winner_team_id === m.team_red?.id;
            return (<tr key={m.id}>
              <td style={{ ...S.td, fontFamily: "'Oswald', sans-serif", fontWeight: 500, color: bWin ? "#10b981" : "#888" }}>{m.team_blue?.name || "?"}</td>
              <td style={{ ...S.td, ...S.mono, textAlign: "center" }}>{m.score_blue ?? 0} - {m.score_red ?? 0}</td>
              <td style={{ ...S.td, fontFamily: "'Oswald', sans-serif", fontWeight: 500, color: rWin ? "#10b981" : "#888" }}>{m.team_red?.name || "?"}</td>
              <td style={S.td}><span style={S.badge("#10b981")}>{bWin ? m.team_blue?.abbreviation : rWin ? m.team_red?.abbreviation : "—"}</span></td>
              <td style={S.td}>{m.splits?.name || "—"}</td>
              <td style={{ ...S.td, ...S.mono }}>{m.completed_at ? new Date(m.completed_at).toLocaleDateString([], { month: "short", day: "numeric" }) : "—"}</td>
            </tr>);
          })}</tbody>
        </table>
      )}
    </div>
  </div>);
}

// ══════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════
export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState("Teams");
  const [toastMsg, setToastMsg] = useState(null);
  const [toastType, setToastType] = useState("success");
  const [seasons, setSeasons] = useState([]);
  const [divisions, setDivisions] = useState([]);

  const toast = useCallback((msg, type = "success") => { setToastMsg(msg); setToastType(type); }, []);

  useEffect(() => { if (Auth.getSession() && Auth.isAdmin()) setAuthed(true); setChecking(false); }, []);

  const loadGlobals = useCallback(async () => {
    try { const [se, di] = await Promise.all([db("seasons", { query: "?select=*&order=created_at.desc" }), db("divisions", { query: "?select=*&order=sort_order" })]); setSeasons(se || []); setDivisions(di || []); }
    catch (e) { console.error(e); }
  }, []);
  useEffect(() => { if (authed) loadGlobals(); }, [authed, loadGlobals]);

  if (checking) return <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#333" }}>Loading...</span></div>;

  return (<div>
    {!authed ? (
      <LoginScreen onLogin={() => { setAuthed(true); toast("Welcome, admin"); }} toast={toast} />
    ) : (
      <div style={S.page}>
        <div style={S.topBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚔️</span>
            <span style={S.brand}>INHOUSE<span style={S.accent}>LEAGUE</span></span>
            <span style={{ ...S.badge("#c2185b"), marginLeft: 8 }}>ADMIN</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 12, color: "#666" }}>{Auth.getUser()?.email}</span>
            <button onClick={() => { Auth.signOut(); setAuthed(false); toast("Signed out"); }} style={{ ...S.btnSecondary, padding: "6px 14px", fontSize: 11 }}>Sign Out</button>
          </div>
        </div>
        <div style={S.content}>
          <AdminTabs active={tab} setActive={setTab} />
          {tab === "Teams" && <TeamsTab seasons={seasons} divisions={divisions} toast={toast} />}
          {tab === "Players" && <PlayersTab toast={toast} />}
          {tab === "Rosters" && <RostersTab toast={toast} />}
          {tab === "Schedule" && <ScheduleTab toast={toast} />}
          {tab === "Divisions" && <DivisionsTab seasons={seasons} toast={toast} onRefresh={loadGlobals} />}
          {tab === "Seasons" && <SeasonsTab toast={toast} onRefresh={loadGlobals} />}
        </div>
      </div>
    )}
    <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg(null)} />
  </div>);
}
