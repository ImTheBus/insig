// /js/ui/app.js
// version: 2025-12-01 v0.3

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
}

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

  // full organic render, not diff
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
}

// character rule helpers

let liveIdCounter = 0;
function liveId(prefix, index, k) {
  liveIdCounter += 1;
  return `live-${prefix}-${index}-${k}-${liveIdCounter}`;
}

function buildVowelBurst(chIndex, rand, paramsBase) {
  const els = [];
  const baseRadius = 220 + (chIndex % 5) * 10;
  const count = 4 + Math.floor(rand() * 5);

  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const r = baseRadius + (rand() - 0.5) * 26;
    const x = 500 + r * Math.cos(angle);
    const y = 500 + r * Math.sin(angle);
    els.push({
      id: liveId("v", chIndex, i),
      type: "circle",
      layer: "accents",
      cx: x,
      cy: y,
      r: 3 + rand() * 4,
      fill: paramsBase.palette.highlight,
      opacity: 0.78
    });
  }
  return els;
}

function buildConsonantBranch(chIndex, rand, paramsBase) {
  const els = [];
  const baseAngle = rand() * Math.PI * 2;
  const startR = 150 + (chIndex % 7) * 8;
  const length = 40 + rand() * 40;
  const depth = 2;

  function addSegment(cx, cy, angle, len, d, kBase) {
    const x2 = cx + len * Math.cos(angle);
    const y2 = cy + len * Math.sin(angle);
    const id = liveId("c", chIndex, kBase + d);

    els.push({
      id,
      type: "line",
      layer: "branches",
      x1: cx,
      y1: cy,
      x2,
      y2,
      stroke: paramsBase.palette.subtle,
      strokeWidth: Math.max(0.8, 2.4 - d * 0.5),
      opacity: 0.22 + 0.14 * d
    });

    if (d <= 0) return;
    const nextLen = len * (0.65 + rand() * 0.12);
    const delta = (Math.PI / 7) * (0.8 + rand() * 0.5);
    addSegment(x2, y2, angle + delta, nextLen, d - 1, kBase + 3);
    addSegment(x2, y2, angle - delta, nextLen, d - 1, kBase + 7);
  }

  const sx = 500 + startR * Math.cos(baseAngle);
  const sy = 500 + startR * Math.sin(baseAngle);
  addSegment(sx, sy, baseAngle, length, depth, 0);

  return els;
}

function buildDigitGlyph(chIndex, rand, paramsBase) {
  const els = [];
  const radius = 260 + (chIndex % 4) * 8;
  const angle = rand() * Math.PI * 2;
  const x = 500 + radius * Math.cos(angle);
  const y = 500 + radius * Math.sin(angle);

  const size = 10 + rand() * 8;
  const rot = rand() * Math.PI * 2;

  const pts = [];
  for (let i = 0; i < 4; i++) {
    const a = rot + i * (Math.PI / 2);
    pts.push(`${x + size * Math.cos(a)},${y + size * Math.sin(a)}`);
  }

  els.push({
    id: liveId("d", chIndex, 0),
    type: "polygon",
    layer: "accents",
    points: pts.join(" "),
    fill: paramsBase.palette.main2,
    opacity: 0.9
  });

  return els;
}

function buildSymbolRune(chIndex, rand, paramsBase) {
  const els = [];
  const radius = 300 + (chIndex % 5) * 6;
  const angle = rand() * Math.PI * 2;
  const cx = 500 + radius * Math.cos(angle);
  const cy = 500 + radius * Math.sin(angle);

  const w = 14;
  const h = 3;
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
    id: liveId("s", chIndex, 0),
    type: "polygon",
    layer: "accents",
    points: corners.join(" "),
    fill: paramsBase.palette.main3,
    opacity: 0.85
  });

  return els;
}

function applyCharRule(ch, index, paramsBase) {
  const seed = paramsBase.seed ^ (ch.charCodeAt(0) + index * 131);
  const rand = makeRNG(seed);

  let newEls = [];

  if (/[aeiou]/i.test(ch)) {
    newEls = buildVowelBurst(index, rand, paramsBase);
  } else if (/[0-9]/.test(ch)) {
    newEls = buildDigitGlyph(index, rand, paramsBase);
  } else if (/\s/.test(ch)) {
    newEls = [];
  } else if (/[^\w\s]/.test(ch)) {
    newEls = buildSymbolRune(index, rand, paramsBase);
  } else {
    newEls = buildConsonantBranch(index, rand, paramsBase);
  }

  const ids = newEls.map(el => el.id);
  return { elements: newEls, ids };
}

// live typing handler

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

  // more compl
