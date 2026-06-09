// /js/engine/text-seed.js
// version: 2026-06-09 v1.0 (deterministic rebuild)
//
// Pure, deterministic text -> seed/hash utilities.
// No Math.random, no Date, no time, no nondeterministic ordering anywhere.
// The same string ALWAYS yields the same numbers here.

// -------- HASH FUNCTION (FNV-1a, 32-bit) --------
// Used for the short "signature" shown next to the art and for the
// per-character avalanche seed. Stable across all browsers.
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
    h >>>= 0;
  }
  return h >>> 0;
}

// -------- 32-bit mixer (murmur3 finaliser) --------
// Strong avalanche: flipping one input bit flips ~half the output bits.
// This is what gives the cipher its "different input -> very different image".
export function mix32(x) {
  let h = x >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// -------- RNG (Mulberry32) --------
// Deterministic, high-quality, fast. Given the same seed it always emits
// the same sequence. Used only for tiny, bounded per-character variation
// that is itself fully derived from the text.
export function makeRNG(seed) {
  let s = (seed >>> 0) || 1;
  return function rand() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -------- per-character seed --------
// Each character's visual contribution is seeded from BOTH the running
// content of the message so far AND the character itself AND its position.
// This makes the mapping order-sensitive (a cipher property): "cat" and
// "act" share characters but every glyph lands differently.
//
// runningHash carries forward; we return { seed, runningHash } so the
// caller can chain character by character, identically every time.
export function charSeed(runningHash, codePoint, index) {
  // Fold the codepoint and index into the running hash (FNV-style step),
  // then avalanche it. Deterministic and position-sensitive.
  let h = runningHash >>> 0;
  h ^= codePoint >>> 0;
  h = Math.imul(h, 16777619);
  h >>>= 0;
  h ^= (index + 1) * 0x9e3779b9;
  h >>>= 0;
  const seed = mix32(h);
  // advance the running hash so the NEXT character depends on this one
  const runningNext = mix32(seed ^ (runningHash << 1)) >>> 0;
  return { seed, runningHash: runningNext };
}

// -------- TEXT ANALYSIS (display only) --------
export function analyseText(text) {
  return {
    length: [...text].length,
    vowels: (text.match(/[aeiouAEIOU]/g) || []).length,
    consonants: (text.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length,
    digits: (text.match(/\d/g) || []).length,
    symbols: (text.match(/[^\w\s]/g) || []).length
  };
}

// -------- character classification --------
// Every input character maps to exactly ONE of a small set of visual
// "archetypes". The class drives WHICH kind of mark is grown; the
// per-character seed drives the exact geometry. Together they make the
// mapping rich, consistent, and information-preserving.
//
// Classes:
//   0 vowel       -> luminous node (filled orb + halo)
//   1 consonant   -> radial blade / spoke
//   2 digit       -> nested polygon (sides = digit, min 3)
//   3 space/sep   -> ring band (a new concentric ring -> "word" boundary)
//   4 symbol      -> branching twig
//   5 other       -> spark cluster
export function classifyChar(ch) {
  const code = ch.codePointAt(0);
  if (/[aeiouAEIOU]/.test(ch)) return { cls: 0, code, value: 0 };
  if (/[a-zA-Z]/.test(ch)) return { cls: 1, code, value: 0 };
  if (/[0-9]/.test(ch)) return { cls: 2, code, value: ch.charCodeAt(0) - 48 };
  if (/\s/.test(ch)) return { cls: 3, code, value: 0 };
  if (/[^\w\s]/.test(ch)) return { cls: 4, code, value: 0 };
  return { cls: 5, code, value: 0 };
}

// -------- PALETTE BUILDER --------
function hsl(h, s, l, a) {
  return a === undefined
    ? `hsl(${((h % 360) + 360) % 360},${s}%,${l}%)`
    : `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
}

// The base hue is derived deterministically from the full text hash, so the
// whole colourway is itself part of the encoding. Palette mode only shifts
// the family; the exact hue still comes from the text.
export function buildPalette(text, mode) {
  const baseHash = hashString("hue|" + text);
  let baseHue = baseHash % 360;

  if (mode === "ember") baseHue = 8 + (baseHash % 44);       // warm reds/oranges
  else if (mode === "tide") baseHue = 170 + (baseHash % 60); // teal/blue
  else if (mode === "orchid") baseHue = 270 + (baseHash % 60); // violet/magenta
  else if (mode === "verdant") baseHue = 95 + (baseHash % 60); // greens
  // "auto" keeps the raw text hue

  return {
    baseHue,
    backgroundInner: hsl(baseHue + 200, 32, 9),
    backgroundOuter: hsl(baseHue + 210, 60, 3),
    node: hsl(baseHue, 85, 64),         // vowels
    blade: hsl(baseHue + 32, 78, 60),   // consonants
    poly: hsl(baseHue + 300, 72, 60),   // digits
    ring: hsl(baseHue + 150, 55, 58),   // word rings
    twig: hsl(baseHue + 80, 62, 64),    // symbols
    spark: hsl(baseHue + 118, 90, 76),  // sparks / highlight
    core: hsl(baseHue + 50, 88, 70)
  };
}
