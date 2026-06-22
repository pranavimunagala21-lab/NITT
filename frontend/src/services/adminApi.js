// ─── localStorage keys ───────────────────────────────────────────────────────
export const LS_USERS    = "users";
export const LS_WEBSITES = "websites";
export const LS_AI_LOG   = "ls_ai_log";

const API_URL = "http://127.0.0.1:8000";

// ─── Safe date helpers — NEVER assumes type ───────────────────────────────────
/**
 * Converts any date value (ISO string, unix float, Date, null) → "YYYY-MM-DD" or ""
 */
const getDateOnly = (value) => {
  if (!value && value !== 0) return "";
  try {
    if (typeof value === "string" && value.length >= 10) {
      // Already an ISO string — just take the date part
      return value.slice(0, 10);
    }
    if (typeof value === "number") {
      // Unix timestamp (seconds)
      return new Date(value * 1000).toISOString().slice(0, 10);
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
  } catch {
    return "";
  }
};

/**
 * Converts any date value → human-readable relative string
 */
const relativeTime = (value) => {
  if (!value && value !== 0) return "—";
  try {
    let ms;
    if (typeof value === "number") {
      ms = value * 1000;
    } else if (typeof value === "string") {
      ms = new Date(value).getTime();
    } else if (value instanceof Date) {
      ms = value.getTime();
    } else {
      return "—";
    }
    if (isNaN(ms)) return "—";
    const diff = (Date.now() - ms) / 1000;
    if (diff < 60)    return "Just now";
    if (diff < 3600)  return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hrs ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  } catch {
    return "—";
  }
};

// ─── Auth headers ─────────────────────────────────────────────────────────────
const authHdr = () => {
  const h = { "Content-Type": "application/json" };
  const t = localStorage.getItem("token");
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
};

// ─── localStorage readers ─────────────────────────────────────────────────────
export const readUsers    = () => { try { return JSON.parse(localStorage.getItem(LS_USERS)    || "[]"); } catch { return []; } };
export const readWebsites = () => { try { return JSON.parse(localStorage.getItem(LS_WEBSITES) || "[]"); } catch { return []; } };
export const readAiLog    = () => { try { return JSON.parse(localStorage.getItem(LS_AI_LOG)   || "[]"); } catch { return []; } };

// ─── Writers ─────────────────────────────────────────────────────────────────
export const trackUser = (user) => {
  if (!user?.email) return;
  const users  = readUsers();
  const exists = users.find((u) => u.email === user.email);
  if (!exists) {
    users.push({
      id:           user.id    || Date.now(),
      name:         user.name  || "User",
      email:        user.email,
      language:     user.language || "en",
      role:         user.role  || "user",
      websites:     0,
      registeredAt: new Date().toISOString(),
      lastActive:   new Date().toISOString(),
    });
  } else {
    exists.lastActive = new Date().toISOString();
    if (user.role) exists.role = user.role;
  }
  localStorage.setItem(LS_USERS, JSON.stringify(users));
};

export const trackWebsite = (website) => {
  if (!website) return;
  const sites  = readWebsites();
  const exists = sites.find((s) => String(s.id) === String(website.id));
  if (!exists) {
    sites.push({
      id:           website.id       || Date.now(),
      title:        website.title    || "Untitled",
      template:     website.template || "basic",
      userEmail:    website.userEmail || "",
      createdAt:    new Date().toISOString(),
      is_published: website.is_published || false,
    });
  } else {
    if (website.title        !== undefined) exists.title        = website.title;
    if (website.is_published !== undefined) exists.is_published = website.is_published;
  }
  localStorage.setItem(LS_WEBSITES, JSON.stringify(sites));

  const users = readUsers();
  const u = users.find((u) => u.email === website.userEmail);
  if (u) u.websites = sites.filter((s) => s.userEmail === website.userEmail).length;
  localStorage.setItem(LS_USERS, JSON.stringify(users));
};

export const trackAiRequest = (email, action = "general") => {
  const log = readAiLog();
  log.push({ email: email || "", action, ts: new Date().toISOString() });
  localStorage.setItem(LS_AI_LOG, JSON.stringify(log));
};

// ─── Utility: last 7 calendar dates ──────────────────────────────────────────
function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      dateStr: d.toISOString().slice(0, 10),
      label:   d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
  });
}

