import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import tinycolor from "tinycolor2";
import "./App.css";
import AdminDashboard from "./pages/AdminDashboard";
import { trackUser, trackWebsite, trackAiRequest } from "./services/adminApi";

const API_URL = "http://127.0.0.1:8000";
const HTML_STORAGE_KEY = "generatedWebsiteHtml";

// ─── Template mini-preview HTML snippets ─────────────────────────────────────
const TEMPLATE_PREVIEWS = {
  generic: `<!DOCTYPE html><html><head><style>
    *{box-sizing:border-box;margin:0;padding:0} body{font-family:Inter,Arial,sans-serif;background:#eef4ff;color:#102446;font-size:11px;height:100%;overflow:hidden}
    .wrap{display:grid;grid-template-rows:38px 1fr 1fr;height:100vh;gap:4px;padding:4px}
    .nav,.hero,.panel{border-radius:10px}
    .nav{display:flex;align-items:center;justify-content:space-between;background:#fff;padding:0 8px;border:1px solid #dbe7ff}
    .hero{display:flex;align-items:center;justify-content:center;text-align:center;background:linear-gradient(135deg,#1846b4,#2d6df7);color:#fff}
    .hero h1{font-size:15px;font-weight:800}.hero p{font-size:8px;opacity:.88}
    .bottom{display:grid;grid-template-columns:1.1fr .9fr;gap:4px}
    .panel{background:#fff;border:1px solid #dbe7ff;padding:7px}
    .about{display:grid;grid-template-columns:1fr .8fr;gap:5px}
    .img{background:#d9e6ff;border-radius:8px}
    .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:5px}
    .card{background:#f5f9ff;border:1px solid #dbe7ff;border-radius:8px;padding:5px;font-size:7px}
  </style></head><body><div class="wrap"><div class="nav"><strong>NIT Builder</strong><span>Clean Business</span></div><div class="hero"><div><h1>Your Business</h1><p>Minimal, credible, startup-ready.</p></div></div><div class="bottom"><div class="panel about"><div><strong style="font-size:8px;color:#2d6df7">ABOUT</strong><p style="font-size:7px;color:#5e7393;margin-top:4px">Clear copy on the left with a supporting image on the right.</p></div><div class="img"></div></div><div class="panel"><strong style="font-size:8px;color:#2d6df7">SERVICES</strong><div class="cards"><div class="card">Service 1</div><div class="card">Service 2</div><div class="card">Service 3</div></div></div></div></div></body></html>`,
  modern: `<!DOCTYPE html><html><head><style>
    *{box-sizing:border-box;margin:0;padding:0} body{font-family:'Plus Jakarta Sans',Arial,sans-serif;background:linear-gradient(135deg,#5f30ff,#ff50b4 70%,#ff946b);color:#fff;font-size:11px;height:100%;overflow:hidden}
    .wrap{display:grid;grid-template-rows:38px 1fr 64px;height:100vh;gap:4px;padding:4px}
    .top,.hero,.row,.cta{border-radius:12px}
    .top{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.14);padding:0 8px;border:1px solid rgba(255,255,255,.2)}
    .hero{display:grid;grid-template-columns:1fr .9fr;gap:4px}
    .left,.right,.features,.cta{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18)}
    .left,.right,.features,.cta{border-radius:12px;padding:8px}
    .left h1{font-size:15px;line-height:.95;margin:4px 0}.left p{font-size:7px;color:rgba(255,255,255,.8)}
    .right{background:rgba(255,255,255,.16)}
    .features{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
    .f{background:rgba(255,255,255,.11);border-radius:9px;padding:5px;font-size:7px}
    .cta{display:flex;align-items:center;justify-content:space-between}
    .btn{background:#fff;color:#1a123e;padding:5px 9px;border-radius:999px;font-size:7px;font-weight:800}
  </style></head><body><div class="wrap"><div class="top"><strong>SaaS Mode</strong><span>Gradient + Glass</span></div><div class="hero"><div class="left"><div style="font-size:7px;letter-spacing:.12em;text-transform:uppercase">Modern</div><h1>Your Business</h1><p>Left text, right visual, premium product feel.</p></div><div class="right"></div></div><div style="display:grid;grid-template-columns:1.1fr .9fr;gap:4px"><div class="features"><div class="f">Feature 1</div><div class="f">Feature 2</div><div class="f">Feature 3</div></div><div class="cta"><span style="font-size:8px">Big CTA</span><span class="btn">Book Demo</span></div></div></div></body></html>`,
  luxury: `<!DOCTYPE html><html><head><style>
    *{box-sizing:border-box;margin:0;padding:0} body{font-family:'Cormorant Garamond',Georgia,serif;background:#070707;color:#f5efe6;font-size:11px;height:100%;overflow:hidden}
    .wrap{display:grid;grid-template-rows:24px 1fr 70px 90px;height:100vh;gap:4px;padding:4px;background:linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.8))}
    .line,.hero,.about,.services{border-radius:10px}
    .line{display:flex;align-items:center;justify-content:center;color:#d0ac6e;font-size:7px;letter-spacing:.25em;text-transform:uppercase}
    .hero{display:flex;align-items:center;justify-content:center;text-align:center;border:1px solid rgba(208,172,110,.18)}
    .hero h1{font-size:18px;line-height:.88;letter-spacing:.08em;text-transform:uppercase}
    .hero p{font-size:8px;color:#d0ac6e;letter-spacing:.16em;text-transform:uppercase}
    .about{display:flex;align-items:center;justify-content:center;text-align:center;padding:0 18px;color:rgba(245,239,230,.76);border-top:1px solid rgba(208,172,110,.14);border-bottom:1px solid rgba(208,172,110,.14)}
    .services{display:grid;grid-template-columns:.45fr 1fr;gap:6px;align-items:start}
    .list{display:grid;gap:3px}
    .item{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(208,172,110,.12);font-size:7px;text-transform:uppercase;letter-spacing:.12em;font-family:Manrope,Arial,sans-serif}
  </style></head><body><div class="wrap"><div class="line">Luxury Brand Presentation</div><div class="hero"><div><h1>Your Business</h1><p>Elegant. Premium. Timeless.</p></div></div><div class="about">Centered editorial copy with generous spacing and restraint.</div><div class="services"><div style="color:#d0ac6e;font-size:8px;letter-spacing:.2em;text-transform:uppercase;font-family:Manrope,Arial,sans-serif">Services</div><div class="list"><div class="item"><span>01</span><span>Service 1</span></div><div class="item"><span>02</span><span>Service 2</span></div><div class="item"><span>03</span><span>Service 3</span></div></div></div></div></body></html>`,
  creative: `<!DOCTYPE html><html><head><style>
    *{box-sizing:border-box;margin:0;padding:0} body{font-family:'Plus Jakarta Sans',Arial,sans-serif;background:#0d1117;color:#fff;font-size:11px;height:100%;overflow:hidden}
    .wrap{display:grid;grid-template-columns:1.25fr 0.75fr;height:100vh;gap:4px;padding:4px}
    .left{display:grid;grid-template-rows:28px 1fr 1fr;gap:4px}
    .right{background:linear-gradient(135deg,#ea580c,#0f766e);border-radius:10px;padding:6px;display:flex;flex-direction:column;justify-content:space-between}
    .nav{display:flex;align-items:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:0 6px}
    .hero{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:6px;display:flex;flex-direction:column;justify-content:center}
    .hero h1{font-size:11px;color:#ea580c}
    .services{display:grid;grid-template-columns:repeat(3,1fr);gap:3px}
    .card{background:rgba(255,255,255,0.08);border-radius:6px;padding:4px;font-size:6px}
    .about-overlay{background:rgba(0,0,0,0.65);border-radius:8px;padding:6px}
  </style></head><body><div class="wrap"><div class="left"><div class="nav"><strong>Creative</strong></div><div class="hero"><h1>Bold Art</h1></div><div class="services"><div class="card">S1</div><div class="card">S2</div><div class="card">S3</div></div></div><div class="right"><div class="about-overlay"><strong style="font-size:7px;color:#ea580c">ABOUT</strong><p style="font-size:6px;color:#ccc;margin-top:2px">Studio layout.</p></div></div></div></body></html>`,
};

