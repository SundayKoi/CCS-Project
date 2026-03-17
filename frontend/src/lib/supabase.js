// ── Supabase Client ──────────────────────────────────────
// Uses environment variables from .env
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ── Auth Module ──────────────────────────────────────────
export const Auth = {
  _session: null,

  async signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error_description || err.msg || "Login failed");
    }
    const data = await res.json();
    Auth._session = data;
    sessionStorage.setItem("sb_session", JSON.stringify(data));
    return data;
  },

  signOut() {
    Auth._session = null;
    sessionStorage.removeItem("sb_session");
  },

  getSession() {
    if (Auth._session) return Auth._session;
    const stored = sessionStorage.getItem("sb_session");
    if (stored) { Auth._session = JSON.parse(stored); return Auth._session; }
    return null;
  },

  getToken() {
    return Auth.getSession()?.access_token || null;
  },

  getUser() {
    return Auth.getSession()?.user || null;
  },

  isAdmin() {
    const user = Auth.getUser();
    return user?.app_metadata?.role === "admin";
  },

  async refresh() {
    const session = Auth.getSession();
    if (!session?.refresh_token) return null;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) { Auth.signOut(); return null; }
    const data = await res.json();
    Auth._session = data;
    sessionStorage.setItem("sb_session", JSON.stringify(data));
    return data;
  },
};

// ── REST Client ──────────────────────────────────────────
export async function db(table, { method = "GET", body, query = "", headers = {} } = {}) {
  const token = Auth.getToken() || SUPABASE_ANON_KEY;
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : method === "PATCH" ? "return=representation" : "",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    const refreshed = await Auth.refresh();
    if (refreshed) return db(table, { method, body, query, headers });
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
