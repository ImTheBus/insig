// /js/engine/scene-builder.js
// version: 2025-12-01 v0.3

import { makeRNG } from "./text-seed.js";

// utility for element IDs
let idCounter = 0;
function nextId(layer) {
  idCounter++;
  return `${layer}-${idCounter}`;
}

// build a group of SVG element descriptions
export function buildScene(params) {
  idCounter = 0; // reset ID counter every build

  const rand = makeRNG(params.seed);
  const elements = [];
  const symmetry = params.symmetry;

  const radiusBase = 120;
  const radiusMax = 360;

  // ---- DEFS --------------------------------------------------
  elements.push({
    id: nextId("defs"),
    type: "defs",
    radialGradient: {
      id: "bgGradient",
      cx: "50%",
      cy: "50%",
      r: "70%",
      fx: "50%",
      fy: "34%",
