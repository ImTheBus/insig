// /js/ui/app.js
// version: 2026-06-09 v1.0 (deterministic rebuild)
//
// Single deterministic render path. Typing, the Grow button, and loading a
// ?seed= permalink ALL funnel through render(text) -> identical output for
// identical text. No divergent live-typing branch (that was the old bug).

import {
  buildPalette, analyseText, hashString
} from "../engine/text-seed.js";
import { buildScene } from "../engine/scene-builder.js";
import { sceneToSVGString, renderScene } from "../render/svg-renderer.js";

let els = {};
let state = { text: "", mode: "auto", scene: null, svg: "", sig: "" };
let typeTimer = null;

// ---- signature ------------------------------------------------
// Short base32-ish fingerprint of the exact input, shown next to the art.
// This is the visible proof of determinism: same text -> same signature.
const B32 = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford-ish, no i l o u
function signature(text, mode) {
  let h = hashString(mode + "␟" + text); // unit separator avoids collisions
  let out = "";
  for (let k = 0; k < 7; k++) {
    out += B32[h & 31];
    h = Math.floor(h / 32) ^ (h << 3);
    h = h >>> 0;
  }
  return out.toUpperCase();
}

// ---- permalink ------------------------------------------------
// Encodes the full input + mode in the URL so a phrase is shareable and
// reproducible by anyone. Uses base64url of UTF-8 (no PII leaves the page;
// this is just the user's own text, encoded in their own link).
function encodeSeed(text, mode) {
  const payload = JSON.stringify({ t: text, m: mode });
  const b64 = btoa(unescape(encodeURIComponent(payload)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeSeed(seed) {
  try {
    let b64 = seed.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = decodeURIComponent(escape(atob(b64)));
    const o = JSON.parse(json);
    if (typeof o.t === "string") return { text: o.t, mode: o.m || "auto" };
  } catch (e) { /* fall through */ }
  return null;
}

function updatePermalink() {
  const seed = encodeSeed(state.text, state.mode);
  const url = new URL(window.location.href);
  url.searchParams.set("seed", seed);
  history.replaceState(null, "", url.toString());
  els.permalink.value = url.toString();
}

// ---- stats hint ----------------------------------------------
function updateHint() {
  const s = analyseText(state.text);
  els.hint.textContent =
    `${s.length} chars · ${s.vowels} vowels · ${s.consonants} consonants · ${s.digits} digits · ${s.symbols} symbols`;
}

// ---- core render (the single deterministic path) -------------
function render(text, mode, opts = {}) {
  state.text = text;
  state.mode = mode;

  if (!text.trim()) {
    els.host.classList.add("empty");
    els.host.innerHTML =
      `<div class="placeholder">Type a phrase, and watch it grow into a sigil.<span>Every character becomes a mark. The same words always make the same image.</span></div>`;
    state.scene = null; state.svg = ""; state.sig = "";
    els.sig.textContent = "—";
    updateHint();
    updatePermalink();
    return;
  }

  const palette = buildPalette(text, mode);
  const scene = buildScene(text, palette);
  renderScene(els.host, scene, { stagger: opts.stagger });

  state.scene = scene;
  state.svg = sceneToSVGString(scene);
  state.sig = signature(text, mode);

  els.sig.textContent = state.sig;
  els.charcount.textContent = String([...text].length);
  updateHint();
  updatePermalink();
}

// ---- input handling (debounced, but same path) ---------------
function onInput() {
  const text = els.input.value;
  const mode = els.mode.value;
  if (typeTimer) clearTimeout(typeTimer);
  typeTimer = setTimeout(() => render(text, mode, { stagger: 6 }), 120);
}

function onGrow() {
  render(els.input.value, els.mode.value, { stagger: 18 });
}

// ---- downloads -----------------------------------------------
function downloadSVG() {
  if (!state.svg) return flash("Grow a sigil first.");
  const blob = new Blob([state.svg], { type: "image/svg+xml" });
  triggerDownload(URL.createObjectURL(blob), `glyphseed-${state.sig || "sigil"}.svg`);
  flash("SVG downloaded.");
}

function downloadPNG() {
  if (!state.scene) return flash("Grow a sigil first.");
  const size = parseInt(els.size.value, 10) || 1024;
  const svgStr = sceneToSVGString(state.scene, size);
  const url = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml" }));
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    c.getContext("2d").drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
    c.toBlob(b => {
      triggerDownload(URL.createObjectURL(b), `glyphseed-${state.sig || "sigil"}-${size}.png`);
      flash(`PNG downloaded (${size}×${size}).`);
    }, "image/png");
  };
  img.onerror = () => { URL.revokeObjectURL(url); flash("PNG render failed."); };
  img.src = url;
}

function triggerDownload(url, name) {
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function copyLink() {
  els.permalink.select();
  navigator.clipboard?.writeText(els.permalink.value)
    .then(() => flash("Shareable link copied."))
    .catch(() => flash("Select the link and copy."));
}

let flashTimer = null;
function flash(msg) {
  els.status.textContent = msg;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { els.status.textContent = ""; }, 2600);
}

// ---- about toggle --------------------------------------------
function toggleAbout() {
  const open = els.about.classList.toggle("open");
  els.aboutBtn.setAttribute("aria-expanded", String(open));
}

// ---- boot -----------------------------------------------------
function boot() {
  els = {
    host: document.getElementById("insignia-host"),
    input: document.getElementById("input-text"),
    mode: document.getElementById("palette-mode"),
    grow: document.getElementById("generate-btn"),
    size: document.getElementById("export-size"),
    dlSvg: document.getElementById("download-svg-btn"),
    dlPng: document.getElementById("download-png-btn"),
    hint: document.getElementById("text-hint"),
    sig: document.getElementById("sig-value"),
    charcount: document.getElementById("char-count"),
    status: document.getElementById("status-line"),
    permalink: document.getElementById("permalink"),
    copyBtn: document.getElementById("copy-link-btn"),
    about: document.getElementById("about-panel"),
    aboutBtn: document.getElementById("about-toggle")
  };

  els.input.addEventListener("input", onInput);
  els.mode.addEventListener("change", onGrow);
  els.grow.addEventListener("click", onGrow);
  els.dlSvg.addEventListener("click", downloadSVG);
  els.dlPng.addEventListener("click", downloadPNG);
  els.copyBtn.addEventListener("click", copyLink);
  els.aboutBtn.addEventListener("click", toggleAbout);

  // Restore from permalink if present.
  const params = new URLSearchParams(window.location.search);
  const seed = params.get("seed");
  let initial = null;
  if (seed) initial = decodeSeed(seed);

  if (initial) {
    els.input.value = initial.text;
    els.mode.value = initial.mode;
    render(initial.text, initial.mode, { stagger: 10 });
  } else {
    render("", "auto");
  }
}

document.addEventListener("DOMContentLoaded", boot);