// ─── Templates ────────────────────────────────────────────────────────────────
const TEMPLATES = [
  { id: "generic",  label: "Generic",  emoji: "📄" },
  { id: "modern",   label: "Modern",   emoji: "✨" },
  { id: "luxury",   label: "Luxury",   emoji: "🌸" },
  { id: "creative", label: "Creative", emoji: "🎨" },
];

// ─── Form label dictionary — bilingual: English / native (Task 4) ─────────────
const LABELS = {
  businessName:    {
    en: "Business Name",
    te: "Business Name / పేరు",
    ta: "Business Name / பெயர்",
  },
  description:     {
    en: "Description",
    te: "Description / వివరణ",
    ta: "Description / விளக்கம்",
  },
  services:        {
    en: "Services",
    te: "Services / సేవలు",
    ta: "Services / சேவைகள்",
  },
  phone:           {
    en: "Phone",
    te: "Phone / ఫోన్",
    ta: "Phone / தொலைபேசி",
  },
  address:         {
    en: "Address",
    te: "Address / చిరునామా",
    ta: "Address / முகவரி",
  },
  chooseTemplate:  {
    en: "Choose Template",
    te: "Choose Template / టెంప్లేట్ ఎంచుకోండి",
    ta: "Choose Template / டெம்ப்ளேட் தேர்ந்தெடுக்கவும்",
  },
  generateWebsite: {
    en: "Generate Website",
    te: "Generate Website / వెబ్‌సైట్ సృష్టించండి",
    ta: "Generate Website / வலைத்தளம் உருவாக்கு",
  },
};
const L = (field, lang) => LABELS[field]?.[lang] || LABELS[field]?.en || field;

// ─── Session helpers ──────────────────────────────────────────────────────────
const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("userName");
  localStorage.removeItem("userEmail");
  localStorage.removeItem("userLanguage");
  localStorage.removeItem("userRole");
};
const storeSession = (data) => {
  localStorage.setItem("token", data.access_token);
  if (data.user?.name)     localStorage.setItem("userName",     data.user.name);
  if (data.user?.email)    localStorage.setItem("userEmail",    data.user.email);
  if (data.user?.language) localStorage.setItem("userLanguage", data.user.language);
  // Store role — default "user" if backend doesn't return one yet
  localStorage.setItem("userRole", data.user?.role || "user");
  // Sync user record to localStorage for admin dashboard
  if (data.user) trackUser(data.user);
};
const getToken   = () => localStorage.getItem("token");
const getRole    = () => localStorage.getItem("userRole") || "user";
const isAdmin    = () => getRole() === "admin";
const authHeaders = () => {
  const h = { "Content-Type": "application/json" };
  const t = getToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
};
const getInitials = (name) => {
  if (!name) return "U";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
};

// ─── Error reader ─────────────────────────────────────────────────────────────
const readError = async (res, fallback) => {
  try {
    const text = await res.text();
    if (!text) return fallback;
    try { const d = JSON.parse(text); return d.detail || d.error || fallback; }
    catch { return text; }
  } catch { return fallback; }
};

// ─── Build idea string ────────────────────────────────────────────────────────
const buildIdea = ({ businessName, description, services, phone, address }) => {
  const parts = [];
  if (businessName.trim()) parts.push(`Business name: ${businessName.trim()}`);
  if (description.trim())  parts.push(`Description: ${description.trim()}`);
  if (services.trim())     parts.push(`Services: ${services.trim()}`);
  if (phone.trim() || address.trim())
    parts.push(`Contact — Phone: ${phone.trim() || "N/A"}, Address: ${address.trim() || "N/A"}`);
  return parts.join(". ");
};

// ─── Preview helpers ──────────────────────────────────────────────────────────
const getPreviewDocument = (frame) => frame?.contentDocument || null;
const getPreviewRoot = (frame) => getPreviewDocument(frame)?.body || null;

// ─── Route guards ─────────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}
function PublicOnlyRoute({ children }) {
  return getToken() ? <Navigate to="/dashboard" replace /> : children;
}
// Admin-only route — redirects non-admins to dashboard
function AdminRoute({ children }) {
  if (!getToken())   return <Navigate to="/login"     replace />;
  if (!isAdmin())    return <Navigate to="/dashboard" replace />;
  return children;
}

// ─── Profile menu ─────────────────────────────────────────────────────────────
function ProfileMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref  = useRef(null);
  const name = localStorage.getItem("userName") || "User";
  const role = getRole();

  // Dark mode state
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark"
  );

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const logout = () => { clearSession(); navigate("/login"); };

  const deleteAccount = async () => {
    setOpen(false);
    if (!window.confirm("Delete your account and ALL projects? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_URL}/user/delete`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) { alert(await readError(res, "Could not delete account.")); return; }
      clearSession(); navigate("/login");
    } catch { alert("Unable to reach the server."); }
  };

  return (
    <div className="profile-menu" ref={ref}>
      <button type="button" className="profile-avatar"
        onClick={() => setOpen((v) => !v)} aria-label="Profile menu" aria-expanded={open}>
        {getInitials(name)}
      </button>
      {open && (
        <div className="profile-dropdown" role="menu">
          <div className="profile-dropdown-header">
            <span>{name}</span>
            <span className={`role-badge role-${role}`}>{role}</span>
          </div>
          {/* Admin Panel — only visible to admins */}
          {role === "admin" && (
            <button type="button" role="menuitem"
              onClick={() => { setOpen(false); navigate("/admin"); }}>
              🧑‍💼 Admin Panel
            </button>
          )}
          <button type="button" className="theme-toggle-btn" role="menuitem"
            onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "🌙 Dark Mode" : "☀️ Light Mode"}
          </button>
          <button type="button" role="menuitem" onClick={() => setOpen(false)}>Settings</button>
          <button type="button" role="menuitem" onClick={logout}>Logout</button>
          <button type="button" role="menuitem" className="dropdown-danger" onClick={deleteAccount}>
            Delete Account
          </button>
        </div>
      )}
    </div>
  );
}

// ─── App-wide navbar ──────────────────────────────────────────────────────────
function AppNavbar({ title, children }) {
  const role = getRole();
  return (
    <nav className="app-navbar">
      <div className="navbar-brand">
        <span className="navbar-logo" aria-hidden="true">AI</span>
        {title || "AI Website Builder"}
      </div>
      <div className="navbar-center">{children}</div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {role === "admin" && (
          <span className="navbar-role admin" title="Admin account">ADMIN</span>
        )}
        <ProfileMenu />
      </div>
    </nav>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) { setError(await readError(res, "Invalid email or password.")); return; }
      const data = await res.json();
      storeSession(data);
      if (data.user?.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch { setError("Unable to reach the server."); }
    finally { setLoading(false); }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <span className="navbar-logo" style={{ width: 48, height: 48, fontSize: 18, margin: "0 auto" }} aria-hidden="true">AI</span>
        </div>
        <h1>Welcome back</h1>
        <p className="subtitle">Log in to manage your websites</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="l-email">Email</label>
            <input id="l-email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="l-pw">Password</label>
            <input id="l-pw" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="auth-switch">
          No account?{" "}
          <button type="button" className="link-btn" onClick={() => navigate("/register")}>Register</button>
        </p>
      </div>
    </div>
  );
}

// ─── Multilingual label map ──────────────────────────────────────────────────
const FIELD_LABELS = {
  name:     { en: "Name",     te: "పేరు",       ta: "பெயர்" },
  email:    { en: "Email",    te: "ఇమెయిల్",   ta: "மின்னஞ்சல்" },
  password: { en: "Password", te: "పాస్వర్డ్", ta: "கடவுச்சொல்" },
  aadhaar:  { en: "Aadhaar",  te: "ఆధార్",     ta: "ஆதார்" },
  pan:      { en: "PAN",      te: "పాన్",       ta: "பான்" },
  tin:      { en: "TIN",      te: "టిఐఎన్",    ta: "டின்" },
  brn:      { en: "BRN",      te: "బిఆర్ఎన్",  ta: "பிஆர்என்" },
  language: { en: "Preferred Language", te: "భాష", ta: "மொழி" },
};

/** Returns "English / NativeScript" when a non-English language is selected. */
function getLabel(field, lang) {
  const map = FIELD_LABELS[field];
  if (!map) return field;
  if (lang === "en" || !map[lang]) return map.en;
  return (
    <>
      {map.en}
      <span className="label-native"> / {map[lang]}</span>
    </>
  );
}

