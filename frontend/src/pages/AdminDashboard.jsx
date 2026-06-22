import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import StatsCard from "../components/StatsCard";
import { UsersLineChart, WebsitesBarChart, AiPieChart } from "../components/Charts";
import UsersTable from "../components/UsersTable";
import FeedbackList from "../components/FeedbackList";
import {
  getStats, getUsersGrowth, getWebsitesPerDay,
  getAiUsageDistribution, getUsers, getFeedback, deleteUserBackend,
} from "../services/adminApi";
import "./AdminDashboard.css";

// ─── AI Assistant (improved) ──────────────────────────────────────────────────
const AI_CACHE = new Map();

const INTENT_PRESETS = [
  { label: "🔵 Make buttons visible",   intent: "improve_ui",   section: "buttons",  goal: "visibility"   },
  { label: "📏 Fix layout overflow",    intent: "fix_layout",   section: "container",goal: "no-overflow"  },
  { label: "🔤 Improve headings",       intent: "increase_font",section: "headings", goal: "readability"  },
  { label: "🎨 Make it colorful",       intent: "change_color", section: "all",      goal: "vibrant"      },
  { label: "📐 Center all text",        intent: "align_text",   section: "all",      goal: "center"       },
  { label: "✍️ Rewrite About section",  intent: "improve_text", section: "about",    goal: "professional" },
];

