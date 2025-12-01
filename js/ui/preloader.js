// /js/ui/preloader.js
// version: 2025-12-01 v0.2

import { buildParamsFromText } from "../engine/text-seed.js";
import { buildScene } from "../engine/scene-builder.js";
import { renderSceneOrganic } from "../render/svg-renderer.js";

// Simple breathing preloader.
// Draws a default insignia, gently scales it, then removes overlay.
export async function runPreloader(rootElement) {
  const overlay = document.createElement("div");
  overlay.id = "glyphseed-preloader";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "50";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.background = "#020617";
  overlay.style.transition = "opacity 0.8s ease";
  overlay.style.opacity = "1";

  const host = document.createElement("div");
  host.id = "preloader-insignia";
  host.style.width = "min(60vmin, 520px)";
  host.style.height = "min(60vmin, 520px)";
  host.style.animation = "glyphseedBreathe 3s ease-in-out infinite";
  host.style.transformOrigin = "center";

  overlay.appendChild(host);
  rootElement.appendChild(overlay);

  // Build a default sigil from fixed text
  const params = buildParamsFromText("glyphseed-breath", "cool");
  const scene = buildScene(params);
  renderSceneOrganic(host, scene, { totalDuration: 1800, pieceStagger: 20 });

  // Wait for a few "breaths"
  await new Promise(resolve => setTimeout(resolve, 5500));

  overlay.style.opacity = "0";
  setTimeout(() => {
    overlay.remove();
  }, 800);
}