// ─── Register — Name, Email, Password, Preferred Language ────────────────────
function RegisterPage() {
  const navigate = useNavigate();
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [aadhaar,  setAadhaar]  = useState("");
  const [pan,      setPan]      = useState("");
  const [panError, setPanError] = useState("");
  const [tin,      setTin]      = useState("");
  const [brn,      setBrn]      = useState("");
  const [language, setLanguage] = useState("en");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  const handlePanChange = (e) => {
    const val = e.target.value.toUpperCase();
    setPan(val);
    if (val.length > 0 && !PAN_REGEX.test(val)) {
      setPanError("Invalid PAN format. Expected: ABCDE1234F");
    } else {
      setPanError("");
    }
  };

  const submit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);

    // Front-end PAN guard
    if (!PAN_REGEX.test(pan)) {
      setPanError("Invalid PAN format. Expected: ABCDE1234F");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/signup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          aadhaar: aadhaar.trim(),
          pan: pan.trim(),
          tin: tin.trim() || null,
          brn: brn.trim() || null,
          language,
        }),
      });
      if (!res.ok) { setError(await readError(res, "Registration failed.")); return; }
      const data = await res.json();
      const nextEmail = (data.email || email).trim();
      navigate("/verify-otp", { state: { email: nextEmail, devOtp: data.dev_otp || null } });
    } catch { setError("Unable to reach the server."); }
    finally { setLoading(false); }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card auth-card-wide">
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <span className="navbar-logo" style={{ width: 48, height: 48, fontSize: 18, margin: "0 auto" }} aria-hidden="true">AI</span>
        </div>
        <h1>Create account</h1>
        <p className="subtitle">Start building websites in minutes</p>
        <form onSubmit={submit}>
          <div className="auth-form-grid">

            {/* ── Language selector first so labels update immediately ── */}
            <div className="form-group grid-span-2">
              <label htmlFor="r-language">{getLabel("language", language)}</label>
              <select
                id="r-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="te">Telugu / తెలుగు</option>
                <option value="ta">Tamil / தமிழ்</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="r-name">{getLabel("name", language)}</label>
              <input id="r-name" type="text" value={name}
                onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="r-email">{getLabel("email", language)}</label>
              <input id="r-email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="form-group grid-span-2">
              <label htmlFor="r-pw">{getLabel("password", language)}</label>
              <input id="r-pw" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>

            <div className="form-group">
              <label htmlFor="r-aadhaar">{getLabel("aadhaar", language)}</label>
              <input id="r-aadhaar" type="text" value={aadhaar}
                onChange={(e) => setAadhaar(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="r-pan">{getLabel("pan", language)}</label>
              <input
                id="r-pan"
                type="text"
                value={pan}
                onChange={handlePanChange}
                maxLength={10}
                placeholder="ABCDE1234F"
                required
                style={panError ? { borderColor: "#ef4444" } : {}}
              />
              {panError && <p className="field-error" role="alert" style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "0.25rem" }}>{panError}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="r-tin">
                {getLabel("tin", language)} <span className="optional-tag">optional</span>
              </label>
              <input id="r-tin" type="text" value={tin}
                onChange={(e) => setTin(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="r-brn">
                {getLabel("brn", language)} <span className="optional-tag">optional</span>
              </label>
              <input id="r-brn" type="text" value={brn}
                onChange={(e) => setBrn(e.target.value)} />
            </div>

          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "Creating account…" : "Register"}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account?{" "}
          <button type="button" className="link-btn" onClick={() => navigate("/login")}>Log in</button>
        </p>
      </div>
    </div>
  );
}

