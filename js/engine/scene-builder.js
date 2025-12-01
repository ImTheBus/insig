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
      stops: [
        { offset: "0%", color: params.palette.backgroundInner, opacity: 1 },
        { offset: "100%", color: params.palette.backgroundOuter, opacity: 1 }
      ]
    },
    blurFilter: {
      id: "softBlur",
      stdDeviation: 11
    }
  });

  // ---- RINGS -------------------------------------------------
  const baseRingCount = 3 + Math.floor(params.detailLevel);
  const extraRings = Math.floor(params.structureLevel * 4);
  const ringCount = Math.min(baseRingCount + extraRings, 9);

  for (let i = 0; i < ringCount; i++) {
    const t = i / Math.max(ringCount - 1, 1);
    const wobble = (rand() - 0.5) * 6; // subtle irregularity
    const r = radiusBase + t * (radiusMax - radiusBase) + wobble;
    elements.push({
      id: nextId("ring"),
      type: "ring",
      layer: "rings",
      cx: 500,
      cy: 500,
      r,
      stroke: i % 2 === 0 ? params.palette.main1 : params.palette.main2,
      strokeWidth: 5 + (1 - t) * 12 / symmetry,
      opacity: 0.18 + 0.32 * (1 - t),
      blur: i % 3 === 0 && i > 0
    });
  }

  // ---- ORBIT LINES -------------------------------------------
  const orbitCount = 3 + Math.floor(params.detailLevel / 2);
  for (let i = 0; i < orbitCount; i++) {
    const t = (i + 1) / (orbitCount + 1);
    const wobble = (rand() - 0.5) * 4;
    const r = radiusBase + 30 + t * (radiusMax - radiusBase - 60) + wobble;
    elements.push({
      id: nextId("orbit"),
      type: "ring",
      layer: "orbits",
      cx: 500,
      cy: 500,
      r,
      stroke: params.palette.subtle,
      strokeWidth: 0.9,
      opacity: 0.12,
      blur: false
    });
  }

  // ---- SPOKES ------------------------------------------------
  const spokeDensity = 10 + Math.floor(params.detailLevel * 4);
  const spokeCount = Math.min(spokeDensity * symmetry, 120);
  const spokeBaseLen = 60 + params.detailLevel * 10;
  const spokeJitter = 26 + params.detailLevel * 7;

  for (let i = 0; i < spokeCount; i++) {
    const t = i / spokeCount;
    const ang = t * Math.PI * 2;

    const len = spokeBaseLen + (rand() - 0.5) * spokeJitter;
    const innerR = radiusBase - 16;
    const outerR = innerR + len;

    elements.push({
      id: nextId("spoke"),
      type: "line",
      layer: "spokes",
      x1: 500 + innerR * Math.cos(ang),
      y1: 500 + innerR * Math.sin(ang),
      x2: 500 + outerR * Math.cos(ang),
      y2: 500 + outerR * Math.sin(ang),
      stroke: params.palette.subtle,
      strokeWidth: 1.1 + rand() * 2.1,
      opacity: 0.13 + 0.26 * (1 - params.curveBias)
    });
  }

  // ---- BRANCHES (organic radial trees) -----------------------
  const branchDepth = 2 + Math.floor(params.detailLevel / 2);
  const baseBranchLen = 40 + params.detailLevel * 6;
  const branchSpread = Math.PI / 6 + params.curveBias * (Math.PI / 12);

  function addBranch(cx, cy, angle, length, depth) {
    const x2 = cx + length * Math.cos(angle);
    const y2 = cy + length * Math.sin(angle);

    elements.push({
      id: nextId("branch"),
      type: "line",
      layer: "branches",
      x1: cx,
      y1: cy,
      x2,
      y2,
      stroke: params.palette.subtle,
      strokeWidth: Math.max(0.8, 2.6 - depth * 0.6),
      opacity: 0.18 + 0.12 * depth
    });

    if (depth <= 0) return;
    const shrink = 0.68 + (rand() * 0.12);
    const nextLen = length * shrink;
    const delta = branchSpread * (0.75 + rand() * 0.4);

    addBranch(x2, y2, angle + delta, nextLen, depth - 1);
    addBranch(x2, y2, angle - delta, nextLen, depth - 1);
  }

  for (let i = 0; i < params.symmetry; i++) {
    const baseAngle = (i / params.symmetry) * Math.PI * 2;
    const startR = radiusBase + 10;
    const sx = 500 + startR * Math.cos(baseAngle);
    const sy = 500 + startR * Math.sin(baseAngle);
    addBranch(sx, sy, baseAngle, baseBranchLen, branchDepth);
  }

  // ---- CURVED BANDS ------------------------------------------
  const curveGroups = 2 + Math.floor(params.curveBias * 4);
  for (let g = 0; g < curveGroups; g++) {
    const baseAngle = rand() * Math.PI * 2;
    const bandRadius = radiusBase + 40 + rand() * (radiusMax - radiusBase - 120);
    const bandWidth = 18 + rand() * 32;

    const parts = [];
    const segments = 64;

    for (let i = 0; i <= segments; i++) {
      const tt = i / segments;
      const ang = baseAngle + (tt - 0.5) * (Math.PI * 1.7);
      const wobble = Math.sin(tt * Math.PI * 4 + g) * 16 * params.curveBias;
      const r = bandRadius + wobble;
      parts.push(`${500 + r * Math.cos(ang)} ${500 + r * Math.sin(ang)}`);
    }

    elements.push({
      id: nextId("curve"),
      type: "path",
      layer: "curves",
      d: `M ${parts.join(" L ")}`,
      stroke: params.palette.main3,
      strokeWidth: bandWidth / 11,
      opacity: 0.2 + 0.18 * params.curveBias,
      fill: "none"
    });
  }

  // ---- PETALS ------------------------------------------------
  const petalRadius = 210;
  const petalCount = symmetry * 2;

  for (let i = 0; i < petalCount; i++) {
    const ang = (i / petalCount) * Math.PI * 2;
    const cx = 500 + petalRadius * Math.cos(ang);
    const cy = 500 + petalRadius * Math.sin(ang);
    const baseSize = 40 + params.detailLevel * 2;

    const pts = [];
    const innerOffset = Math.PI / 2;
    for (let k = 0; k < 4; k++) {
      const a = ang + innerOffset * k;
      const s = (k % 2 === 0) ? 1 : 0.55;
      pts.push(`${cx + baseSize * s * Math.cos(a)},${cy + baseSize * s * Math.sin(a)}`);
    }

    elements.push({
      id: nextId("petal"),
      type: "polygon",
      layer: "petals",
      points: pts.join(" "),
      fill: params.palette.main1,
      opacity: 0.4
    });
  }

  // ---- ACCENTS (triangles, dots) -----------------------------
  const accentCount = Math.min(params.accentLevel * 3, 40);

  for (let i = 0; i < accentCount; i++) {
    const ringT = rand();
    const r = radiusBase + 30 + ringT * (radiusMax - radiusBase - 80);
    const ang = rand() * Math.PI * 2;

    const cx = 500 + r * Math.cos(ang);
    const cy = 500 + r * Math.sin(ang);
    const size = 6 + rand() * 14;
    const rot = rand() * Math.PI * 2;

    const pts = [];
    for (let k = 0; k < 3; k++) {
      const a = rot + k * (Math.PI * 2 / 3);
      pts.push(`${cx + size * Math.cos(a)},${cy + size * Math.sin(a)}`);
    }

    elements.push({
      id: nextId("accent"),
      type: "polygon",
      layer: "accents",
      points: pts.join(" "),
      fill: params.palette.highlight,
      opacity: 0.6
    });
  }

  // ---- CENTER ------------------------------------------------
  elements.push({
    id: nextId("core-bg"),
    type: "circle",
    layer: "core-bg",
    cx: 500,
    cy: 500,
    r: 88,
    fill: "url(#bgGradient)",
    opacity: 0.96,
    blur: true
  });

  elements.push({
    id: nextId("center"),
    type: "circle",
    layer: "center",
    cx: 500,
    cy: 500,
    r: 76,
    stroke: params.palette.main1,
    strokeWidth: 3.8,
    fill: "none",
    opacity: 0.96
  });

  elements.push({
    id: nextId("center"),
    type: "circle",
    layer: "center",
    cx: 500,
    cy: 500,
    r: 60,
    stroke: params.palette.main2,
    strokeWidth: 2.4,
    fill: "none",
    opacity: 0.96
  });

  const sides = [4, 5, 6, 8][params.layoutMode];
  const innerRadius = 36;
  const innerRot = Math.PI / sides;

  const pts = [];
  for (let i = 0; i < sides; i++) {
    const ang = innerRot + i * (Math.PI * 2 / sides);
    pts.push(`${500 + innerRadius * Math.cos(ang)},${500 + innerRadius * Math.sin(ang)}`);
  }

  elements.push({
    id: nextId("center"),
    type: "polygon",
    layer: "center",
    points: pts.join(" "),
    fill: params.palette.subtle,
    opacity: 0.96
  });

  elements.push({
    id: nextId("center-dot"),
    type: "circle",
    layer: "center",
    cx: 500,
    cy: 500,
    r: 8 + params.curveBias * 12,
    fill: params.palette.highlight,
    opacity: 0.98
  });

  return elements;
}
