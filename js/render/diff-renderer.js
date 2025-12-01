// /js/render/diff-renderer.js
// version: 2025-12-01 v0.3

import { renderSceneOrganic, createNodeForElement } from "./svg-renderer.js";

export function renderSceneDiff(hostElement, oldElements, newElements, options = {}) {
  const svg = hostElement.querySelector("svg");

  // If there is no SVG yet, fall back to full organic render.
  if (!svg) {
    renderSceneOrganic(hostElement, newElements, options);
    return;
  }

  const existingById = {};
  svg.querySelectorAll(".insig-piece").forEach(node => {
    const id = node.dataset.id;
    if (id) existingById[id] = node;
  });

  const newById = {};
  newElements.forEach(el => {
    if (el.id) newById[el.id] = el;
  });

  // Fade out and remove pieces that no longer exist
  Object.keys(existingById).forEach(id => {
    if (!newById[id]) {
      const node = existingById[id];
      node.classList.remove("visible");
      node.addEventListener(
        "transitionend",
        () => {
          if (node.parentNode) node.parentNode.removeChild(node);
        },
        { once: true }
      );
    }
  });

  // Add new pieces
  newElements.forEach(el => {
    if (!el.id) return;
    if (existingById[el.id]) return;
    const node = createNodeForElement(el);
    if (!node) return;
    svg.appendChild(node);
    requestAnimationFrame(() => node.classList.add("visible"));
  });
}