function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState(location.state?.devOtp || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [resendMsg, setResendMsg] = useState("");
  const [devOtp, setDevOtp] = useState(location.state?.devOtp || "");
  const cooldownRef = useRef(null);

  // Start cooldown timer on mount
  useEffect(() => {
    setResendCooldown(30);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(cooldownRef.current);
  }, []);

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendMsg(""); setError(""); setDevOtp(""); setResendLoading(true);
    try {
      const res = await fetch(`${API_URL}/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) { setResendMsg(await readError(res, "Failed to resend OTP.")); return; }
      const data = await res.json();
      setResendMsg(data.message || "New OTP sent!");
      if (data.dev_otp) {
        setDevOtp(data.dev_otp);
        setOtp(data.dev_otp);
      }
      // Restart cooldown
      setResendCooldown(30);
      cooldownRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch { setResendMsg("Unable to reach the server."); }
    finally { setResendLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault(); setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });
      if (!res.ok) { setError(await readError(res, "OTP verification failed.")); return; }
      const data = await res.json();
      setSuccess(data.message || "OTP verified");
      setOtp("");
      setTimeout(() => navigate("/login"), 800);
    } catch { setError("Unable to reach the server."); }
    finally { setLoading(false); }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <span className="navbar-logo" style={{ width: 48, height: 48, fontSize: 18, margin: "0 auto" }} aria-hidden="true">AI</span>
        </div>
        <h1>Verify OTP</h1>
        <p className="subtitle">Enter the 6-digit code sent to your email</p>
        {devOtp && (
          <div style={{
            padding: "10px 14px", marginBottom: "12px", borderRadius: "10px",
            background: "#fef9c3", border: "1px solid #fde047", fontSize: "0.84rem", color: "#713f12"
          }}>
            <strong>Dev mode:</strong> OTP is <code style={{ fontWeight: 700, letterSpacing: "0.15em" }}>{devOtp}</code>
            <button type="button" onClick={() => setOtp(devOtp)}
              style={{ marginLeft: "10px", fontSize: "0.76rem", cursor: "pointer", textDecoration: "underline", background: "none", border: "none", color: "#713f12" }}>
              Auto-fill
            </button>
          </div>
        )}
        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="v-email">Email</label>
            <input id="v-email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="v-otp">OTP</label>
            <input id="v-otp" type="text" inputMode="numeric" value={otp}
              onChange={(e) => setOtp(e.target.value)} required
              placeholder="Enter 6-digit OTP" maxLength={6}
              style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: "1.2rem" }} />
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
          {success && <p className="success-message" role="status">{success}</p>}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <button
            type="button"
            className="link-btn"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resendLoading}
            style={{
              opacity: (resendCooldown > 0 || resendLoading) ? 0.5 : 1,
              cursor: (resendCooldown > 0 || resendLoading) ? "not-allowed" : "pointer",
            }}
          >
            {resendLoading ? "Sending…" : resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
          </button>
          {resendMsg && (
            <p style={{ fontSize: "0.82rem", marginTop: "0.5rem", color: resendMsg.includes("Failed") || resendMsg.includes("Unable") ? "#ef4444" : "#10b981" }}>
              {resendMsg}
            </p>
          )}
        </div>
        <p className="auth-switch">
          Back to{" "}
          <button type="button" className="link-btn" onClick={() => navigate("/login")}>Log in</button>
        </p>
      </div>
    </div>
  );
}

// Sync backend projects to localStorage.websites
const syncWebsitesWithBackend = (backendProjects, userEmail) => {
  try {
    const allSites = JSON.parse(localStorage.getItem("websites") || "[]");
    const otherSites = allSites.filter((s) => s.userEmail !== userEmail);
    const updatedSites = [
      ...otherSites,
      ...backendProjects.map((p) => ({
        id: p.id,
        title: p.title || p.name || "Untitled Project",
        template: p.template,
        userEmail: userEmail,
        createdAt: p.created_at || new Date().toISOString(),
        is_published: p.is_published || false,
        html: p.html || ""
      }))
    ];
    localStorage.setItem("websites", JSON.stringify(updatedSites));

    // Update website counts for the user
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const u = users.find((usr) => usr.email === userEmail);
    if (u) {
      u.websites = backendProjects.length;
      localStorage.setItem("users", JSON.stringify(users));
    }
  } catch (err) {
    console.error("Error syncing websites with localStorage:", err);
  }
};

const getWebsitesForUser = (email) => {
  try {
    const allSites = JSON.parse(localStorage.getItem("websites") || "[]");
    return allSites.filter((s) => s.userEmail === email);
  } catch {
    return [];
  }
};

// ─── TASK 3: Dashboard with delete project ────────────────────────────────────
function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  // Feedback System States
  const [feedbackName, setFeedbackName] = useState(() => localStorage.getItem("userName") || "");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true); setError("");
    const userEmail = localStorage.getItem("userEmail") || "";
    try {
      const res  = await fetch(`${API_URL}/my-projects`, { headers: authHeaders() });
      if (!res.ok) {
        if (res.status === 401) { navigate("/login"); return; }
        setError(await readError(res, "Could not load projects.")); return;
      }
      const data = await res.json();
      syncWebsitesWithBackend(Array.isArray(data) ? data : [], userEmail);
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setError("Unable to reach the server.");
      const localData = getWebsitesForUser(userEmail);
      setProjects(localData);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (getRole() === "admin") {
      navigate("/admin", { replace: true });
    } else {
      loadProjects();
    }
  }, [navigate, loadProjects]);

  const viewProject = (p) => {
    sessionStorage.setItem(HTML_STORAGE_KEY, p.html);
    navigate("/preview", {
      state: {
        html: p.html,
        title: p.title || p.name,
        projectId: p.id,
        isPublished: p.is_published,
        template: p.template,
      }
    });
  };

  const deleteProject = async (p) => {
    if (!window.confirm(`Delete "${p.title || p.name}"? This cannot be undone.`)) return;
    const userEmail = localStorage.getItem("userEmail") || "";
    try {
      const res = await fetch(`${API_URL}/delete-project/${p.id}`, {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok) { alert(await readError(res, "Could not delete project.")); return; }
      
      // Update local storage
      try {
        const allSites = JSON.parse(localStorage.getItem("websites") || "[]");
        const updatedSites = allSites.filter((site) => site.id !== p.id);
        localStorage.setItem("websites", JSON.stringify(updatedSites));

        // Update user website count
        const users = JSON.parse(localStorage.getItem("users") || "[]");
        const u = users.find((usr) => usr.email === userEmail);
        if (u) {
          u.websites = Math.max(0, (u.websites || 1) - 1);
          localStorage.setItem("users", JSON.stringify(users));
        }
      } catch (err) {
        console.error("Error updating local storage on delete:", err);
      }

      loadProjects();
    } catch { alert("Unable to reach the server."); }
  };

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    if (!feedbackComment.trim()) return;

    const feedbackList = JSON.parse(localStorage.getItem("feedback")) || [];
    feedbackList.push({
      name: feedbackName || "Anonymous",
      rating: Number(feedbackRating),
      comment: feedbackComment.trim()
    });
    localStorage.setItem("feedback", JSON.stringify(feedbackList));

    setFeedbackComment("");
    setFeedbackSuccess(true);
    setTimeout(() => setFeedbackSuccess(false), 3000);
  };

  const fmt = (val) => {
    if (!val) return "";
    try {
      const num = Number(val);
      const date = !isNaN(num) && num < 100000000000 ? new Date(num * 1000) : new Date(val);
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }
    catch { return ""; }
  };

  return (
    <div className="app-layout">
      <AppNavbar title="My Projects" />
      <div className="page-content dashboard-page">
        {getRole() === "user" ? (
          <div className="dashboard-layout">
            <div className="left-space"></div>
            <div className="dashboard-main">
              {/* Hero section */}
              <div className="dashboard-hero">
                <h2>Welcome back 👋</h2>
                <p>Build and manage your AI-generated business websites.</p>
                {getRole() === "user" && (
                  <button type="button" className="dashboard-hero-btn" onClick={() => navigate("/form")}>
                    <span>+</span> Create New Website
                  </button>
                )}
              </div>

              {loading && <p className="muted center">Loading projects…</p>}
              {error   && <p className="error-message" role="alert">{error}</p>}

              {!loading && !error && projects.length === 0 && (
                <div className="empty-state">
                  <h3>No websites yet</h3>
                  <p className="muted">Create your first business website to get started.</p>
                  <button type="button" className="primary-btn" onClick={() => navigate("/form")} style={{ maxWidth: 240, margin: "20px auto 0" }}>
                    Create Website
                  </button>
                </div>
              )}

              {!loading && projects.length > 0 && (
                <>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 16px" }}>Your Projects ({projects.length})</h3>
                  <div className="project-list">
                    {projects.map((p) => (
                      <div className="project-card" key={p.id}>
                        <div className="project-info">
                          <strong>{p.title || p.name}</strong>
                          <span className="project-meta">
                            {p.template}
                            {p.created_at ? ` · ${fmt(p.created_at)}` : ""}
                            {p.is_published ? " · 🌐 Published" : ""}
                          </span>
                        </div>
                        <div className="project-actions">
                          <button type="button" className="primary-btn compact"
                            style={{ padding: "8px 16px", fontSize: "0.85rem", height: "auto", minWidth: "auto" }}
                            onClick={() => viewProject(p)}>
                            Preview
                          </button>
                          <button type="button" className="icon-btn delete-btn"
                            title="Delete project" onClick={() => deleteProject(p)}>
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="dashboard-right">
              {/* Feedback form section */}
              <div className="feedback-form-container">
                <form className="feedback-form-card" onSubmit={handleFeedbackSubmit}>
                <h3 className="feedback-form-title">💬 Share Your Feedback</h3>
                <p className="feedback-form-subtitle">Help us improve NIT Trichy Website Builder</p>
                
                {feedbackSuccess && (
                  <div className="feedback-success-msg" role="status">
                    ✓ Thank you for your feedback! Saved successfully.
                  </div>
                )}
                
                <div className="form-group">
                  <label htmlFor="fb-name">Your Name</label>
                  <input
                    id="fb-name"
                    type="text"
                    value={feedbackName}
                    onChange={(e) => setFeedbackName(e.target.value)}
                    placeholder="Enter your name"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Rating</label>
                  <div className="star-rating-selector">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`star-select-btn${star <= feedbackRating ? " active" : ""}`}
                        onClick={() => setFeedbackRating(star)}
                        aria-label={`Rate ${star} stars`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="fb-comment">Comment</label>
                  <textarea
                    id="fb-comment"
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Tell us what you think..."
                    rows={3}
                    required
                  />
                </div>
                
                  <button type="submit" className="primary-btn feedback-submit-btn">
                    Submit Feedback
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <h3>Admin Dashboard</h3>
            <p className="muted">Redirecting you to the admin panel...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Form page — language auto-loaded from user profile ──────────────────────
function FormPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (getRole() !== "user") {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  // Core fields
  const [businessName, setBusinessName] = useState("");
  const [description,  setDescription]  = useState("");
  const [services,     setServices]     = useState("");
  const [phone,        setPhone]        = useState("");
  const [address,      setAddress]      = useState("");
  const [template,     setTemplate]     = useState("generic");

  // Task 1: Optional extra fields
  const [email,     setEmail]     = useState("");
  const [instagram, setInstagram] = useState("");
  const [twitter,   setTwitter]   = useState("");
  const [youtube,   setYoutube]   = useState("");
  const [logoB64,   setLogoB64]   = useState("");      // base64 data URL
  const [imagesB64, setImagesB64] = useState([]);      // array of base64 data URLs

  const logoInputRef   = useRef(null);
  const imagesInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Load user's language from localStorage (set at login/register), refresh from /me
  const [language, setLanguage] = useState(
    () => localStorage.getItem("userLanguage") || "en"
  );
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/me`, { headers: authHeaders() });
        if (!res.ok) return;
        const d = await res.json();
        const lang = d.language || "en";
        if (!cancelled) {
          setLanguage(lang);
          localStorage.setItem("userLanguage", lang);
          // Keep role in sync with server
          if (d.role) localStorage.setItem("userRole", d.role);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Convert a File to base64 data URL
  const fileToB64 = (file) => new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoB64(await fileToB64(file));
  };

  const handleImagesChange = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 4); // max 4
    const b64s  = await Promise.all(files.map(fileToB64));
    setImagesB64(b64s);
  };

  const submit = async (e) => {
    e.preventDefault(); setError("");
    if (!businessName.trim() && !description.trim()) {
      setError("Please enter a business name or description."); return;
    }
    const idea = buildIdea({ businessName, description, services, phone, address });
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/generate-ai`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({
          idea,
          template,
          // Optional extras — backend ignores empty strings / empty arrays
          email:     email.trim()     || null,
          instagram: instagram.trim() || null,
          twitter:   twitter.trim()   || null,
          youtube:   youtube.trim()   || null,
          logo:      logoB64          || null,
          images:    imagesB64.length ? imagesB64 : null,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) { navigate("/login"); return; }
        setError(await readError(res, "Something went wrong.")); return;
      }
      const data = await res.json();
      const html = data.html || "";

      // Debug: log image data from API response
      console.log("[GENERATE-AI] API response data:", data.data);
      console.log("[GENERATE-AI] hero_image:", data.data?.hero_image || data.data?.images?.hero);
      console.log("[GENERATE-AI] about_image:", data.data?.about_image || data.data?.images?.about);
      console.log("[GENERATE-AI] services_image:", data.data?.services_image || data.data?.images?.services);

      if (!html) { setError("No website was returned."); return; }
      
      // Track website creation + AI request in localStorage for admin stats
      const userEmail = localStorage.getItem("userEmail") || "";
      trackWebsite({
        id: data.project_id || Date.now().toString(),
        title: data.title || businessName || "Untitled Project",
        template: data.template || template,
        userEmail: userEmail,
        html: html
      });
      trackAiRequest(userEmail);
      sessionStorage.setItem(HTML_STORAGE_KEY, html);
      navigate("/preview", {
        state: {
          html,
          title: data.title || businessName || "Untitled Project",
          projectId: data.project_id,
          template: data.template || template,
          data: data.data || null,
        }
      });
    } catch { setError("Unable to reach the server."); }
    finally { setLoading(false); }
  };

  return (
    <div className="app-layout">
      <AppNavbar title="Create Website" />
      <div className="page-content">
        <header className="page-header compact-header">
          <h2>Build Your Website</h2>
          <p className="subtitle">Choose a template and tell us about your business. AI will do the rest.</p>
        </header>
        <form className="form-card form-card-wide" onSubmit={submit} encType="multipart/form-data">

          {/* Template picker — visual preview cards */}
          <div className="form-section">
            <h3 className="section-label">{L("chooseTemplate", language)}</h3>
            <div className="template-card-grid">
              {TEMPLATES.map((t) => (
                <div
                  key={t.id}
                  className={`template-card${template === t.id ? " selected" : ""}`}
                  onClick={() => setTemplate(t.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setTemplate(t.id)}
                  aria-pressed={template === t.id}
                  title={`Select ${t.label} template`}
                >
                  {/* Live iframe preview */}
                  <div className="template-preview-box">
                    <iframe
                      srcDoc={TEMPLATE_PREVIEWS[t.id]}
                      title={`${t.label} preview`}
                      className="template-preview-iframe"
                      sandbox="allow-same-origin"
                      scrolling="no"
                    />
                  </div>
                  <div className="template-card-footer">
                    <span className="template-card-emoji">{t.emoji}</span>
                    <span className="template-card-name">{t.label}</span>
                    {template === t.id && (
                      <span className="template-card-check">✓ Selected</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Core fields ── */}
          <div className="form-section-title">Business Info</div>

          <div className="form-group">
            <label htmlFor="bname">{L("businessName", language)}</label>
            <input id="bname" type="text" value={businessName}
              onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="desc">{L("description", language)}</label>
            <textarea id="desc" rows={3} value={description}
              onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="svc">{L("services", language)}</label>
            <input id="svc" type="text" value={services}
              onChange={(e) => setServices(e.target.value)} placeholder="e.g. Haircut, Colour, Styling" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ph">{L("phone", language)}</label>
              <input id="ph" type="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="em">Email <span className="optional-tag">optional</span></label>
              <input id="em" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="hello@business.com" />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="addr">{L("address", language)}</label>
            <input id="addr" type="text" value={address}
              onChange={(e) => setAddress(e.target.value)} />
          </div>

          {/* ── Optional: Social links ── */}
          <div className="form-section-title">
            Social Links <span className="optional-tag">optional</span>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ig">📸 Instagram URL</label>
              <input id="ig" type="url" value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="https://instagram.com/yourbusiness" />
            </div>
            <div className="form-group">
              <label htmlFor="tw">𝕏 X (Twitter) URL</label>
              <input id="tw" type="url" value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="https://x.com/yourbusiness" />
            </div>
          </div>
          <div className="form-group" style={{ maxWidth: "50%" }}>
            <label htmlFor="yt">▶️ YouTube URL</label>
            <input id="yt" type="url" value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              placeholder="https://youtube.com/@yourchannel" />
          </div>

          {/* ── Optional: Logo upload ── */}
          <div className="form-section-title">
            Logo &amp; Images <span className="optional-tag">optional</span>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Business Logo</label>
              <div className="file-upload-area" onClick={() => logoInputRef.current?.click()}>
                {logoB64
                  ? <img src={logoB64} alt="Logo preview" className="logo-preview" />
                  : <span>Click to upload logo</span>}
                <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />
              </div>
            </div>
            <div className="form-group">
              <label>Gallery Images <span className="optional-tag">up to 4</span></label>
              <div className="file-upload-area" onClick={() => imagesInputRef.current?.click()}>
                {imagesB64.length > 0
                  ? <div className="img-preview-row">
                      {imagesB64.map((src, i) => (
                        <img key={i} src={src} alt={`upload-${i}`} className="img-thumb" />
                      ))}
                    </div>
                  : <span>Click to upload images</span>}
                <input ref={imagesInputRef} type="file" accept="image/*" multiple hidden onChange={handleImagesChange} />
              </div>
            </div>
          </div>

          {error && <p className="error-message" role="alert">{error}</p>}

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading
              ? <span className="btn-loading"><span className="spinner" aria-hidden="true" />Generating…</span>
              : L("generateWebsite", language)}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── AI Chatbot Panel ────────────────────────────────────────────────────────

// Build compact context string from current HTML
const buildHtmlContext = (html) => {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const textBlocks = Array.from(doc.querySelectorAll("p"))
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    const name = doc.querySelector("h1")?.textContent?.trim() || "Business";
    const tagline = textBlocks[0] || "";
    const about = doc.querySelector('[data-section="about"] p, .about-copy p, .about p, .cta p')?.textContent?.trim().slice(0, 120) || "";
    const svcs = Array.from(doc.querySelectorAll(".service-card h3, .feature-card h3, .service-line .editable, .service-line span:last-child"))
      .slice(0, 3)
      .map((el) => el.textContent.trim())
      .join(", ");
    const styleText = doc.querySelector("style")?.textContent || "";
    const template = styleText.includes("--violet") ? "modern"
      : styleText.includes("--gold") ? "luxury"
      : "generic";
    return `Business: "${name}". Tagline: "${tagline}". About: "${about}". Services: ${svcs || "N/A"}. Template: ${template}.`;
  } catch {
    return "A business website with sections: hero, about, services, and contact.";
  }
};

// Extract text from a target section in the live preview DOM
const extractSectionText = (target, container) => {
  if (!container) return "";
  const sel = {
    about: '[data-section="about"] p, .about-copy p, .about p, .cta p',
    services: ".service-card h3, .feature-card h3, .service-line .editable, .service-line span:last-child",
    contact: ".nav-chip, .nav-links span, .footer-note span, .contact-meta div",
    headings: "h1, h2",
    text: "p, h1, h2, h3",
    all: "h1, h2, h3, p, .editable, .service-card h3, .feature-card h3, .service-line span:last-child",
  }[target] || "p";
  return Array.from(container.querySelectorAll(sel))
    .map((el) => el.textContent.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 200);
};

const QUICK_ACTIONS = [
  "Make headings bigger",
  "Center all text",
  "Improve about section",
  "Make it colorful",
];

const SUPPORTED_ACTIONS = new Set([
  "change_color", "change_background", "increase_font",
  "decrease_font", "align_text", "improve_text", "none",
]);

// Apply a parsed action directly to the preview DOM
function applyAction(action, previewContainer) {
  if (!previewContainer || !action?.action) return false;

  const { action: act, target, value } = action;

  // Resolve CSS selector from target name — lenient matching
  const selector = (() => {
    const t = (target || "all").toLowerCase();
    if (t === "headings" || t === "heading") return "h1, h2, h3";
    if (t === "about")                        return '[data-section="about"], .about, .cta';
    if (t === "services")                     return '[data-section="services"], .services, .service-card, .feature-card, .service-line';
    if (t === "contact")                      return ".nav-chip, .nav-links span, .footer-note span, .contact-meta div";
    if (t === "buttons")                      return "a.primary-btn, a.secondary-btn, a.cta-button";
    if (t === "text" || t === "body")         return "p, h1, h2, h3, .editable";
    // "all" or anything else
    return "h1, h2, h3, p, .editable, .service-card, .feature-card, .service-line, .nav-chip, .footer-note span";
  })();

  const els = Array.from(previewContainer.querySelectorAll(selector))
                   .filter((el) => el.tagName !== "A");
  if (els.length === 0) return false;

  switch (act) {
    case "change_color":
      els.forEach((el) => { el.style.color = value || "#2563eb"; });
      return true;

    case "change_background": {
      const sectioned = new Set();
      els.forEach((el) => {
        let t = el;
        while (
          t &&
          !t.matches?.('[data-section], .panel, .card, .hero, .services, .about, .cta, .feature-card, .service-card, .service-line') &&
          t !== previewContainer
        ) {
          t = t.parentElement;
        }
        if (t && t !== previewContainer) sectioned.add(t);
      });
      const targets = sectioned.size ? [...sectioned] : els;
      targets.forEach((el) => { el.style.backgroundColor = value || "#f0f4ff"; });
      return true;
    }

    case "increase_font":
      els.forEach((el) => {
        const cur = parseFloat(window.getComputedStyle(el).fontSize) || 13;
        el.style.fontSize = `${Math.min(cur + 3, 48)}px`;
      });
      return true;

    case "decrease_font":
      els.forEach((el) => {
        const cur = parseFloat(window.getComputedStyle(el).fontSize) || 13;
        el.style.fontSize = `${Math.max(cur - 2, 9)}px`;
      });
      return true;

    case "align_text":
      els.forEach((el) => { el.style.textAlign = value || "center"; });
      return true;

    default:
      return false;
  }
}

function ChatPanel({ html, previewRef }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! Tell me how to improve your website." },
  ]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const replaceLoading = (text) =>
    setMessages((m) => m.filter((x) => !x.loading).concat({ role: "assistant", text }));

  const getLivePreviewRoot = () => getPreviewRoot(previewRef?.current);

  // Task 6: improve_text — call /rewrite-text for the target section
  const handleImproveText = async (target, context) => {
    const container  = getLivePreviewRoot();
    const currentTxt = extractSectionText(target, container);
    if (!currentTxt) {
      replaceLoading("⚠️ Couldn't find text in that section.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/rewrite-text`, {
        method:  "POST",
        headers: authHeaders(),
        body:    JSON.stringify({ target, current: currentTxt, context }),
      });
      if (!res.ok) { replaceLoading("⚠️ Rewrite failed. Try again."); return; }
      const data = await res.json();
      if (!data.text) { replaceLoading("⚠️ No rewrite returned."); return; }

      // Apply the rewritten text to all matching elements
      const sel = {
        about: '[data-section="about"] p, .about-copy p, .about p, .cta p',
        services: ".service-card h3, .feature-card h3, .service-line .editable, .service-line span:last-child",
        contact: ".nav-chip, .nav-links span, .footer-note span, .contact-meta div",
      }[target] || "p";

      const els = container ? Array.from(container.querySelectorAll(sel)) : [];
      if (els.length > 0) {
        // Distribute rewritten text into the elements (put it in the first one)
        els[0].textContent = data.text;
        replaceLoading(`✅ "${target}" section rewritten.`);
      } else {
        replaceLoading("⚠️ Couldn't find that section to update.");
      }
    } catch {
      replaceLoading("⚠️ Unable to reach the server.");
    }
  };

  const send = async (command) => {
    const cmd = (command || input).trim();
    if (!cmd || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: cmd }]);
    setMessages((m) => [...m, { role: "assistant", text: "⏳ Thinking…", loading: true }]);
    setLoading(true);

    try {
      const context = buildHtmlContext(html);
      console.log("[AI-ASSISTANT] Sending instruction:", cmd);
      console.log("[AI-ASSISTANT] Context:", context);

      const res = await fetch(`${API_URL}/edit-with-ai`, {
        method:  "POST",
        headers: authHeaders(),
        body:    JSON.stringify({ command: cmd, context }),
      });

      if (!res.ok) {
        let errDetail = `Server error (${res.status})`;
        try {
          const errBody = await res.json();
          errDetail = errBody.detail || errBody.message || errDetail;
        } catch {
          // response wasn't JSON
        }
        console.error("[AI-ASSISTANT] /edit-with-ai failed:", res.status, errDetail);
        replaceLoading(`⚠️ ${errDetail}`);
        return;
      }

      const data = await res.json();
      console.log("[AI-ASSISTANT] /edit-with-ai response:", data);

      // none / fallback
      if (!data.action || data.action === "none") {
        const hint = data.message || "Try: 'Make headings blue', 'Center all text', 'Improve about section'";
        replaceLoading(`💡 ${hint}`);
        return;
      }

      // improve_text — separate rewrite call
      if (data.action === "improve_text") {
        await handleImproveText(data.target || "about", context);
        return;
      }

      // All other actions — apply directly to DOM
      if (SUPPORTED_ACTIONS.has(data.action)) {
        const applied = applyAction(data, getLivePreviewRoot());
        if (applied) {
          const label = data.action.replace(/_/g, " ");
          const tgt   = data.target && data.target !== "all" ? ` on ${data.target}` : "";
          replaceLoading(`✅ Done — ${label}${tgt} applied.`);
        } else {
          console.warn("[AI-ASSISTANT] applyAction returned false — no matching elements for:", data);
          replaceLoading(`⚠️ Could not find elements for "${data.target}". Try "all" or a specific section.`);
        }
      } else {
        console.warn("[AI-ASSISTANT] Unsupported action received:", data.action);
        replaceLoading(`⚠️ Unknown action "${data.action}". Try: make headings blue, center all text.`);
      }
    } catch (err) {
      console.error("[AI-ASSISTANT] Network/parse error:", err);
      replaceLoading(`⚠️ Could not reach the server. Check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">🤖 AI Assistant</div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role === "user" ? "chat-user" : "chat-bot"}${m.loading ? " chat-thinking-text" : ""}`}>
            {m.loading ? (
              <span className="chat-loading-row">
                <span className="dot" /><span className="dot" /><span className="dot" />
                <span style={{ marginLeft: 6 }}>Thinking…</span>
              </span>
            ) : m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-chips">
        {QUICK_ACTIONS.map((a) => (
          <button key={a} type="button" className="chat-chip"
            onClick={() => send(a)} disabled={loading}>
            {a}
          </button>
        ))}
      </div>

      <div className="chat-input-row">
        <input
          type="text"
          className="chat-input"
          placeholder="e.g. Make headings blue, Improve about section…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={loading}
        />
        <button type="button" className="chat-send-btn"
          onClick={() => send()} disabled={loading || !input.trim()}>
          {loading ? <span className="spinner-sm" /> : "➤"}
        </button>
      </div>
    </div>
  );
}

