// /js/ui/app.js
// version: 2025-12-01 v0.5

import { buildParamsFromText, makeRNG } from "../engine/text-seed.js";
import { buildScene } from "../engine/scene-builder.js";
import { sceneToSVGString } from "../render/svg-renderer.js";
import { renderSceneDiff } from "../render/diff-renderer.js";
import { runPreloader } from "./preloader.js";

let lastScene = null;
let lastParams = null;
let lastSVGString = "";
let autoMinimizeTimeout = null;

let inputEl;
let hintEl;
let generateBtn;
let hostEl;
let statusEl;
let seedPill;
let exportSizeEl;
let downloadSvgBtn;
let downloadPngBtn;
let paletteModeEl;
let metaRowEl;
let panelEl;
let panelToggle;

let liveTimer = null;
const liveMode = true;

// live incremental state
const liveState = {
  initialised: false,
  text: "",
  paramsBase: null,
  elements: [],
  charElements: [] // array of arrays of element ids per character index
};

// running hash for keystroke-driven strokes
let liveHash = 0x9e3779b9; // non-zero initial value

// ---- text analysis helpers ----------------------------------

function analyseTextLocal(text) {
  return {
    length: text.length,
    vowels: (text.match(/[aeiouAEIOU]/g) || []).length,
    consonants: (text.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length,
    digits: (text.match(/\d/g) || []).length,
    symbols: (text.match(/[^\w\s]/g) || []).length
  };
}

function updateStatsHint() {
  const text = inputEl.value;
  const stats = analyseTextLocal(text);
  hintEl.textContent =
    `${stats.length} characters • ` +
    `${stats.vowels} vowels • ` +
    `${stats.consonants} consonants • ` +
    `${stats.digits} digits • ` +
    `${stats.symbols} symbols`;
}

function layoutLabel(mode) {
  const labels = [
    "Radial crest",
    "Orbital emblem",
    "Layered totem",
    "Shield pattern"
  ];
  return labels[mode] || "Unknown";
}

function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("status-error", !!isError);
}

function scheduleAutoMinimise() {
  if (!panelEl) return;
  if (autoMinimizeTimeout) clearTimeout(autoMinimizeTimeout);
  autoMinimizeTimeout = setTimeout(() => {
    panelEl.classList.add("minimized");
  }, 3200);
}

function updateMetaFromParams(params) {
  if (!params) return;

  const seedHex = "0x" + params.seed.toString(16).padStart(8, "0");
  const seedSpan = seedPill.querySelector("span:last-child");
  if (seedSpan) seedSpan.textContent = "Seed: " + seedHex;

  metaRowEl.innerHTML =
    `<div class="meta-tag">Layout: ${layoutLabel(params.layoutMode)}</div>` +
    `<div class="meta-tag">Symmetry: ${params.symmetry} fold</div>` +
    `<div class="meta-tag">Detail: ${params.detailLevel.toFixed(1)}</div>`;
}

function clearLiveState() {
  liveState.initialised = false;
  liveState.text = "";
  liveState.paramsBase = null;
  liveState.elements = [];
  liveState.charElements = [];
  liveHash = 0x9e3779b9;
}

// ---- core render from whole text ----------------------------

function renderFromText(text, paletteMode, options = {}) {
  if (!text) {
    hostEl.classList.add("empty");
    hostEl.innerHTML = `
      <div class="insignia-placeholder">
        Type a phrase in the corner and grow a symbol from it.
        <span>Nothing is stored. Every mark comes only from your text.</span>
      </div>`;
    lastScene = null;
    lastParams = null;
    lastSVGString = "";
    setStatus("");
    clearLiveState();
    return;
  }

  const params = buildParamsFromText(text, paletteMode);
  const scene = buildScene(params);

  const renderOpts = {
    totalDuration: options.totalDuration || 3000,
    pieceStagger: options.pieceStagger || 30
  };

  import("../render/svg-renderer.js").then(({ renderSceneOrganic }) => {
    renderSceneOrganic(hostEl, scene, renderOpts);
  });

  updateMetaFromParams(params);

  lastScene = scene;
  lastParams = params;
  lastSVGString = sceneToSVGString(scene);

  setStatus("Insignia grown. Use SVG or PNG to export.");
  scheduleAutoMinimise();

  // seed live state from this scene
  liveState.initialised = true;
  liveState.text = text;
  liveState.paramsBase = params;
  liveState.elements = scene.slice();
  liveState.charElements = Array.from({ length: text.length }, () => []);
  liveHash = 0x9e3779b9;
}

