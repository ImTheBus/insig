// /js/render/svg-renderer.js
// version: 2026-06-09 v1.0
//
// Pure rendering of a scene { defs, elements } into SVG. The element schema
// is produced by scene-builder.js. Two entry points:
//   - renderScene(host, scene, opts)  -> live DOM render with staggered reveal
//   - sceneToSVGString(scene)         -> deterministic standalone SVG string
//
// IMPORTANT: sceneToSVGString must be a pure function of the scene so that
// the same input text yields a byte-identical SVG (the cipher guarantee is
// verified against this string).

export const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW = 1000;

function buildDefs(defs) {
  const g = defs.bgGradient;
  return [
    `<radialGradient id="bgGradient" cx="50%" cy="46%" r="72%">`,
    `<stop offset="0%" stop-color="${g.inner}"></stop>`,
    `<stop offset="100%" stop-color="${g.outer}"></stop>`,
    `</radialGradient>`,
    `<filter id="glow" x="-60%" y="-60%" width="220%" height="220%">`,
    `<feGaussianBlur stdDeviation="4" result="b"></feGaussianBlur>`,
    `<feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>`,
    `</filter>`
  ].join("");
}

function elToString(el) {
  const glow = el.glow ? ' filter="url(#glow)"' : "";
  switch (el.type) {
    case "circle": {
      const stroke = el.stroke
        ? ` stroke="${el.stroke}" stroke-width="${el.strokeWidth}"` +
          (el.dash ? ` stroke-dasharray="${(el.r * 0.18).toFixed(1)} ${(el.r * 0.12).toFixed(1)}"` : "")
        : "";
      return `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" fill="${el.fill}"${stroke} opacity="${el.opacity}"${glow}></circle>`;
    }
    case "line":
      return `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linecap="round" opacity="${el.opacity}"${glow}></line>`;
    case "polygon": {
      const stroke = el.stroke ? ` stroke="${el.stroke}" stroke-width="${el.strokeWidth}"` : "";
      const lj = el.stroke ? ` stroke-linejoin="round"` : "";
      return `<polygon points="${el.points}" fill="${el.fill}"${stroke}${lj} opacity="${el.opacity}"${glow}></polygon>`;
    }
    case "path":
      return `<path d="${el.d}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" fill="${el.fill || "none"}" stroke-linecap="round" stroke-linejoin="round" opacity="${el.opacity}"${glow}></path>`;
    default:
      return "";
  }
}

// Deterministic standalone SVG string (used for export + determinism test).
export function sceneToSVGString(scene, size = VIEW) {
  const body = scene.elements.map(elToString).join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${size}" height="${size}">`,
    `<defs>${buildDefs(scene.defs)}</defs>`,
    `<rect width="${VIEW}" height="${VIEW}" fill="url(#bgGradient)"></rect>`,
    body,
    `</svg>`
  ].join("");
}

function createNode(el) {
  let node;
  if (el.type === "circle") {
    node = document.createElementNS(SVG_NS, "circle");
    node.setAttribute("cx", el.cx); node.setAttribute("cy", el.cy);
    node.setAttribute("r", el.r); node.setAttribute("fill", el.fill);
    if (el.stroke) {
      node.setAttribute("stroke", el.stroke);
      node.setAttribute("stroke-width", el.strokeWidth);
      if (el.dash) node.setAttribute("stroke-dasharray", `${(el.r * 0.18).toFixed(1)} ${(el.r * 0.12).toFixed(1)}`);
    }
  } else if (el.type === "line") {
    node = document.createElementNS(SVG_NS, "line");
    node.setAttribute("x1", el.x1); node.setAttribute("y1", el.y1);
    node.setAttribute("x2", el.x2); node.setAttribute("y2", el.y2);
    node.setAttribute("stroke", el.stroke);
    node.setAttribute("stroke-width", el.strokeWidth);
    node.setAttribute("stroke-linecap", "round");
  } else if (el.type === "polygon") {
    node = document.createElementNS(SVG_NS, "polygon");
    node.setAttribute("points", el.points);
    node.setAttribute("fill", el.fill);
    if (el.stroke) {
      node.setAttribute("stroke", el.stroke);
      node.setAttribute("stroke-width", el.strokeWidth);
      node.setAttribute("stroke-linejoin", "round");
    }
  } else if (el.type === "path") {
    node = document.createElementNS(SVG_NS, "path");
    node.setAttribute("d", el.d);
    node.setAttribute("stroke", el.stroke);
    node.setAttribute("stroke-width", el.strokeWidth);
    node.setAttribute("fill", el.fill || "none");
    node.setAttribute("stroke-linecap", "round");
    node.setAttribute("stroke-linejoin", "round");
  }
  if (!node) return null;
  node.setAttribute("opacity", el.opacity);
  if (el.glow) node.setAttribute("filter", "url(#glow)");
  node.classList.add("insig-piece");
  if (el.id) node.dataset.id = el.id;
  return node;
}

// Live render with a staggered "growth" reveal in growth order. Respects
// prefers-reduced-motion (renders instantly, no stagger).
export function renderScene(host, scene, opts = {}) {
  const reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  host.classList.remove("empty");
  host.innerHTML = "";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${VIEW} ${VIEW}`);
  svg.setAttribute("class", "insig-svg");
  svg.innerHTML = `<defs>${buildDefs(scene.defs)}</defs>` +
    `<rect width="${VIEW}" height="${VIEW}" fill="url(#bgGradient)"></rect>`;
  host.appendChild(svg);

  const stagger = opts.stagger != null ? opts.stagger : 14;
  const els = scene.elements.filter(e => e.layer !== "bg");

  if (reduce || stagger === 0) {
    for (const el of els) {
      const n = createNode(el);
      if (n) { n.classList.add("visible"); svg.appendChild(n); }
    }
    return;
  }

  els.forEach((el, idx) => {
    setTimeout(() => {
      if (!svg.isConnected) return;
      const n = createNode(el);
      if (!n) return;
      svg.appendChild(n);
      requestAnimationFrame(() => n.classList.add("visible"));
    }, idx * stagger);
  });
}
