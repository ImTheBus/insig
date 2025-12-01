// /js/render/diff-renderer.js
// version: 2025-12-01 v0.2

import { renderSceneOrganic } from "./svg-renderer.js";

// Placeholder diff renderer.
// For now this simply re-renders the full scene organically.
// Later it can be upgraded to compare oldElements and newElements and
// animate only the differences.
export function renderSceneDiff(hostElement, oldElements, newElements, options = {}) {
  renderSceneOrganic(hostElement, newElements, options);
}
