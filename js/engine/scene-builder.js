// /js/engine/scene-builder.js
// version: 2026-06-09 v1.0 (deterministic per-character growth)
//
// THE CIPHER ENGINE.
//
// The image is grown character by character. Each character of the input
// contributes exactly ONE visible "mark" to the composition, placed at a
// deterministic position on a golden-angle spiral. The KIND of mark is
// decided by the character's class (vowel / consonant / digit / space /
// symbol / other); its exact geometry, colour and rotation are decided by a
// per-character seed that depends on the character, its position, AND every
// character before it (a running hash). Word boundaries (spaces) also drop a
// concentric ring, so the structure echoes the phrase's shape.
//
// Determinism guarantees (no Math.random / Date / time anywhere):
//   - position i sits at angle i * GOLDEN_ANGLE and radius growing with i,
//   - the mark at i is seeded from charSeed(runningHash, code, i),
//   - the runningHash chains forward, so order matters (cipher property),
//   - identical input -> identical element list -> identical pixels.
//
// The returned list is a flat array of primitive descriptors consumed by
// the renderer. Element order is the growth order (char 0 first), so the
// reveal animation literally replays the message being written.

import { makeRNG, classifyChar, charSeed } from "./text-seed.js";

const CX = 500;
const CY = 500;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.39996 rad
const TWO_PI = Math.PI * 2;

let _id = 0;
function nid(prefix, i) {
  _id += 1;
  return `${prefix}-${i}-${_id}`;
}

// Spiral placement: deterministic for a given index and total length.
// Marks spread outward as the phrase grows; radius is normalised so short
// and long phrases both fill the frame pleasingly.
function spiralPos(index, total) {
  const t = total <= 1 ? 0.5 : index / (total - 1);
  const ang = index * GOLDEN_ANGLE;
  const rMin = 70;
  const rMax = 380;
  // sqrt spread = even areal density (classic phyllotaxis look)
  const r = rMin + Math.sqrt(t) * (rMax - rMin);
  return { ang, r, x: CX + r * Math.cos(ang), y: CY + r * Math.sin(ang), t };
}

// ---- per-class mark builders --------------------------------
// Each returns an array of primitive element descriptors. Geometry is fully
// derived from `rand` (seeded per character) + the deterministic position.

// vowel -> luminous node: a filled orb with a soft halo ring.
function markNode(rand, pal, pos, i) {
  const size = 7 + rand() * 9;
  return [
    {
      id: nid("halo", i), type: "circle", layer: "nodes",
      cx: pos.x, cy: pos.y, r: size + 6 + rand() * 6,
      fill: "none", stroke: pal.node, strokeWidth: 1.1,
      opacity: 0.28 + rand() * 0.18
    },
    {
      id: nid("node", i), type: "circle", layer: "nodes",
      cx: pos.x, cy: pos.y, r: size,
      fill: pal.node, opacity: 0.82, glow: true
    }
  ];
}

// consonant -> radial blade: a tapered line pointing outward from centre,
// with a small cross-tick. Angle aligned to the spiral spoke + jitter.
function markBlade(rand, pal, pos, i) {
  const ang = pos.ang + (rand() - 0.5) * 0.5;
  const len = 26 + rand() * 40;
  const x1 = pos.x - Math.cos(ang) * len * 0.4;
  const y1 = pos.y - Math.sin(ang) * len * 0.4;
  const x2 = pos.x + Math.cos(ang) * len * 0.6;
  const y2 = pos.y + Math.sin(ang) * len * 0.6;
  const perp = ang + Math.PI / 2;
  const tick = 5 + rand() * 6;
  return [
    {
      id: nid("blade", i), type: "line", layer: "blades",
      x1, y1, x2, y2, stroke: pal.blade,
      strokeWidth: 1.4 + rand() * 2.4, opacity: 0.62 + rand() * 0.2
    },
    {
      id: nid("tick", i), type: "line", layer: "blades",
      x1: pos.x - Math.cos(perp) * tick, y1: pos.y - Math.sin(perp) * tick,
      x2: pos.x + Math.cos(perp) * tick, y2: pos.y + Math.sin(perp) * tick,
      stroke: pal.blade, strokeWidth: 1.0, opacity: 0.5
    }
  ];
}

// digit -> nested polygon whose side count == the digit value (min 3).
// The digit is literally legible from the shape: '5' is a pentagon.
function markPoly(rand, pal, pos, i, value) {
  const sides = Math.max(3, value === 0 ? 10 : value + 2);
  const size = 12 + rand() * 12;
  const rot = rand() * TWO_PI;
  const pts = [];
  for (let k = 0; k < sides; k++) {
    const a = rot + (k / sides) * TWO_PI;
    pts.push(`${(pos.x + size * Math.cos(a)).toFixed(2)},${(pos.y + size * Math.sin(a)).toFixed(2)}`);
  }
  const inner = [];
  for (let k = 0; k < sides; k++) {
    const a = rot + (k / sides) * TWO_PI;
    inner.push(`${(pos.x + size * 0.5 * Math.cos(a)).toFixed(2)},${(pos.y + size * 0.5 * Math.sin(a)).toFixed(2)}`);
  }
  return [
    {
      id: nid("poly", i), type: "polygon", layer: "polys",
      points: pts.join(" "), fill: "none",
      stroke: pal.poly, strokeWidth: 1.8, opacity: 0.8
    },
    {
      id: nid("polyi", i), type: "polygon", layer: "polys",
      points: inner.join(" "), fill: pal.poly, opacity: 0.22
    }
  ];
}