// ─── Stats — from backend (falls back to localStorage) ────────────────────────
export const getStats = async () => {
  try {
    const res = await fetch(`${API_URL}/admin/stats`, { headers: authHdr() });
    if (res.ok) {
      const d = await res.json();
      const local  = readUsers();
      const aiLog  = readAiLog();
      const now    = Date.now();
      const active = local.filter(
        (u) => u.lastActive && (now - new Date(u.lastActive).getTime()) < 86400000
      ).length;
      return {
        totalUsers:      d.total_users      ?? local.length,
        totalWebsites:   d.total_projects   ?? readWebsites().length,
        totalAiRequests: aiLog.length,
        activeUsers24h:  active,
      };
    }
  } catch { /* fall through */ }
  // localStorage fallback
  const users    = readUsers();
  const websites = readWebsites();
  const aiLog    = readAiLog();
  const now      = Date.now();
  return {
    totalUsers:      users.length,
    totalWebsites:   websites.length,
    totalAiRequests: aiLog.length,
    activeUsers24h:  users.filter(
      (u) => u.lastActive && (now - new Date(u.lastActive).getTime()) < 86400000
    ).length,
  };
};

// ─── Charts — last 7 days ─────────────────────────────────────────────────────
export const getUsersGrowth = async () => {
  const users = readUsers();
  return getLast7Days().map(({ label, dateStr }) => ({
    date:  label,
    users: users.filter((u) => getDateOnly(u.registeredAt) === dateStr).length,
  }));
};

export const getWebsitesPerDay = async () => {
  const sites = readWebsites();
  return getLast7Days().map(({ label, dateStr }) => ({
    date:  label,
    count: sites.filter((s) => getDateOnly(s.createdAt) === dateStr).length,
  }));
};

export const getAiUsageDistribution = async () => {
  const log = readAiLog();
  if (!log.length) return [];
  const counts = {};
  log.forEach((e) => { const k = e.action || "general"; counts[k] = (counts[k] || 0) + 1; });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
};

// ─── Users table — backend first, localStorage fallback ──────────────────────
export const getUsers = async () => {
  try {
    const res = await fetch(`${API_URL}/admin/users`, { headers: authHdr() });
    if (res.ok) {
      const data = await res.json();
      // Backend returns { total_users, users: [...] }
      const list = Array.isArray(data) ? data : (data.users || []);
      return list.map((u) => ({
        id:         String(u.id     || u._id || ""),
        name:       u.name          || "User",
        email:      u.email         || "",
        language:   u.language      || "en",
        role:       u.is_admin      ? "admin" : (u.role || "user"),
        websites:   u.project_count ?? 0,
        // Always use getDateOnly — never .startsWith directly
        registeredAt: getDateOnly(u.created_at),
        lastActive:   "—",
      }));
    }
  } catch { /* fall through */ }
  // localStorage fallback
  return readUsers().map((u) => ({
    ...u,
    registeredAt: getDateOnly(u.registeredAt),
    lastActive:   relativeTime(u.lastActive),
  }));
};

// ─── Delete user — backend first, localStorage fallback ──────────────────────
export const deleteUserBackend = async (userId) => {
  try {
    const res = await fetch(`${API_URL}/admin/delete-user/${userId}`, {
      method: "DELETE", headers: authHdr(),
    });
    if (res.ok) return;
  } catch { /* fall through */ }
  const users  = readUsers();
  const target = users.find((u) => String(u.id) === String(userId));
  localStorage.setItem(LS_USERS, JSON.stringify(users.filter((u) => String(u.id) !== String(userId))));
  if (target) {
    const sites = readWebsites().filter((s) => s.userEmail !== target.email);
    localStorage.setItem(LS_WEBSITES, JSON.stringify(sites));
  }
};

// ─── Feedback ─────────────────────────────────────────────────────────────────
export const getFeedback = async () =>
  JSON.parse(localStorage.getItem("feedback") || "[]");

// ─── Activity feed ────────────────────────────────────────────────────────────
export const getActivity = async () => {
  const sites  = readWebsites().slice(-6).reverse();
  const aiLogs = readAiLog().slice(-6).reverse();
  const users  = readUsers();
  const nameFor = (email) => users.find((u) => u.email === email)?.name || email || "User";

  const items = [
    ...sites.map((s)    => ({ id: `w-${s.id}`,  icon: "🌐", text: `${nameFor(s.userEmail)} created "${s.title}"`,         ts: s.createdAt })),
    ...aiLogs.map((a, i) => ({ id: `a-${i}`,    icon: "🤖", text: `${nameFor(a.email)} used AI (${a.action || "general"})`, ts: a.ts       })),
  ]
    .filter((item) => item.ts)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, 10)
    .map((item) => ({ ...item, time: relativeTime(item.ts) }));

  return items.length ? items : [{ id: 0, icon: "💤", text: "No activity yet.", time: "" }];
};