// ---- running hash + stroke library --------------------------

// 32-bit mixing function for the live hash
function stepHash(current, chCode, index) {
  let h = current ^ (chCode + index * 0x45d9f3b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

let liveIdCounter = 0;
function liveId(prefix, index, k) {
  liveIdCounter += 1;
  return `live-${prefix}-${index}-${k}-${liveIdCounter}`;
}

// radius helpers: pick bands so strokes land in coherent rings
function pickRadiusBand(rand, paramsBase, bandIndex) {
  const base = 140;
  const span = 220;
  const t = (bandIndex + rand()) / 6; // 0..1
  return base + t * span;
}

// stroke 1: short arc on one of the outer rings
function strokeRingArc(rand, paramsBase, index) {
  const els = [];
  const r = pickRadiusBand(rand, paramsBase, (index % 6));
  const angleSpan = (Math.PI / 8) * (0.5 + rand());
  const centerAngle = rand() * Math.PI * 2;
  const start = centerAngle - angleSpan / 2;
  const end = centerAngle + angleSpan / 2;

  const steps = 16;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = start + (end - start) * t;
    const rr = r + Math.sin(t * Math.PI) * 8 * paramsBase.curveBias;
    pts.push(`${500 + rr * Math.cos(ang)} ${500 + rr * Math.sin(ang)}`);
  }

  els.push({
    id: liveId("arc", index, 0),
    type: "path",
    layer: "curves",
    d: `M ${pts.join(" L ")}`,
    stroke: rand() < 0.5 ? paramsBase.palette.main2 : paramsBase.palette.main3,
    strokeWidth: 1.0 + rand() * 1.8,
    opacity: 0.24 + rand() * 0.2,
    fill: "none"
  });

  return els;
}

// stroke 2: radial twig cluster
function strokeRadialBranch(rand, paramsBase, index) {
  const els = [];
  const baseAngle = rand() * Math.PI * 2;
  const startR = 160 + (index % 5) * 10;
  const length = 40 + rand() * 40;
  const depth = 1 + (rand() < 0.4 ? 1 : 0);

  function addSegment(cx, cy, angle, len, d, kBase) {
    const x2 = cx + len * Math.cos(angle);
    const y2 = cy + len * Math.sin(angle);
    const id = liveId("tw", index, kBase + d);

    els.push({
      id,
      type: "line",
      layer: "branches",
      x1: cx,
      y1: cy,
      x2,
      y2,
      stroke: paramsBase.palette.subtle,
      strokeWidth: Math.max(0.7, 2.2 - d * 0.5),
      opacity: 0.18 + 0.12 * d
    });

    if (d <= 0) return;
    const nextLen = len * (0.65 + rand() * 0.15);
    const delta = (Math.PI / 10) * (0.7 + rand() * 0.4);
    addSegment(x2, y2, angle + delta, nextLen, d - 1, kBase + 3);
    addSegment(x2, y2, angle - delta, nextLen, d - 1, kBase + 7);
  }

  const sx = 500 + startR * Math.cos(baseAngle);
  const sy = 500 + startR * Math.sin(baseAngle);
  addSegment(sx, sy, baseAngle, length, depth, 0);

  return els;
}

// stroke 3: petal cluster sitting on a ring
function strokePetalCluster(rand, paramsBase, index) {
  const els = [];
  const radius = pickRadiusBand(rand, paramsBase, (index + 2) % 6);
  const centerAngle = rand() * Math.PI * 2;
  const petals = 3 + Math.floor(rand() * 3);
  const baseSize = 16 + rand() * 10;

  for (let p = 0; p < petals; p++) {
    const ang = centerAngle + (p - (petals - 1) / 2) * (Math.PI / 18);
    const cx = 500 + radius * Math.cos(ang);
    const cy = 500 + radius * Math.sin(ang);
    const pts = [];
    for (let k = 0; k < 4; k++) {
      const a = ang + k * (Math.PI / 2);
      const s = (k % 2 === 0) ? 1 : 0.55;
      pts.push(`${cx + baseSize * s * Math.cos(a)},${cy + baseSize * s * Math.sin(a)}`);
    }
    els.push({
      id: liveId("pt", index, p),
      type: "polygon",
      layer: "petals",
      points: pts.join(" "),
      fill: rand() < 0.5 ? paramsBase.palette.main1 : paramsBase.palette.main2,
      opacity: 0.38 + rand() * 0.18
    });
  }

  return els;
}

// stroke 4: runic bar / glyph near outer edge
function strokeGlyphRune(rand, paramsBase, index) {
  const els = [];
  const radius = 260 + (index % 5) * 6;
  const angle = rand() * Math.PI * 2;
  const cx = 500 + radius * Math.cos(angle);
  const cy = 500 + radius * Math.sin(angle);

  const w = 14 + rand() * 10;
  const h = 3 + rand() * 4;
  const rot = rand() * Math.PI * 2;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const corners = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2]
  ].map(([dx, dy]) => {
    const x = cx + dx * cos - dy * sin;
    const y = cy + dx * sin + dy * cos;
    return `${x},${y}`;
  });

  els.push({
    id: liveId("ru", index, 0),
    type: "polygon",
    layer: "accents",
    points: corners.join(" "),
    fill: paramsBase.palette.main3,
    opacity: 0.86
  });

  return els;
}