// eslint-disable-next-line no-unused-vars
function AiAssistantPanel({ previewRef, html, onHtmlUpdate }) {
  const [messages, setMessages]       = useState([
    { role: "bot", text: "Hi! Select a preset or describe what to improve." },
  ]);
  const [input,  setInput]            = useState("");
  const [loading, setLoading]         = useState(false);
  const [history, setHistory]         = useState([]);          // for undo
  const bottomRef = useRef(null);
  const debounceRef = useRef(null);
  const pendingRef  = useRef(false);

  const API_URL = "http://127.0.0.1:8000";
  const getToken = () => localStorage.getItem("token");
  const authH = () => ({
    "Content-Type": "application/json",
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addBot = (text) =>
    setMessages((m) => m.filter((x) => !x.loading).concat({ role: "bot", text }));

  const send = useCallback(async (commandOrPreset) => {
    if (loading || pendingRef.current) return;

    let command = "";
    let context = "";
    if (typeof commandOrPreset === "object") {
      const { intent, section, goal } = commandOrPreset;
      command = `${intent} on ${section} for ${goal}`;
      context = JSON.stringify({ intent, section, goal });
    } else {
      command = (commandOrPreset || input).trim();
      if (!command) return;
    }
    setInput("");

    // Deduplicate — don't send the same command twice in a row
    const cacheKey = command.toLowerCase().trim();
    if (AI_CACHE.has(cacheKey)) {
      setMessages((m) => [...m, { role: "user", text: command }]);
      const cached = AI_CACHE.get(cacheKey);
      setMessages((m) => [...m, { role: "bot", text: `✅ (cached) ${cached.label}` }]);
      if (previewRef?.current) applyActionToDOM(cached, previewRef.current, setHistory);
      return;
    }

    setMessages((m) => [...m, { role: "user", text: command }]);
    setMessages((m) => [...m, { role: "bot", text: "⏳ Thinking…", loading: true }]);
    setLoading(true);
    pendingRef.current = true;

    try {
      const res = await fetch(`${API_URL}/edit-with-ai`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ command, context }),
      });
      if (!res.ok) { addBot("⚠️ Try a simpler instruction."); return; }
      const data = await res.json();

      if (!data.action || data.action === "none") {
        addBot(`💡 ${data.message || "Try: make text bigger, change color, improve about section"}`);
        return;
      }
      // Cache result
      AI_CACHE.set(cacheKey, data);

      if (data.action === "improve_text") {
        addBot(`✅ Text improvement applied to ${data.target || "section"}.`);
      } else {
        const ok = previewRef?.current
          ? applyActionToDOM(data, previewRef.current, setHistory)
          : false;
        addBot(ok
          ? `✅ ${data.action.replace(/_/g, " ")} applied on ${data.target}.`
          : "⚠️ Could not find elements to change."
        );
      }
    } catch {
      addBot("⚠️ Unable to reach the server.");
    } finally {
      setLoading(false);
      pendingRef.current = false;
    }
  }, [loading, input, previewRef]); // eslint-disable-line

  // Debounced send on input Enter
  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => send(), 300);
  };

  const handleUndo = () => {
    if (!history.length || !previewRef?.current) return;
    const last = history[history.length - 1];
    last.elements.forEach(({ el, prop, prev }) => { el.style[prop] = prev; });
    setHistory((h) => h.slice(0, -1));
    setMessages((m) => [...m, { role: "bot", text: "↩️ Last change undone." }]);
  };

  const handleAutoFix = () => {
    const fixes = [
      { label: "🔵 Make buttons visible",   intent: "improve_ui",   section: "buttons",  goal: "visibility"  },
      { label: "📏 Fix layout",             intent: "fix_layout",   section: "container",goal: "no-overflow" },
    ];
    fixes.forEach((f) => send(f));
    setMessages((m) => [...m, { role: "bot", text: "🔧 Auto-fix applied." }]);
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <span>🧠 AI Assistant</span>
        <div className="ai-header-actions">
          <button className="ai-btn ai-btn-fix"   onClick={handleAutoFix}  disabled={loading}>🔧 Auto Fix</button>
          <button className="ai-btn ai-btn-undo"  onClick={handleUndo}     disabled={!history.length}>↩️ Undo</button>
        </div>
      </div>

      <div className="ai-messages" role="log">
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role === "user" ? "ai-user" : "ai-bot"}${m.loading ? " ai-loading" : ""}`}>
            {m.loading
              ? <span className="ai-dots"><span/><span/><span/></span>
              : m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="ai-presets">
        {INTENT_PRESETS.map((p) => (
          <button key={p.label} className="ai-preset" onClick={() => send(p)} disabled={loading}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="ai-input-row">
        <input
          className="ai-input"
          placeholder="Or type freely: make headings blue…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button className="ai-send" onClick={() => send()} disabled={loading || !input.trim()}>
          {loading ? <span className="ai-dots sm"><span/><span/><span/></span> : "➤"}
        </button>
      </div>
    </div>
  );
}

// Apply action to live DOM, track for undo
function applyActionToDOM(data, container, setHistory) {
  const { action: act, target, value } = data;
  const sel = {
    headings: "h1,h2,h3",
    about:    ".about-text,#about h2,#about p",
    services: ".service-card,.menu-name",
    contact:  ".contact-info,#contact h2",
    buttons:  ".btn",
    all:      "h1,h2,p,.about-text,.service-card,.contact-info,.editable",
    text:     "p,.about-text,.contact-info",
  }[target] || "h1,h2,p,.about-text,.service-card,.contact-info";

  const els = Array.from(container.querySelectorAll(sel)).filter((e) => e.tagName !== "A");
  if (!els.length) return false;

  const snapshot = [];
  const record = (el, prop, prev) => snapshot.push({ el, prop, prev });

  switch (act) {
    case "change_color":
      els.forEach((el) => { record(el, "color", el.style.color); el.style.color = value || "#2563eb"; });
      break;
    case "change_background": {
      const sections = new Set();
      els.forEach((el) => {
        let t = el;
        while (t && !t.classList.contains("section-box") && t !== container) t = t.parentElement;
        if (t && t !== container) sections.add(t);
      });
      [...sections].forEach((s) => { record(s, "backgroundColor", s.style.backgroundColor); s.style.backgroundColor = value || "#f0f4ff"; });
      break;
    }
    case "increase_font":
      els.forEach((el) => {
        const cur = parseFloat(window.getComputedStyle(el).fontSize) || 13;
        record(el, "fontSize", el.style.fontSize);
        el.style.fontSize = `${Math.min(cur + 3, 48)}px`;
      });
      break;
    case "decrease_font":
      els.forEach((el) => {
        const cur = parseFloat(window.getComputedStyle(el).fontSize) || 13;
        record(el, "fontSize", el.style.fontSize);
        el.style.fontSize = `${Math.max(cur - 2, 9)}px`;
      });
      break;
    case "align_text":
      els.forEach((el) => { record(el, "textAlign", el.style.textAlign); el.style.textAlign = value || "center"; });
      break;
    default: return false;
  }

  if (snapshot.length) setHistory((h) => [...h, { elements: snapshot }]);
  return true;
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats,                 setStats]               = useState(null);
  const [usersGrowth,           setUG]                  = useState([]);
  const [webPerDay,             setWPD]                 = useState([]);
  const [aiUsageDistribution,  setAiUsageDist]         = useState([]);
  const [users,                 setUsers]               = useState([]);
  const [feedback,              setFeedback]            = useState([]);
  const [deletingUserId,        setDeletingUserId]      = useState("");

  const loadDashboardData = useCallback(() => {
    Promise.all([
      getStats(),
      getUsersGrowth(),
      getWebsitesPerDay(),
      getAiUsageDistribution(),
      getUsers(),
      getFeedback(),
    ]).then(([s, ug, wpd, aiDist, u, fb]) => {
      setStats(s);
      setUG(ug);
      setWPD(wpd);
      setAiUsageDist(aiDist);
      setUsers(u);
      setFeedback(fb);
    });
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Delete ${user.name}? This removes the user and all saved projects.`)) return;
    setDeletingUserId(user.id);
    try {
      await deleteUserBackend(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      loadDashboardData();
    } catch {
      window.alert("Could not delete the user.");
    } finally {
      setDeletingUserId("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userLanguage");
    localStorage.removeItem("userRole");
    navigate("/login");
  };

  const STATS_CONFIG = stats ? [
    { icon: "👤", label: "Total Users",         value: stats.totalUsers,       color: "#4a6cf7" },
    { icon: "🌐", label: "Websites Created",    value: stats.totalWebsites,    color: "#6366f1" },
    { icon: "🤖", label: "AI Requests",         value: stats.totalAiRequests,  color: "#f97316" },
    { icon: "⚡", label: "Active (last 24h)",   value: stats.activeUsers24h,   color: "#16a34a" },
  ] : [];

  return (
    <div className="admin-container">
      <header className="admin-header-main">
        <div className="admin-header-title">
          <span className="admin-logo">🏗️</span>
          <div>
            <h1 className="admin-heading">NIT Trichy Website Builder — Admin Panel</h1>
            <p className="admin-subheading">Manage users, websites, AI, and feedback</p>
          </div>
        </div>
        <button className="admin-logout-btn" onClick={handleLogout}>
          Logout ⮞
        </button>
      </header>

      <main className="admin-content-main">
        {/* Stats Cards */}
        <section className="admin-section">
          <div className="stats-grid">
            {STATS_CONFIG.map((s) => (
              <StatsCard key={s.label} {...s} />
            ))}
          </div>
        </section>

        {/* Charts */}
        <section className="admin-section">
          <h2 className="admin-section-title">📊 Analytics Overview</h2>
          <div className="charts-grid">
            <UsersLineChart data={usersGrowth} />
            <WebsitesBarChart data={webPerDay} />
            <AiPieChart data={aiUsageDistribution} />
          </div>
        </section>

        {/* Users Data */}
        <section className="admin-section">
          <h2 className="admin-section-title">👥 Registered Users</h2>
          <UsersTable users={users} onDeleteUser={handleDeleteUser} deletingUserId={deletingUserId} />
        </section>

        {/* Feedback Section */}
        <section className="admin-section">
          <h2 className="admin-section-title">💬 Feedback Section</h2>
          <FeedbackList feedback={feedback} />
        </section>
      </main>
    </div>
  );
}

