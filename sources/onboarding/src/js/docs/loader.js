import { DOCS_MAP } from "./config.js";

const navEl = document.getElementById("docs-nav");
const contentEl = document.getElementById("docs-content");

// cache JSON đã load
const CACHE = new Map();

/* ========== helpers ========== */

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// parse **bold**
function inline(text = "") {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/* ========== block renderer ========== */

function renderBlock(block) {
  switch (block.type) {
    case "h1":
      return `<h1 class="docs__h1">${inline(block.text)}</h1>`;
    case "h2":
      return `<h2 class="docs__h2">${inline(block.text)}</h2>`;
    case "h3":
      return `<h3 class="docs__h3">${inline(block.text)}</h3>`;
    case "meta":
      return `<div class="docs__meta">${inline(block.text)}</div>`;
    case "p":
      return `<p class="docs__p">${inline(block.text)}</p>`;
    case "quote":
      return `<blockquote class="docs__quote">${inline(
        block.text
      )}</blockquote>`;
    case "ul":
      return `<ul class="docs__list">
        ${block.items.map((i) => `<li>${inline(i)}</li>`).join("")}
      </ul>`;
    case "ol":
      return `<ol class="docs__list">
        ${block.items.map((i) => `<li>${inline(i)}</li>`).join("")}
      </ol>`;
    default:
      return "";
  }
}

function renderDoc(json) {
  return json.blocks.map(renderBlock).join("");
}

/* ========== data loader ========== */

async function loadJson(id) {
  if (CACHE.has(id)) return CACHE.get(id);

  const cfg = DOCS_MAP[id];
  if (!cfg) throw new Error(`Unknown doc id: ${id}`);

  const res = await fetch(cfg.src, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${cfg.src}`);

  const data = await res.json();
  CACHE.set(id, data);
  return data;
}

/* ========== navigation ========== */

function setActiveNav(id) {
  [...navEl.children].forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.id === id);
  });
}

async function openDoc(id, pushHash = true) {
  setActiveNav(id);

  contentEl.innerHTML = `<p class="docs__p">Loading…</p>`;

  try {
    const json = await loadJson(id);
    contentEl.innerHTML = renderDoc(json);
    contentEl.scrollTop = 0;

    if (pushHash) {
      history.replaceState(null, "", `#${id}`);
    }
  } catch (err) {
    console.error(err);
    contentEl.innerHTML = `<p class="docs__p">Failed to load document.</p>`;
  }
}

/* ========== init ========== */

function buildNav() {
  navEl.innerHTML = "";

  Object.entries(DOCS_MAP).forEach(([id, cfg], idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "docs__nav-item";
    btn.dataset.id = id;

    btn.innerHTML = `
      <span class="docs__nav-index">${String(idx + 1).padStart(2, "0")}.</span>
      <span class="docs__nav-label">${cfg.label}</span>
    `;

    btn.addEventListener("click", () => openDoc(id));
    navEl.appendChild(btn);
  });
}

function getInitialId() {
  const hash = location.hash.replace("#", "");
  return DOCS_MAP[hash] ? hash : Object.keys(DOCS_MAP)[0];
}

export function initDocs() {
  buildNav();

  const firstId = getInitialId();
  openDoc(firstId, false);

  window.addEventListener("hashchange", () => {
    const id = getInitialId();
    openDoc(id, false);
  });
}
