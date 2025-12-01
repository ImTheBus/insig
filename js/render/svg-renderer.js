// /js/render/svg-renderer.js
// version: 2025-12-01 v0.3

export const SVG_NS = "http://www.w3.org/2000/svg";

// Create a DOM node from an element descriptor
export function createNodeForElement(el, svgNS = SVG_NS) {
  let node;
  if (el.type === "ring") {
    node = document.createElementNS(svgNS, "circle");
    node.setAttribute("cx", el.cx);
    node.setAttribute("cy", el.cy);
    node.setAttribute("r", el.r);
    node.setAttribute("stroke", el.stroke);
    node.setAttribute("stroke-width", el.strokeWidth);
    node.setAttribute("fill", "none");
    node.setAttribute("opacity", el.opacity);
    if (el.blur) node.setAttribute("filter", "url(#softBlur)");
  } else if (el.type === "line") {
    node = document.createElementNS(svgNS, "line");
    node.setAttribute("x1", el.x1);
    node.setAttribute("y1", el.y1);
    node.setAttribute("x2", el.x2);
    node.setAttribute("y2", el.y2);
    node.setAttribute("stroke", el.stroke);
    node.setAttribute("stroke-width", el.strokeWidth);
    node.setAttribute("stroke-linecap", "round");
    node.setAttribute("opacity", el.opacity);
  } else if (el.type === "circle") {
    node = document.createElementNS(svgNS, "circle");
    node.setAttribute("cx", el.cx);
    node.setAttribute("cy", el.cy);
    node.setAttribute("r", el.r);
    node.setAttribute("fill", el.fill);
    node.setAttribute("opacity", el.opacity);
    if (el.blur) node.setAttribute("filter", "url(#softBlur)");
  } else if (el.type === "path") {
    node = document.createElementNS(svgNS, "path");
    node.setAttribute("d", el.d);
    node.setAttribute("stroke", el.stroke);
    node.setAttribute("stroke-width", el.strokeWidth);
    node.setAttribute("fill", el.fill || "none");
    node.setAttribute("opacity", el.opacity);
    node.setAttribute("stroke-linecap", "round");
    node.setAttribute("stroke-linejoin", "round");
  } else if (el.type === "polygon") {
    node = document.createElementNS(svgNS, "polygon");
    node.setAttribute("points", el.points);
    node.setAttribute("fill", el.fill);
    node.setAttribute("opacity", el.opacity);
  }
  if (node) {
    node.classList.add("insig-piece");
    if (el.id) node.dataset.id = el.id;
    if (el.layer) node.dataset.layer = el.layer;
  }
  return node;
}

// Renders a scene description into SVG with an organic, layered reveal.
export function renderSceneOrganic(hostElement, elements, options = {}) {
  const order = options.layerOrder || [
    "core-bg",
    "rings",
    "branches",
    "orbits",
    "spokes",
    "curves",
    "petals",
    "accents",
    "center"
  ];

  const totalDuration = options.totalDuration || 3000;
  const baseGroupDelay = totalDuration / order.length / 1.4;
  const pieceStagger = options.pieceStagger || 30;

  hostElement.classList.remove("empty");
  hostElement.innerHTML = "";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 1000 1000");
  svg.setAttribute("width", "1000");
  svg.setAttribute("height", "1000");

  const defsNode = document.createElementNS(SVG_NS, "defs");
  svg.appendChild(defsNode);

  const nonDefs = [];

  for (const el of elements) {
    if (el.type === "defs") {
      if (el.radialGradient) {
        const g = el.radialGradient;
        const grad = document.createElementNS(SVG_NS, "radialGradient");
        grad.setAttribute("id", g.id);
        grad.setAttribute("cx", g.cx);
        grad.setAttribute("cy", g.cy);
        grad.setAttribute("r", g.r);
        grad.setAttribute("fx", g.fx);
        grad.setAttribute("fy", g.fy);
        for (const st of g.stops) {
          const stop = document.createElementNS(SVG_NS, "stop");
          stop.setAttribute("offset", st.offset);
          stop.setAttribute("stop-color", st.color);
          stop.setAttribute("stop-opacity", st.opacity);
          grad.appendChild(stop);
        }
        defsNode.appendChild(grad);
      }
      if (el.blurFilter) {
        const f = el.blurFilter;
        const filter = document.createElementNS(SVG_NS, "filter");
        filter.setAttribute("id", f.id);
        filter.setAttribute("x", "-20%");
        filter.setAttribute("y", "-20%");
        filter.setAttribute("width", "140%");
        filter.setAttribute("height", "140%");
        const fe = document.createElementNS(SVG_NS, "feGaussianBlur");
        fe.setAttribute("stdDeviation", String(f.stdDeviation));
        filter.appendChild(fe);
        defsNode.appendChild(filter);
      }
    } else {
      nonDefs.push(el);
    }
  }

  hostElement.appendChild(svg);

  let baseDelay = 0;

  order.forEach(layerName => {
    const layerEls = nonDefs.filter(el => el.layer === layerName);
    if (!layerEls.length) return;

    layerEls.forEach((el, idx) => {
      const delay = baseDelay + idx * pieceStagger;
      setTimeout(() => {
        const node = createNodeForElement(el);
        if (!node) return;
        svg.appendChild(node);
        requestAnimationFrame(() => {
          node.classList.add("visible");
        });
      }, delay);
    });

    baseDelay += baseGroupDelay;
  });
}

// Produces an SVG string for export (no organic reveal).
export function sceneToSVGString(elements) {
  const viewBox = "0 0 1000 1000";
  let defs = "";
  let body = "";

  for (const el of elements) {
    if (el.type === "defs") {
      if (el.radialGradient) {
        const g = el.radialGradient;
        defs += `<radialGradient id="${g.id}" cx="${g.cx}" cy="${g.cy}" r="${g.r}" fx="${g.fx}" fy="${g.fy}">` +
          g.stops.map(st =>
            `<stop offset="${st.offset}" stop-color="${st.color}" stop-opacity="${st.opacity}"></stop>`
          ).join("") +
          `</radialGradient>`;
      }
      if (el.blurFilter) {
        const f = el.blurFilter;
        defs += `<filter id="${f.id}" x="-20%" y="-20%" width="140%" height="140%">` +
          `<feGaussianBlur stdDeviation="${f.stdDeviation}"></feGaussianBlur>` +
          `</filter>`;
      }
    } else if (el.type === "ring") {
      const filterAttr = el.blur ? ' filter="url(#softBlur)"' : "";
      body += `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" fill="none" opacity="${el.opacity}"${filterAttr}></circle>`;
    } else if (el.type === "line") {
      body += `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linecap="round" opacity="${el.opacity}"></line>`;
    } else if (el.type === "circle") {
      const filterAttr = el.blur ? ' filter="url(#softBlur)"' : "";
      body += `<circle cx="${el.cx}" cy="${el.cy}" r="${el.r}" fill="${el.fill}" opacity="${el.opacity}"${filterAttr}></circle>`;
    } else if (el.type === "path") {
      body += `<path d="${el.d}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" fill="${el.fill || "none"}" opacity="${el.opacity}" stroke-linecap="round" stroke-linejoin="round"></path>`;
    } else if (el.type === "polygon") {
      body += `<polygon points="${el.points}" fill="${el.fill}" opacity="${el.opacity}"></polygon>`;
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="1000" height="1000">`,
    `<defs>${defs}</defs>`,
    body,
    `</svg>`
  ].join("");
}
