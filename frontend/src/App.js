import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const templates = [
  {
    name: "Generic",
    value: "generic",
    description: "A clean, flexible starter layout for any small business.",
  },
  {
    name: "Modern",
    value: "modern",
    description: "Bold spacing, crisp sections, and a contemporary feel.",
  },
  {
    name: "Luxury",
    value: "luxury",
    description: "Elegant presentation for premium brands and services.",
  },
];

function App() {
  const iframeRef = useRef(null);
  const [page, setPage] = useState("login");
  const [idea, setIdea] = useState("");
  const [html, setHtml] = useState("");
  const [template, setTemplate] = useState("generic");
  const [projectId, setProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [generatedData, setGeneratedData] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedTextLabel, setSelectedTextLabel] = useState("No text selected");
  const [selectedImageLabel, setSelectedImageLabel] = useState("No image selected");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageKeyword, setImageKeyword] = useState("");
  const [imageWidth, setImageWidth] = useState(400);
  const [fontSize, setFontSize] = useState(18);
  const [textColor, setTextColor] = useState("#172033");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [isBold, setIsBold] = useState(false);
  const [alignment, setAlignment] = useState("left");
  const [publishUrl, setPublishUrl] = useState("");
  const [dynamicBlocks, setDynamicBlocks] = useState([]);
  const selectedTextRef = useRef(null);
  const selectedImageRef = useRef(null);

  const readError = async (res, fallback) => {
    try {
      const text = await res.text();
      if (!text) return fallback;

      try {
        const data = JSON.parse(text);
        return data.detail || data.error || fallback;
      } catch {
        return text;
      }
    } catch {
      return fallback;
    }
  };

  const getToken = () => localStorage.getItem("token");

  const resetAuthFeedback = () => {
    setAuthMessage("");
    setAuthError("");
  };

  const resetBuilder = () => {
    setIdea("");
    setHtml("");
    setTemplate("generic");
    setProjectId(null);
    setGeneratedData(null);
    setPublishUrl("");
    setDynamicBlocks([]);
    selectedTextRef.current = null;
    selectedImageRef.current = null;
    setSelectedTextLabel("No text selected");
    setSelectedImageLabel("No image selected");
    setSelectedImage(null);
    setImageWidth(400);
    setAlignment("left");
  };

  const requireToken = useCallback(() => {
    const token = getToken();
    if (!token) {
      setAuthError("Please log in first.");
      setPage("login");
      return null;
    }
    return token;
  }, []);

  const enablePreviewEditing = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;

    doc
      .querySelectorAll("h1, h2, h3, p, li, .service-card")
      .forEach((element) => {
        element.contentEditable = true;
        element.onclick = (event) => {
          event.stopPropagation();
          doc.querySelectorAll(".editor-selected-text").forEach((item) => {
            item.classList.remove("editor-selected-text");
          });
          selectedTextRef.current = element;
          element.classList.add("editor-selected-text");
          setSelectedTextLabel(element.tagName.toLowerCase());
          const computed = doc.defaultView.getComputedStyle(element);
          setFontSize(parseInt(computed.fontSize, 10) || 18);
          setTextColor(rgbToHex(computed.color));
          setBackgroundColor(rgbToHex(computed.backgroundColor));
          setIsBold(parseInt(computed.fontWeight, 10) >= 700);
          setAlignment(computed.textAlign || "left");
        };
      });

    doc.querySelectorAll("img").forEach((image, index) => {
      image.style.cursor = "pointer";
      image.onclick = (event) => {
        event.stopPropagation();
        doc.querySelectorAll(".editor-selected-image").forEach((item) => {
          item.classList.remove("editor-selected-image");
        });
        selectedImageRef.current = { type: "img", element: image };
        setSelectedImage({ type: "img", index, label: image.className || `image ${index + 1}` });
        image.classList.add("editor-selected-image");
        setSelectedImageLabel(image.className || `image ${index + 1}`);
        setImageWidth(Math.round(image.getBoundingClientRect().width) || 400);
      };
    });

    doc.querySelectorAll(".hero").forEach((hero) => {
      hero.style.cursor = "pointer";
      hero.onclick = (event) => {
        if (event.target !== hero) return;
        event.stopPropagation();
        doc.querySelectorAll(".editor-selected-image").forEach((item) => {
          item.classList.remove("editor-selected-image");
        });
        selectedImageRef.current = { type: "background", element: hero };
        setSelectedImage({ type: "background", index: 0, label: "hero background" });
        hero.classList.add("editor-selected-image");
        setSelectedImageLabel("hero background");
        setImageWidth(Math.round(hero.getBoundingClientRect().width) || 400);
      };
    });

    doc.querySelectorAll(".section-wrapper").forEach((wrapper) => {
      let button = wrapper.querySelector(".delete-section-btn");
      if (!button) {
        button = doc.createElement("button");
        button.className = "delete-section-btn";
        button.type = "button";
        button.textContent = "x";
        wrapper.appendChild(button);
      }
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const blockId = wrapper?.dataset.blockId;
        wrapper?.remove();
        if (blockId) {
          setDynamicBlocks((current) =>
            current.filter((block) => String(block.id) !== String(blockId))
          );
        }
      };
    });

    if (!doc.getElementById("preview-editor-style")) {
      const style = doc.createElement("style");
      style.id = "preview-editor-style";
      style.innerHTML = `
        [contenteditable="true"] {
          cursor: text;
        }
        [contenteditable="true"]:hover,
        img:hover,
        .hero:hover {
          outline: 1px dashed #4a6cf7;
        }
        [contenteditable="true"]:focus {
          outline: 2px solid #4a6cf7;
          background: rgba(74, 108, 247, 0.08);
        }
        .editor-selected-text,
        .editor-selected-image {
          outline: 3px solid #4a6cf7 !important;
          outline-offset: 3px;
        }
        .section-wrapper {
          position: relative;
        }
        .delete-section-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 26px;
          height: 26px;
          border: 0;
          border-radius: 50%;
          background: #e74c3c;
          color: #fff;
          cursor: pointer;
          font-weight: 800;
          z-index: 20;
        }
      `;
      doc.head.appendChild(style);
    }
  }, []);

  const rgbToHex = (value) => {
    const match = value.match(/\d+/g);
    if (!match || match.length < 3) return "#ffffff";

    return `#${match
      .slice(0, 3)
      .map((part) => Number(part).toString(16).padStart(2, "0"))
      .join("")}`;
  };

  const stableFrontendImageUrl = (keyword) => {
    const clean = keyword.trim() || "professional business";
    let hash = 0;
    for (let index = 0; index < clean.length; index += 1) {
      hash = (hash * 31 + clean.charCodeAt(index)) >>> 0;
    }
    return `https://loremflickr.com/1000/700/${encodeURIComponent(
      clean.replace(/\s+/g, ",")
    )}?lock=${hash}`;
  };

  useEffect(() => {
    const element = selectedTextRef.current;
    if (!element) return;

    element.style.fontSize = `${fontSize}px`;
    element.style.color = textColor;
    element.style.backgroundColor = backgroundColor;
    element.style.fontWeight = isBold ? "bold" : "normal";
    element.style.textAlign = alignment;
  }, [fontSize, textColor, backgroundColor, isBold, alignment]);

  useEffect(() => {
    const selected = selectedImageRef.current;
    if (!selected) return;

    if (selected.type === "background") {
      selected.element.style.backgroundSize = `${imageWidth}px auto`;
      selected.element.style.backgroundRepeat = "no-repeat";
      selected.element.style.backgroundPosition = "center";
    } else {
      selected.element.style.width = `${imageWidth}px`;
      selected.element.style.maxWidth = "100%";
      selected.element.style.height = "auto";
    }
  }, [imageWidth]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.onload = enablePreviewEditing;
  }, [enablePreviewEditing, html, page]);

  const signup = async (event) => {
    event.preventDefault();
    resetAuthFeedback();

    if (!email.trim() || !password) {
      setAuthError("Enter an email and password to create your account.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        setAuthError(await readError(res, "Signup failed."));
        return;
      }

      setAuthMessage("Account created. You can log in now.");
      setPassword("");
      setPage("login");
    } catch {
      setAuthError("Unable to reach the server. Is the backend running?");
    }
  };

  const login = async (event) => {
    event.preventDefault();
    resetAuthFeedback();

    if (!email.trim() || !password) {
      setAuthError("Enter your email and password.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        setAuthError(await readError(res, "Login failed."));
        return;
      }

      const data = await res.json();
      if (!data.access_token) {
        setAuthError("Login response did not include an access token.");
        return;
      }

      localStorage.setItem("token", data.access_token);
      setPassword("");
      resetBuilder();
      setPage("dashboard");
    } catch {
      setAuthError("Unable to reach the server. Is the backend running?");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    resetBuilder();
    setProjects([]);
    setPage("login");
    setAuthMessage("You have been logged out.");
  };

  const generateWebsite = async () => {
    if (!idea.trim()) {
      alert("Enter a business idea.");
      return;
    }

    const token = requireToken();
    if (!token) return;

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/generate-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ idea, template }),
      });

      if (!res.ok) {
        alert(`Error: ${await readError(res, "Something went wrong")}`);
        return;
      }

      const data = await res.json();
      setHtml(data.html || "");
      setGeneratedData(data.data || null);
      setProjectId(null);
      setPublishUrl("");
      setPage("preview");
    } catch {
      alert("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = useCallback(async () => {
    const token = requireToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        alert(await readError(res, "Error fetching projects"));
        return;
      }

      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      alert("Unable to reach the server");
    }
  }, [requireToken]);

  useEffect(() => {
    if (localStorage.getItem("token")) {
      fetchProjects();
    }
  }, [fetchProjects]);

  useEffect(() => {
    if (page === "projects" || page === "dashboard") {
      fetchProjects();
    }
  }, [fetchProjects, page]);

  const currentPreviewHtml = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.documentElement) return html;

    const clone = doc.documentElement.cloneNode(true);

    // Remove preview editor style tag
    const styleEl = clone.querySelector("#preview-editor-style");
    if (styleEl) styleEl.remove();

    // Remove delete buttons
    clone.querySelectorAll(".delete-section-btn").forEach((btn) => btn.remove());

    // Remove outline selection highlights
    clone.querySelectorAll(".editor-selected-text").forEach((el) => el.classList.remove("editor-selected-text"));
    clone.querySelectorAll(".editor-selected-image").forEach((el) => el.classList.remove("editor-selected-image"));
    clone.querySelectorAll(".selected-element").forEach((el) => el.classList.remove("selected-element"));

    // Remove contenteditable attributes
    clone.querySelectorAll('[contenteditable="true"]').forEach((el) => {
      el.removeAttribute("contenteditable");
    });

    // Clear editing cursor/outline styles
    clone.querySelectorAll("h1, h2, h3, p, li, img, .hero").forEach((el) => {
      el.style.cursor = "";
      el.style.outline = "";
      el.style.outlineOffset = "";
    });

    return clone.outerHTML;
  };

  const backgroundUrl = (value) =>
    value.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");

  const collectPreviewData = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return generatedData;

    const hero = doc.querySelector(".hero");
    const heroBackground = hero ? backgroundUrl(hero.style.backgroundImage || "") : "";
    const heroImage = doc.querySelector(".hero-img")?.src || heroBackground;
    const aboutImage =
      doc.querySelector(".about-card img")?.src ||
      doc.querySelector(".split img")?.src ||
      doc.querySelector(".section-img")?.src ||
      "";
    const serviceImages = doc.querySelectorAll(".section-img");
    const servicesImage = serviceImages[1]?.src || doc.querySelector(".services img")?.src || "";
    const logo = doc.querySelector(".logo")?.src || "";
    const selectedImageElement = selectedImageRef.current?.element;

    return {
      ...(generatedData || {}),
      selected_image: selectedImage,
      images: {
        ...((generatedData && generatedData.images) || {}),
        hero: heroImage,
        about: aboutImage,
        services: servicesImage,
        logo,
      },
      image_sizes: {
        ...((generatedData && generatedData.image_sizes) || {}),
        selected: selectedImageElement
          ? Math.round(selectedImageElement.getBoundingClientRect().width)
          : imageWidth,
      },
    };
  };

  const saveProject = async () => {
    const token = requireToken();
    if (!token) return;

    if (!html) {
      alert("Generate a website before saving.");
      return;
    }

    const updatedHtml = currentPreviewHtml();
    const updatedData = collectPreviewData();
    setSavingProject(true);

    try {
      const res = await fetch(`${API_URL}/save-project`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: idea || "Untitled Project",
          template,
          html: updatedHtml,
          data: updatedData,
        }),
      });

      if (!res.ok) {
        alert(`Error: ${await readError(res, "Could not save project")}`);
        return;
      }

      const data = await res.json();
      setHtml(updatedHtml);
      setGeneratedData(updatedData);
      setProjectId(data.project_id || null);
      setPublishUrl(`${API_URL}/published/${data.project_id}`);
      alert("Project saved successfully.");
      return data.project_id || null;
    } catch {
      alert("Unable to reach the server");
      return null;
    } finally {
      setSavingProject(false);
    }
  };

  const saveEdits = async () => {
    const token = requireToken();
    if (!token) return false;

    if (!projectId) {
      alert("Save the project first, then save edits.");
      return false;
    }

    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) {
      alert("Preview is not ready yet.");
      return false;
    }

    const updatedHtml = currentPreviewHtml();
    const parser = new DOMParser();
    const cleanDoc = parser.parseFromString(updatedHtml, "text/html");
    const updatedBodyHtml = cleanDoc.body.innerHTML;
    const updatedData = collectPreviewData();
    setSavingEdits(true);

    try {
      const res = await fetch(`${API_URL}/update-project`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          html: updatedHtml,
          body_html: updatedBodyHtml,
          data: updatedData,
        }),
      });

      if (!res.ok) {
        alert(`Error: ${await readError(res, "Could not save edits")}`);
        return false;
      }

      setHtml(updatedHtml);
      setGeneratedData(updatedData);
      alert("Changes saved successfully.");
      return true;
    } catch {
      alert("Unable to reach the server");
      return false;
    } finally {
      setSavingEdits(false);
    }
  };

  const deleteProject = async (id) => {
    const token = requireToken();
    if (!token) return;

    if (!window.confirm("Delete this project?")) return;

    setDeletingId(id);

    try {
      const res = await fetch(`${API_URL}/delete-project/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        alert(`Error: ${await readError(res, "Delete failed")}`);
        return;
      }

      if (projectId === id) {
        resetBuilder();
      }
      await fetchProjects();
    } catch {
      alert("Unable to reach the server");
    } finally {
      setDeletingId(null);
    }
  };

  const addTextBox = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;

    const block = {
      id: Date.now(),
      type: "text",
      content: "New editable text",
    };

    const wrapper = doc.createElement("div");
    wrapper.className = "section-wrapper";
    wrapper.dataset.blockId = block.id;
    wrapper.style.position = "relative";
    wrapper.style.margin = "16px";

    const deleteButton = doc.createElement("button");
    deleteButton.className = "delete-section-btn";
    deleteButton.type = "button";
    deleteButton.textContent = "x";

    const text = doc.createElement("p");
    text.textContent = block.content;
    text.contentEditable = true;
    text.style.padding = "12px";
    text.style.margin = "0";
    text.style.border = "1px dashed #4a6cf7";

    wrapper.appendChild(deleteButton);
    wrapper.appendChild(text);
    doc.body.appendChild(wrapper);
    setDynamicBlocks((current) => [...current, block]);
    enablePreviewEditing();
  };

  const addSectionBlock = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;

    const block = {
      id: Date.now(),
      type: "section",
      title: "New Section",
      content: "Add your custom content here.",
    };

    const wrapper = doc.createElement("div");
    wrapper.className = "section-wrapper";
    wrapper.dataset.blockId = block.id;
    wrapper.style.position = "relative";
    wrapper.style.margin = "24px";

    const deleteButton = doc.createElement("button");
    deleteButton.className = "delete-section-btn";
    deleteButton.type = "button";
    deleteButton.textContent = "x";

    const section = doc.createElement("section");
    section.style.padding = "32px";
    section.style.margin = "0";
    section.style.borderRadius = "12px";
    section.style.background = "#ffffff";
    section.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
    section.innerHTML = `
      <h2 contenteditable="true">${block.title}</h2>
      <p contenteditable="true">${block.content}</p>
    `;
    wrapper.appendChild(deleteButton);
    wrapper.appendChild(section);
    doc.body.appendChild(wrapper);
    setDynamicBlocks((current) => [...current, block]);
    enablePreviewEditing();
  };

  const setSelectedImageUrl = (url) => {
    const selected = selectedImageRef.current;
    if (!selected) {
      alert("Click an image or hero background in the preview first.");
      return;
    }

    if (selected.type === "background") {
      selected.element.style.backgroundImage = `url("${url}")`;
    } else {
      selected.element.src = url;
    }
  };

  const regenerateSelectedImage = () => {
    if (!imageKeyword.trim()) {
      alert("Enter an image keyword first.");
      return;
    }

    const url = stableFrontendImageUrl(imageKeyword);
    setSelectedImageUrl(url);
    setGeneratedData((current) => ({
      ...(current || {}),
      edited_image_keyword: imageKeyword,
    }));
  };

  const uploadSelectedImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageUrl(reader.result);
      setGeneratedData((current) => ({
        ...(current || {}),
        has_uploaded_images: true,
      }));
    };
    reader.readAsDataURL(file);
  };

  const publishProject = async () => {
    let id = projectId;
    let success = true;

    if (id) {
      success = await saveEdits();
    } else {
      id = await saveProject();
      success = !!id;
    }

    if (success && id) {
      const url = `${API_URL}/published/${id}`;
      setPublishUrl(url);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const downloadWebsite = () => {
    const output = currentPreviewHtml();
    if (!output) {
      alert("Generate a website first!");
      return;
    }

    const blob = new Blob([output], { type: "text/html" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "website.html";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const openProject = (project) => {
    setIdea(project.name || "");
    setHtml(project.html || "");
    setTemplate(project.template || "generic");
    setProjectId(project.id);
    try {
      setGeneratedData(project.data_json ? JSON.parse(project.data_json) : null);
    } catch {
      setGeneratedData(null);
    }
    setPublishUrl(`${API_URL}/published/${project.id}`);
    setPage("preview");
  };

  const startNewWebsite = () => {
    resetBuilder();
    setPage("builder");
  };

  const switchAuthPage = (nextPage) => {
    resetAuthFeedback();
    setPassword("");
    setPage(nextPage);
  };

  const isSignup = page === "signup";

  return (
    <div className="container">
      <header className="app-header">
        <div>
          <h1>AI Website Builder</h1>
          <p>Generate, edit, save, and reuse business websites.</p>
        </div>

        {page !== "login" && page !== "signup" && (
          <button className="secondary-btn header-btn" onClick={logout}>
            Logout
          </button>
        )}
      </header>

      {(page === "login" || page === "signup") && (
        <form className="card auth-card" onSubmit={isSignup ? signup : login}>
          <h2>{isSignup ? "Create account" : "Login"}</h2>
          <p className="muted">
            {isSignup
              ? "Sign up to start saving generated websites."
              : "Welcome back. Enter your details to continue."}
          </p>

          {authMessage && <p className="success-message">{authMessage}</p>}
          {authError && <p className="error-message">{authError}</p>}

          <label>
            Email
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
          </label>

          <button type="submit">{isSignup ? "Sign up" : "Login"}</button>

          <button
            className="link-btn"
            type="button"
            onClick={() => switchAuthPage(isSignup ? "login" : "signup")}
          >
            {isSignup
              ? "Already have an account? Login"
              : "Need an account? Sign up"}
          </button>
        </form>
      )}

      {page === "dashboard" && (
        <section className="card dashboard-card">
          <div className="section-heading">
            <h2>Welcome</h2>
            <p className="muted">
              Create a new website or continue working from your saved projects.
            </p>
          </div>

          <div className="button-group">
            <button onClick={startNewWebsite}>Create Website</button>
            <button className="secondary-btn" onClick={() => setPage("projects")}>
              My Projects
            </button>
          </div>
        </section>
      )}

      {page === "builder" && (
        <section className="card generator-card">
          <div className="section-heading">
            <h2>Create Website</h2>
            <p className="muted">Choose a template, describe the business, and generate.</p>
          </div>

          <div className="template-gallery">
            {templates.map((item) => {
              const selected = template === item.value;

              return (
                <button
                  className={`template-card ${selected ? "selected" : ""}`}
                  type="button"
                  key={item.value}
                  onClick={() => setTemplate(item.value)}
                  aria-pressed={selected}
                >
                  <span className={`template-preview ${item.value}`}>
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="template-copy">
                    <strong>{item.name}</strong>
                    <span>{item.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <label>
            Business idea
            <input
              type="text"
              placeholder="Example: a premium coffee shop in Chennai"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
            />
          </label>

          <div className="button-group">
            <button className="secondary-btn" onClick={() => setPage("dashboard")}>
              Dashboard
            </button>
            <button onClick={generateWebsite} disabled={loading}>
              {loading ? "Generating..." : "Generate Website"}
            </button>
          </div>
        </section>
      )}

      {page === "preview" && (
        <div className="editor-workspace">
          <aside className="sidebar">
            <h2>Editor</h2>
            <p>Click text or images in the preview, then use these tools.</p>

            <div className="sidebar-section">
              <h3>Text Controls</h3>
              <span className="toolbar-status">{selectedTextLabel}</span>
              <label>
                Font size
                <input
                  type="range"
                  min="12"
                  max="64"
                  value={fontSize}
                  onChange={(event) => setFontSize(event.target.value)}
                />
              </label>
              <label>
                Text color
                <input
                  type="color"
                  value={textColor}
                  onChange={(event) => setTextColor(event.target.value)}
                />
              </label>
              <label>
                Background
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(event) => setBackgroundColor(event.target.value)}
                />
              </label>
              <button
                className={isBold ? "secondary-btn active-toggle" : "secondary-btn"}
                onClick={() => setIsBold((current) => !current)}
              >
                Bold
              </button>
              <div className="alignment-buttons">
                {["left", "center", "right"].map((item) => (
                  <button
                    className={alignment === item ? "active-toggle" : ""}
                    key={item}
                    onClick={() => setAlignment(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="sidebar-section">
              <h3>Image Controls</h3>
              <span className="toolbar-status">{selectedImageLabel}</span>
              <label>
                Image keyword
                <input
                  type="text"
                  placeholder="luxury bakery interior"
                  value={imageKeyword}
                  onChange={(event) => setImageKeyword(event.target.value)}
                />
              </label>
              <button onClick={regenerateSelectedImage}>Change Image</button>
              <label className="file-control">
                Replace image
                <input type="file" accept="image/*" onChange={uploadSelectedImage} />
              </label>
              <label>
                Image width
                <input
                  type="range"
                  min="100"
                  max="1000"
                  value={imageWidth}
                  onChange={(event) => setImageWidth(Number(event.target.value))}
                />
              </label>
            </div>

            <div className="sidebar-section">
              <h3>Add Elements</h3>
              <button onClick={addTextBox}>Add Text Box</button>
              <button onClick={addSectionBlock}>Add Section</button>
              <span className="toolbar-status">Added blocks: {dynamicBlocks.length}</span>
            </div>

            <div className="sidebar-section">
              <h3>Actions</h3>
              {projectId ? (
                <button onClick={saveEdits} disabled={savingEdits}>
                  {savingEdits ? "Saving..." : "Save Changes"}
                </button>
              ) : (
                <button onClick={saveProject} disabled={savingProject}>
                  {savingProject ? "Saving..." : "Save Project"}
                </button>
              )}
              <button className="secondary-btn" onClick={publishProject}>
                Publish
              </button>
              <button className="secondary-btn" onClick={startNewWebsite}>
                Create Another
              </button>
              <button className="secondary-btn" onClick={() => setPage("projects")}>
                My Projects
              </button>
            </div>

            {publishUrl && (
              <p className="publish-url">
                Public URL: <a href={publishUrl}>{publishUrl}</a>
              </p>
            )}
          </aside>

          <section className="preview-container">
            <div className="preview-header">
              <div>
                <h2>Preview Website</h2>
                <p className="muted">Click text, images, or added sections to edit.</p>
              </div>
              <button className="download-btn compact-btn" onClick={downloadWebsite}>
                Download
              </button>
            </div>

            <div className="preview">
              <iframe
                title="preview"
                srcDoc={html}
                ref={iframeRef}
                onLoad={enablePreviewEditing}
              />
            </div>
          </section>
        </div>
      )}

      {page === "projects" && (
        <section className="card projects-card">
          <div className="projects-header">
            <div>
              <h2>My Projects</h2>
              <p className="muted">Only projects saved under your account appear here.</p>
            </div>
            <button className="secondary-btn compact-btn" onClick={() => setPage("dashboard")}>
              Dashboard
            </button>
          </div>

          {projects.length === 0 ? (
            <p className="muted empty-state">No projects yet</p>
          ) : (
            <div className="project-list">
              {projects.map((project) => (
                <div className="project-card" key={project.id}>
                  <div className="project-info">
                    <strong>{project.name}</strong>
                    <span>{project.template}</span>
                  </div>

                  <div className="project-actions">
                    <button onClick={() => openProject(project)}>Open</button>
                    <button
                      className="delete-btn"
                      onClick={() => deleteProject(project.id)}
                      disabled={deletingId === project.id}
                    >
                      {deletingId === project.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default App;