function generatePalette(base) {
  const brand = tinycolor(base);
  
  // Core brand palette
  const primary = base;
  const secondary = brand.clone().lighten(20).toString();
  const accent = brand.clone().saturate(30).toString();
  
  // Background selection based on whether base color is light or dark
  const isLight = brand.isLight();
  const hsl = brand.toHsl();
  const bgHsl = { ...hsl };
  if (isLight) {
    bgHsl.l = Math.max(0.95, hsl.l + 0.4);
    bgHsl.s = Math.min(0.1, hsl.s); // desaturate for clean premium background
  } else {
    bgHsl.l = Math.min(0.08, hsl.l - 0.4);
    bgHsl.s = Math.min(0.15, hsl.s); // subtle brand saturation
  }
  const background = tinycolor(bgHsl).toHexString();
  
  // Determine text colors for readability
  const bodyText = tinycolor(background).isLight() ? "#0f172a" : "#f8fafc";
  
  // Hero gradient (starts with base, blends to a darker version of base)
  const gradient = `linear-gradient(135deg, ${base}, ${brand.clone().darken(20).toString()})`;
  
  // Text on primary (buttons) and text on gradient (hero)
  const textOnPrimary = brand.isLight() ? "#000000" : "#ffffff";
  const textOnGradient = brand.clone().darken(10).isLight() ? "#000000" : "#ffffff";

  // RGB versions for translucency (rgba functions)
  const pRgb = brand.toRgb();
  const sRgb = tinycolor(secondary).toRgb();
  const bgRgb = tinycolor(background).toRgb();
  const tRgb = tinycolor(bodyText).toRgb();

  return {
    primary,
    "primary-rgb": `${pRgb.r}, ${pRgb.g}, ${pRgb.b}`,
    secondary,
    "secondary-rgb": `${sRgb.r}, ${sRgb.g}, ${sRgb.b}`,
    accent,
    background,
    "background-rgb": `${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}`,
    text: bodyText,
    "text-rgb": `${tRgb.r}, ${tRgb.g}, ${tRgb.b}`,
    gradient,
    "text-on-primary": textOnPrimary,
    "text-on-gradient": textOnGradient,
    "accent-light": brand.clone().lighten(35).toString()
  };
}