// symbol -> branching twig: a short fractal sprig (deterministic recursion).
function markTwig(rand, pal, pos, i) {
  const els = [];
  const baseAng = pos.ang + (rand() - 0.5) * 1.2;
  function branch(x, y, ang, len, depth, k) {
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    els.push({
      id: nid("twig", i) + "-" + depth + "-" + k,
      type: "line", layer: "twigs",
      x1: x, y1: y, x2, y2, stroke: pal.twig,
      strokeWidth: Math.max(0.8, 2.2 - depth * 0.6),
      opacity: 0.5 + 0.12 * depth
    });
    if (depth <= 0) return;
    const spread = 0.5 + rand() * 0.3;
    const nl = len * (0.62 + rand() * 0.12);
    branch(x2, y2, ang + spread, nl, depth - 1, k * 2);
    branch(x2, y2, ang - spread, nl, depth - 1, k * 2 + 1);
  }
  branch(pos.x, pos.y, baseAng, 22 + rand() * 18, 2, 1);
  return els;
}

// other (non-ascii etc.) -> spark cluster.
function markSpark(rand, pal, pos, i) {
  const els = [];
  const count = 4 + Math.floor(rand() * 4);
  for (let k = 0; k < count; k++) {
    const a = rand() * TWO_PI;
    const rr = 4 + rand() * 16;
    els.push({
      id: nid("spark", i) + "-" + k,
      type: "circle", layer: "sparks",
      cx: pos.x + Math.cos(a) * rr, cy: pos.y + Math.sin(a) * rr,
      r: 1.2 + rand() * 1.8, fill: pal.spark,
      opacity: 0.5 + rand() * 0.3, glow: true
    });
  }
  return els;
}

// space -> a concentric ring band (word boundary). Drawn at the radius the
// next character will start from, so words read as nested shells.
function markWordRing(rand, pal, pos, i, ringIndex) {
  const r = 90 + ringIndex * 42 + rand() * 10;
  return [{
    id: nid("ring", i), type: "circle", layer: "rings",
    cx: CX, cy: CY, r, fill: "none", stroke: pal.ring,
    strokeWidth: 1.0 + rand() * 1.4,
    opacity: 0.22 + rand() * 0.12, dash: ringIndex % 2 === 0
  }];
}

// ---- main build --------------------------------------------
// Returns { defs, elements } where elements are in growth order.
export function buildScene(text, palette) {
  _id = 0;
  const chars = [...text]; // codepoint-aware
  const total = chars.length;

  const defs = {
    bgGradient: {
      inner: palette.backgroundInner,
      outer: palette.backgroundOuter
    },
    glow: true
  };

  const elements = [];

  // Background plate (deterministic, no seed needed).
  elements.push({
    id: "bg", type: "circle", layer: "bg",
    cx: CX, cy: CY, r: 470, fill: "url(#bgGradient)", opacity: 1
  });

  let runningHash = 0x811c9dc5; // FNV offset basis, deterministic start
  let wordRingIndex = 0;

  for (let i = 0; i < total; i++) {
    const ch = chars[i];
    const info = classifyChar(ch);
    const seeded = charSeed(runningHash, info.code, i);
    runningHash = seeded.runningHash;
    const rand = makeRNG(seeded.seed);
    const pos = spiralPos(i, total);

    let marks;
    switch (info.cls) {
      case 0: marks = markNode(rand, palette, pos, i); break;
      case 1: marks = markBlade(rand, palette, pos, i); break;
      case 2: marks = markPoly(rand, palette, pos, i, info.value); break;
      case 3:
        marks = markWordRing(rand, palette, pos, i, wordRingIndex);
        wordRingIndex += 1;
        break;
      case 4: marks = markTwig(rand, palette, pos, i); break;
      default: marks = markSpark(rand, palette, pos, i); break;
    }
    // tag every element with its source char index for the diff/reveal
    for (const m of marks) m.charIndex = i;
    elements.push(...marks);
  }

  // Central sigil core: size/segments deterministically from text length.
  const coreSeed = makeRNG(0xC0FFEE ^ total ^ palette.baseHue);
  const coreSides = 3 + (total % 6);
  const corePts = [];
  for (let k = 0; k < coreSides; k++) {
    const a = (k / coreSides) * TWO_PI - Math.PI / 2;
    corePts.push(`${(CX + 30 * Math.cos(a)).toFixed(2)},${(CY + 30 * Math.sin(a)).toFixed(2)}`);
  }
  elements.push({
    id: "core-ring", type: "circle", layer: "core",
    cx: CX, cy: CY, r: 44, fill: "none", stroke: palette.core,
    strokeWidth: 2.2, opacity: 0.9
  });
  elements.push({
    id: "core-poly", type: "polygon", layer: "core",
    points: corePts.join(" "), fill: palette.core, opacity: 0.85, glow: true
  });
  elements.push({
    id: "core-dot", type: "circle", layer: "core",
    cx: CX, cy: CY, r: 6 + (coreSeed() * 5), fill: palette.spark,
    opacity: 0.95, glow: true
  });

  return { defs, elements };
}