// stroke 5: spark cluster for subtle glitter
function strokeSparkCluster(rand, paramsBase, index) {
  const els = [];
  const baseRadius = 190 + rand() * 120;
  const centerAngle = rand() * Math.PI * 2;
  const count = 4 + Math.floor(rand() * 5);

  for (let i = 0; i < count; i++) {
    const offsetAng = (rand() - 0.5) * (Math.PI / 8);
    const r = baseRadius + (rand() - 0.5) * 18;
    const ang = centerAngle + offsetAng;
    const x = 500 + r * Math.cos(ang);
    const y = 500 + r * Math.sin(ang);
    els.push({
      id: liveId("sp", index, i),
      type: "circle",
      layer: "accents",
      cx: x,
      cy: y,
      r: 1.6 + rand() * 1.6,
      fill: paramsBase.palette.highlight,
      opacity: 0.45 + rand() * 0.2
    });
  }

  return els;
}

// choose a stroke type based on RNG
function applyCharRule(ch, index, paramsBase) {
  // advance running hash with this character
  liveHash = stepHash(liveHash, ch.charCodeAt(0), index);
  const rand = makeRNG(liveHash);

  const r = rand();
  let strokes = [];

  if (r < 0.2) {
    strokes = strokeRingArc(rand, paramsBase, index);
  } else if (r < 0.4) {
    strokes = strokeRadialBranch(rand, paramsBase, index);
  } else if (r < 0.6) {
    strokes = strokePetalCluster(rand, paramsBase, index);
  } else if (r < 0.8) {
    strokes = strokeGlyphRune(rand, paramsBase, index);
  } else {
    strokes = strokeSparkCluster(rand, paramsBase, index);
  }

  const ids = strokes.map(el => el.id);
  return { elements: strokes, ids };
}

// ---- live typing handler ------------------------------------

function handleLiveTextChange(newTextRaw, paletteMode) {
  if (!liveMode) return;

  const newText = newTextRaw;
  const trimmed = newText.trim();

  if (!trimmed) {
    renderFromText("", paletteMode);
    return;
  }

  const oldText = liveState.text;

  if (!liveState.initialised || !liveState.paramsBase) {
    setStatus("Growing...");
    renderFromText(trimmed, paletteMode, { totalDuration: 2200, pieceStagger: 22 });
    return;
  }

  if (trimmed === oldText) {
    return;
  }

  // simple append
  if (trimmed.startsWith(oldText)) {
    const added = trimmed.slice(oldText.length);
    const additions = [];
    const newCharEls = liveState.charElements.slice();

    for (let i = 0; i < added.length; i++) {
      const ch = added[i];
      const idx = oldText.length + i;
      const { elements: els, ids } = applyCharRule(ch, idx, liveState.paramsBase);
      additions.push(...els);
      newCharEls[idx] = ids;
    }

    const newElements = liveState.elements.concat(additions);
    renderSceneDiff(hostEl, liveState.elements, newElements, { totalDuration: 700, pieceStagger: 25 });

    liveState.elements = newElements;
    liveState.charElements = newCharEls;
    liveState.text = trimmed;

    lastScene = newElements;
    lastParams = liveState.paramsBase;
    lastSVGString = sceneToSVGString(newElements);

    setStatus("Typing growth active.");
    return;
  }

  // simple backspace from end
  if (oldText.startsWith(trimmed)) {
    const removedCount = oldText.length - trimmed.length;
    const removedCharEls = liveState.charElements.slice(trimmed.length, trimmed.length + removedCount);

    const idsToRemove = new Set();
    removedCharEls.forEach(arr => {
      if (Array.isArray(arr)) {
        arr.forEach(id => idsToRemove.add(id));
      }
    });

    const newElements = liveState.elements.filter(el => !idsToRemove.has(el.id));
    renderSceneDiff(hostEl, liveState.elements, newElements, { totalDuration: 550, pieceStagger: 18 });

    liveState.elements = newElements;
    liveState.charElements = liveState.charElements.slice(0, trimmed.length);
    liveState.text = trimmed;

    lastScene = newElements;
    lastParams = liveState.paramsBase;
    lastSVGString = sceneToSVGString(newElements);

    setStatus("Pruning strokes.");
    return;
  }

  // more complex edits (paste, mid-string change): rebuild
  setStatus("Re-growing...");
  renderFromText(trimmed, paletteMode, { totalDuration: 2000, pieceStagger: 25 });
}