function getPrimaryColorFromHtml(htmlString, defaultColor = "#7c3aed") {
  try {
    if (!htmlString) return defaultColor;
    const doc = new DOMParser().parseFromString(htmlString, "text/html");
    const primary = doc.documentElement.style.getPropertyValue("--primary");
    if (primary && primary.trim()) {
      return primary.trim();
    }
  } catch (e) {
    console.error("Failed to parse primary color from HTML:", e);
  }
  return defaultColor;
}

// ─── Preview / Edit ───────────────────────────────────────────────────────────
function PreviewPage() {
  const navigate     = useNavigate();
  const location     = useLocation();
  const previewRef   = useRef(null);
  const fileInputRef = useRef(null);

  const initialHtml = location.state?.html || sessionStorage.getItem(HTML_STORAGE_KEY) || "";
  const [projectId,      setProjectId]      = useState(location.state?.projectId);
  const template    = location.state?.template || "generic";
  const title       = location.state?.title || "Website Preview";
  const generatedData = location.state?.data || null;

  const [html,           setHtml]           = useState(initialHtml);
  const [baseColor,      setBaseColor]      = useState(() => {
    const extracted = getPrimaryColorFromHtml(initialHtml, "");
    if (extracted) return extracted;
    return localStorage.getItem("baseColor") || "#7c3aed";
  });
  const [editMode,       setEditMode]       = useState(false);
  const [selectedEl,     setSelectedEl]     = useState(null);
  const [selectedImage,  setSelectedImage]  = useState(null);
  const [textColor,      setTextColor]      = useState("#000000");
  const [bgColor,        setBgColor]        = useState("#ffffff");
  const [saving,         setSaving]         = useState(false);
  const [publishing,     setPublishing]     = useState(false);
  const [message,        setMessage]        = useState("");
  const [previewHeight,  setPreviewHeight]  = useState(820);
  const [publishUrl,     setPublishUrl]     = useState(
    location.state?.isPublished && projectId ? `${API_URL}/published/${projectId}` : ""
  );

  // Sync palette properties whenever baseColor changes
  useEffect(() => {
    localStorage.setItem("baseColor", baseColor);
    const palette = generatePalette(baseColor);
    
    // Apply to host document root
    Object.keys(palette).forEach((key) => {
      document.documentElement.style.setProperty(`--${key}`, palette[key]);
    });
    
    // Apply to iframe root
    const iframeDoc = previewRef.current?.contentDocument;
    if (iframeDoc?.documentElement) {
      Object.keys(palette).forEach((key) => {
        iframeDoc.documentElement.style.setProperty(`--${key}`, palette[key]);
      });
    }
  }, [baseColor]);

  const resizePreviewFrame = useCallback(() => {
    const frame = previewRef.current;
    const doc = frame?.contentDocument;
    if (!doc?.documentElement) return;

    const nextHeight = Math.max(
      doc.documentElement.scrollHeight || 0,
      doc.body?.scrollHeight || 0,
      820
    );

    setPreviewHeight(Math.min(nextHeight + 8, 2400));
  }, []);

  const syncEditMode = useCallback(() => {
    const root = getPreviewRoot(previewRef.current);
    if (!root) return;
    applyEditMode(root, editMode, setSelectedEl, setSelectedImage, resizePreviewFrame);
    window.setTimeout(resizePreviewFrame, 0);
  }, [editMode, resizePreviewFrame]);

  const handleIframeLoad = useCallback(() => {
    syncEditMode();
    const iframeDoc = previewRef.current?.contentDocument;
    if (iframeDoc?.documentElement) {
      const palette = generatePalette(baseColor);
      Object.keys(palette).forEach((key) => {
        iframeDoc.documentElement.style.setProperty(`--${key}`, palette[key]);
      });
    }
  }, [syncEditMode, baseColor]);

  // ── Toggle edit mode wiring without re-rendering HTML ────────────────────────
  useEffect(() => {
    syncEditMode();
  }, [syncEditMode, html]);

  const toggleEdit = () => setEditMode((v) => !v);

  // ── Capture DOM → full HTML (strips edit artefacts) ──────────────────────────
  const getUpdatedHtml = () => {
    const doc = getPreviewDocument(previewRef.current);
    if (!doc?.documentElement) return html;
    const clone = doc.documentElement.cloneNode(true);
    clone.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
    clone.querySelectorAll(".editing-active").forEach((el) => el.classList.remove("editing-active"));
    clone.querySelectorAll("img.img-selected").forEach((img) => img.classList.remove("img-selected"));
    return `<!DOCTYPE html>\n${clone.outerHTML}`;
  };

  const upsertProject = async (updated, extra = {}) => {
    let currentProjectId = projectId;

    if (!currentProjectId) {
      const createRes = await fetch(`${API_URL}/save-project`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: title,
          template,
          html: updated,
          data: generatedData,
          created_at: new Date().toISOString(),
          ...extra,
        }),
      });
      if (!createRes.ok) throw new Error(await readError(createRes, "Save failed."));
      const created = await createRes.json();
      currentProjectId = created.project_id;
      setProjectId(currentProjectId);
    } else {
      const updateRes = await fetch(`${API_URL}/update-project`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          project_id: currentProjectId,
          html: updated,
          name: title,
          template,
          ...extra,
        }),
      });
      if (!updateRes.ok) throw new Error(await readError(updateRes, "Save failed."));
    }

    return currentProjectId;
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const updated = getUpdatedHtml();
    setSaving(true); setMessage("");
    try {
      const currentProjectId = await upsertProject(updated);
      
      // Sync with localStorage
      const userEmail = localStorage.getItem("userEmail") || "";
      trackWebsite({
        id: currentProjectId,
        title: title,
        template: template,
        html: updated,
        userEmail: userEmail
      });

      setHtml(updated);
      sessionStorage.setItem(HTML_STORAGE_KEY, updated);
      setMessage("Project saved successfully!");
    } catch { setMessage("Unable to save."); }
    finally { setSaving(false); }
  };

  // ── Publish ──────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    setPublishing(true); setMessage("");
    try {
      const updated = getUpdatedHtml();
      const currentProjectId = await upsertProject(updated, { is_published: true });
      
      // Hit the new POST /publish endpoint
      const publishRes = await fetch(`${API_URL}/publish`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ html: updated, project_id: currentProjectId }),
      });
      
      if (!publishRes.ok) { setMessage(await readError(publishRes, "Publish failed.")); return; }
      const persistentPublishUrl = `${API_URL}/published/${currentProjectId}`;
      const userEmail = localStorage.getItem("userEmail") || "";
      trackWebsite({
        id: currentProjectId,
        title,
        template,
        html: updated,
        is_published: true,
        userEmail,
      });

      setHtml(updated);
      sessionStorage.setItem(HTML_STORAGE_KEY, updated);
      setPublishUrl(persistentPublishUrl);
      setMessage("Website published!");
      
    resizePreviewFrame();
      
      // Open published site in new tab
      window.open(persistentPublishUrl, "_blank", "noopener,noreferrer");
    } catch { setMessage("Unable to publish."); }
    finally { setPublishing(false); }
  };

  // ── Task 1: Font size controls ───────────────────────────────────────────────
  const changeFontSize = (delta) => {
    if (!selectedEl) return;
    const current = parseFloat(window.getComputedStyle(selectedEl).fontSize) || 13;
    const next = Math.min(Math.max(current + delta, 9), 64);
    selectedEl.style.fontSize = `${next}px`;
  };

  // ── Task 2: Text alignment controls ──────────────────────────────────────────
  const applyAlign = (align) => {
    if (!selectedEl) return;
    selectedEl.style.textAlign = align;
  };

  // ── Text color ────────────────────────────────────────────────────────────────
  const applyTextColor = (color) => {
    setTextColor(color);
    if (selectedEl) selectedEl.style.color = color;
    resizePreviewFrame();
  };

  // ── Section background ────────────────────────────────────────────────────────
  const applyBgColor = (color) => {
    setBgColor(color);
    if (selectedEl) {
      let target = selectedEl;
      while (
        target &&
        !target.matches?.('[data-section], .panel, .card, .hero, .services, .about, .cta, .feature-card, .service-card, .service-line')
      ) {
        target = target.parentElement;
      }
      if (target) target.style.backgroundColor = color;
    }
    resizePreviewFrame();
  };

  // ── TASK 8: Image upload — only when editMode ─────────────────────────────────
  const handleImageUpload = (e) => {
    if (!editMode || !selectedImage) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      selectedImage.src = reader.result;
      e.target.value = "";
      resizePreviewFrame();
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = () => {
    if (!editMode || !selectedImage) return;
    selectedImage.src = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23e2e8f0'/%3E%3Cstop offset='1' stop-color='%23cbd5e1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='800' height='600' fill='url(%23g)'/%3E%3C/svg%3E";
    setSelectedImage(null);
    getPreviewRoot(previewRef.current)?.querySelectorAll("img").forEach((i) => i.classList.remove("img-selected"));
  };

  if (!html) return <Navigate to="/dashboard" replace />;

  const isSuccess = message.includes("success") || message.includes("published");

  return (
    <div className="app-layout">
      <AppNavbar title={title} />

      {/* Tasks 3 & 4: sticky topbar — always visible above everything */}
      <div className="preview-topbar-fixed">
        <button type="button" className="back-btn" title="Back"
          onClick={() => navigate("/dashboard")}>
          ← Back
        </button>

        <div className="brand-color-controls">
          <span className="brand-color-label">Brand Color:</span>
          <div className="color-picker-wrapper">
            <input
              type="color"
              value={baseColor}
              onChange={(e) => setBaseColor(e.target.value)}
              className="brand-color-picker"
              title="Choose Brand Color"
            />
          </div>
          <div className="color-presets">
            {["#7c3aed", "#ec4899", "#2563eb", "#16a34a"].map((color) => (
              <button
                key={color}
                type="button"
                className={`preset-circle${baseColor === color ? " active" : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => setBaseColor(color)}
                title={`Preset ${color}`}
              />
            ))}
          </div>
        </div>

        <div className="preview-actions">
          <button type="button" className="icon-action-btn" title="Save"
            onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner-sm" /> : "💾"}
          </button>
          <button type="button" className="icon-action-btn publish-icon-btn" title="Publish"
            onClick={handlePublish} disabled={publishing}>
            {publishing ? <span className="spinner-sm" /> : "🌐"}
          </button>
          <button type="button"
            className={`icon-action-btn${editMode ? " edit-active-btn" : " edit-icon-btn"}`}
            title={editMode ? "Done Editing" : "Edit Website"}
            onClick={toggleEdit}>
            {editMode ? "✅" : "✏️"}
          </button>
        </div>
      </div>

      {/* Main content area — pushed below fixed topbar */}
      <div className="preview-body">

        {/* Status messages */}
        {message && (
          <p className={`status-message${isSuccess ? " success" : ""}`} role="status">{message}</p>
        )}
        {publishUrl && (
          <p className="publish-link">
            Live at: <a href={publishUrl} target="_blank" rel="noopener noreferrer">{publishUrl}</a>
          </p>
        )}

        {/* Edit toolbar — only in edit mode */}
        {editMode && (
          <div className="edit-toolbar">

            {/* Task 2: Text alignment */}
            <div className="toolbar-group">
              <span className="toolbar-label">Align</span>
              <button type="button" className="toolbar-icon-btn" title="Align left"
                onClick={() => applyAlign("left")}>⬅️</button>
              <button type="button" className="toolbar-icon-btn" title="Align center"
                onClick={() => applyAlign("center")}>↔️</button>
              <button type="button" className="toolbar-icon-btn" title="Align right"
                onClick={() => applyAlign("right")}>➡️</button>
            </div>

            {/* Task 1: Font size */}
            <div className="toolbar-group">
              <span className="toolbar-label">Size</span>
              <button type="button" className="toolbar-icon-btn" title="Increase font"
                onClick={() => changeFontSize(+2)}>𝐀+</button>
              <button type="button" className="toolbar-icon-btn" title="Decrease font"
                onClick={() => changeFontSize(-2)}>𝐀-</button>
            </div>

            {/* Text color */}
            <div className="toolbar-group">
              <label className="toolbar-label" htmlFor="textColorPicker">🎨</label>
              <input id="textColorPicker" type="color" value={textColor}
                onChange={(e) => applyTextColor(e.target.value)}
                title="Text color" className="color-picker" />
            </div>

            {/* Section background */}
            <div className="toolbar-group">
              <label className="toolbar-label" htmlFor="bgColorPicker">🖌</label>
              <input id="bgColorPicker" type="color" value={bgColor}
                onChange={(e) => applyBgColor(e.target.value)}
                title="Section background" className="color-picker" />
            </div>

            {/* Image controls */}
            {selectedImage && (
              <div className="toolbar-group">
                <span className="toolbar-label">🖼</span>
                <button type="button" className="toolbar-btn"
                  onClick={() => fileInputRef.current?.click()}>Upload</button>
                <button type="button" className="toolbar-btn danger-sm"
                  onClick={handleDeleteImage}>🗑</button>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
              </div>
            )}

            <span className="edit-hint-inline">
              {selectedEl ? "Element selected ✓" : "Click text to select"}
            </span>
          </div>
        )}

        {/* Tasks 1 & 2: side-by-side — centered preview + chatbot */}
        <div className="preview-chat-layout">

          {/* Task 1: centered preview wrapper */}
          <div className="preview-wrapper">
            <div className={`preview-container${editMode ? " edit-mode" : ""}`}>
              <iframe
                ref={previewRef}
                title="Website preview"
                srcDoc={html}
                className="preview-iframe"
                sandbox="allow-same-origin"
                style={{ height: `${previewHeight}px` }}
                onLoad={handleIframeLoad}
              />
            </div>
          </div>

          {/* Chatbot panel */}
          <ChatPanel html={html} previewRef={previewRef} />
        </div>
      </div>
    </div>
  );
}

// ─── Apply / remove edit mode on preview DOM ──────────────────────────────────
function applyEditMode(container, active, setSelectedEl, setSelectedImage, resizePreviewFrame) {
  if (!container) return;

  container
    .querySelectorAll(".editable, h1, h2, h3, p, .service-card h3, .feature-card h3, .service-line span:last-child, .nav-chip, .footer-note span")
    .forEach((el) => {
      if (el.tagName === "A") return;
      el.contentEditable = active ? "true" : "false";
      if (active) {
        el.classList.add("editing-active");
        el.onclick = () => setSelectedEl(el);
        el.oninput = () => resizePreviewFrame?.();
      } else {
        el.classList.remove("editing-active");
        el.onclick = null;
        el.oninput = null;
      }
    });

  container.querySelectorAll("img").forEach((img) => {
    if (active) {
      img.style.cursor = "pointer";
      img.title        = "Click to select image";
      img.onclick      = (e) => {
        e.stopPropagation();
        container.querySelectorAll("img").forEach((i) => i.classList.remove("img-selected"));
        img.classList.add("img-selected");
        setSelectedImage(img);
      };
    } else {
      img.style.cursor = "";
      img.title        = "";
      img.onclick      = null;
      img.classList.remove("img-selected");
    }
  });

  if (!active) {
    if (setSelectedEl)    setSelectedEl(null);
    if (setSelectedImage) setSelectedImage(null);
  }
}

// ─── App router ───────────────────────────────────────────────────────────────
function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/"          element={<Navigate to="/dashboard" replace />} />
        <Route path="/login"     element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
        <Route path="/register"  element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
        <Route path="/verify-otp" element={<PublicOnlyRoute><VerifyOtpPage /></PublicOnlyRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/form"      element={<ProtectedRoute><FormPage /></ProtectedRoute>} />
        <Route path="/preview"   element={<ProtectedRoute><PreviewPage /></ProtectedRoute>} />
        <Route path="/admin"     element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      </Routes>
    </HashRouter>
  );
}

export default App;
