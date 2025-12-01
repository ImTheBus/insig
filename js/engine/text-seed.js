
// /js/engine/text-seed.js
// version: 2025-12-01 03:25

// -------- HASH FUNCTION (FNV-1a) --------
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// -------- RNG (Xorshift32) --------
export function makeRNG(seed) {
  let s = seed || 1;
  return function rand() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5;  s >>>= 0;
    return (s >>> 0) / 4294967296;
  };
}

// -------- TEXT ANALYSIS --------
export function analyseText(text) {
  return {
    length: text.length,
    vowels: (text.match(/[aeiouAEIOU]/g) || []).length,
    consonants: (text.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length,
    digits: (text.match(/\d/g) || []).length,
    symbols: (text.match(/[^\w\s]/g) || []).length
  };
}

// -------- PALETTE BUILDER --------
function hsl(h, s, l, a) {
  return a === undefined
    ? `hsl(${h},${s}%,${l}%)`
    : `hsla(${h},${s}%,${l}%,${a})`;
}

export function buildPalette(baseHue, mode, rand) {
  if (mode === "cool") baseHue = 200 + rand()*50;
  if (mode === "warm") baseHue = 10 + rand()*60;
  if (mode === "sunset") baseHue = 280 + rand()*50;
  if (mode === "neon") baseHue = rand()*360;

  const bgInner = hsl((baseHue + 210) % 360, 35, 7);
  const bgOuter = hsl((baseHue + 210) % 360, 70, 3);

  const accent1 = hsl((baseHue + 40) % 360, 88, 60);
  const accent2 = hsl((baseHue + 66) % 360, 80, 61);
  const accent3 = hsl((baseHue + 320) % 360, 70, 55);

  const subtle = hsl((baseHue + 155) % 360, 60, 62);
  const highlight = hsl((baseHue + 115) % 360, 80, 74);

  return {
    backgroundInner: bgInner,
    backgroundOuter: bgOuter,
    main1: accent1,
    main2: accent2,
    main3: accent3,
    subtle,
    highlight
  };
}

// -------- PARAMS FROM TEXT --------
export function buildParamsFromText(text, paletteMode="auto") {
  const stats = analyseText(text);
  const seed = hashString(paletteMode + "|" + text);
  const rand = makeRNG(seed);

  const length = Math.max(stats.length, 1);
  const vowelRatio = stats.vowels / length;
  const digitRatio = stats.digits / length;

  const layoutMode = Math.floor(rand() * 4);
  const symmetry = [2, 4, 6][Math.floor(rand() * 3)];
  const detailLevel = Math.min(1 + length / 20, 8);
  const curveBias = vowelRatio;
  const structureLevel = digitRatio;
  const accentLevel = Math.min(stats.symbols, 15);

  const baseHue = Math.floor(rand() * 360);
  const palette = buildPalette(baseHue, paletteMode, rand);

  return {
    seed,
    stats,
    layoutMode,
    symmetry,
    detailLevel,
    curveBias,
    structureLevel,
    accentLevel,
    palette
  };
}