// ---- button and input handlers ------------------------------

function handleGenerateClick() {
  const text = inputEl.value.trim();
  if (!text) {
    setStatus("Add some text first to grow an insignia.", true);
    return;
  }
  setStatus("Growing...");
  const paletteMode = paletteModeEl.value || "auto";
  renderFromText(text, paletteMode, { totalDuration: 3000, pieceStagger: 30 });
}

function handleLiveInput() {
  // keep the panel open while typing
  if (autoMinimizeTimeout) {
    clearTimeout(autoMinimizeTimeout);
    autoMinimizeTimeout = null;
  }
  if (panelEl) {
    panelEl.classList.remove("minimized");
  }

  updateStatsHint();
  const paletteMode = paletteModeEl.value || "auto";

  if (liveTimer) clearTimeout(liveTimer);
  const value = inputEl.value;

  liveTimer = setTimeout(() => {
    handleLiveTextChange(value, paletteMode);
  }, 140);
}


function downloadSVG() {
  if (!lastSVGString) {
    setStatus("Generate an insignia before exporting.", true);
    return;
  }
  setStatus("");

  const blob = new Blob([lastSVGString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const nameSeed = lastParams ? lastParams.seed.toString(16).padStart(8, "0") : "insignia";
  a.href = url;
  a.download = `glyphseed-${nameSeed}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  setStatus("SVG downloaded.");
}

function downloadPNG() {
  if (!lastSVGString) {
    setStatus("Generate an insignia before exporting.", true);
    return;
  }
  setStatus("Rendering PNG...");

  const size = parseInt(exportSizeEl.value, 10) || 1024;
  const svgBlob = new Blob([lastSVGString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();

  img.onload = function () {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);

    canvas.toBlob(blob => {
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const nameSeed = lastParams ? lastParams.seed.toString(16).padStart(8, "0") : "insignia";
      a.href = pngUrl;
      a.download = `glyphseed-${nameSeed}-${size}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(pngUrl);
      setStatus(`PNG downloaded at ${size} × ${size}.`);
    }, "image/png");
  };

  img.onerror = function () {
    URL.revokeObjectURL(url);
    setStatus("Could not render PNG from SVG.", true);
  };

  img.src = url;
}

// ---- DOM wiring ---------------------------------------------

function initDomRefs() {
  inputEl = document.getElementById("input-text");
  hintEl = document.getElementById("text-hint");
  generateBtn = document.getElementById("generate-btn");
  hostEl = document.getElementById("insignia-host");
  statusEl = document.getElementById("status-line");
  seedPill = document.getElementById("seed-pill");
  exportSizeEl = document.getElementById("export-size");
  downloadSvgBtn = document.getElementById("download-svg-btn");
  downloadPngBtn = document.getElementById("download-png-btn");
  paletteModeEl = document.getElementById("palette-mode");
  metaRowEl = document.getElementById("meta-row");
  panelEl = document.getElementById("control-panel");
  panelToggle = document.getElementById("panel-toggle");
}

function bindEvents() {
  inputEl.addEventListener("input", handleLiveInput);
  generateBtn.addEventListener("click", handleGenerateClick);
  downloadSvgBtn.addEventListener("click", downloadSVG);
  downloadPngBtn.addEventListener("click", downloadPNG);

  panelToggle.addEventListener("click", () => {
    if (panelEl.classList.contains("minimized")) {
      panelEl.classList.remove("minimized");
      if (autoMinimizeTimeout) {
        clearTimeout(autoMinimizeTimeout);
        autoMinimizeTimeout = null;
      }
    } else {
      panelEl.classList.add("minimized");
    }
  });

  updateStatsHint();
}

// ---- bootstrap ----------------------------------------------

async function bootstrap() {
  await runPreloader(document.body);
  initDomRefs();
  bindEvents();
}

document.addEventListener("DOMContentLoaded", bootstrap);
