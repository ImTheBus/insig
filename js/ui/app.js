// /js/ui/app.js
// version: 2025-12-01 v0.2

import { buildParamsFromText } from "../engine/text-seed.js";
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
const liveMode = true; // initial: live growth on keystroke

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
    return;
  }

  const params = buildParamsFromText(text, paletteMode);
  const scene = buildScene(params);

  const renderOpts = {
    totalDuration: options.totalDuration || 3000,
    pieceStagger: options.pieceStagger || 30
  };

  renderSceneDiff(hostEl, lastScene, scene, renderOpts);

  const seedHex = "0x" + params.seed.toString(16).padStart(8, "0");
  const seedSpan = seedPill.querySelector("span:last-child");
  if (seedSpan) seedSpan.textContent = "Seed: " + seedHex;

  metaRowEl.innerHTML =
    `<div class="meta-tag">Layout: ${layoutLabel(params.layoutMode)}</div>` +
    `<div class="meta-tag">Symmetry: ${params.symmetry} fold</div>` +
    `<div class="meta-tag">Detail: ${params.detailLevel.toFixed(1)}</div>`;

  lastScene = scene;
  lastParams = params;
  lastSVGString = sceneToSVGString(scene);

  setStatus("Insignia grown. Use SVG or PNG to export.");
  scheduleAutoMinimise();
}

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
  updateStatsHint();
  if (!liveMode) return;

  const text = inputEl.value;
  const paletteMode = paletteModeEl.value || "auto";

  if (liveTimer) clearTimeout(liveTimer);
  liveTimer = setTimeout(() => {
    if (!text.trim()) {
      renderFromText("", paletteMode);
      return;
    }
    setStatus("Growing...");
    renderFromText(text.trim(), paletteMode, { totalDuration: 1800, pieceStagger: 18 });
  }, 160);
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

async function bootstrap() {
  await runPreloader(document.body);
  initDomRefs();
  bindEvents();
}

document.addEventListener("DOMContentLoaded", bootstrap);
