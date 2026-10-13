// Canvas-rendered text for in-world signs, styled like the reference:
// Fredoka One / Montserrat, thick dark outline, optional gradient fill and italic skew.

import * as THREE from 'three';

export const FONTS = {
  fredoka: '"Fredoka One", "Fredoka", system-ui, sans-serif',
  montserrat: '"Montserrat", system-ui, sans-serif',
};

export async function loadFonts() {
  if (!document.fonts?.load) return;
  const loads = [
    document.fonts.load(`64px ${FONTS.fredoka}`),
    document.fonts.load(`900 64px ${FONTS.montserrat}`),
    document.fonts.load(`800 64px ${FONTS.montserrat}`),
    document.fonts.load(`700 64px ${FONTS.montserrat}`),
  ];
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 4000))]);
}

// line: { text, size, font, weight, fill (css color | [stops]), stroke, strokeWidth, italic, spans }
// spans lets one line mix colours: [{ text, fill }]
function fontString(l) {
  return `${l.weight || ''} ${l.size}px ${l.font || FONTS.fredoka}`.trim();
}

function measureLine(g, l) {
  g.font = fontString(l);
  if (l.spans) return l.spans.reduce((w, s) => w + g.measureText(s.text).width, 0);
  return g.measureText(l.text).width;
}

function fillFor(g, fill, x0, y0, x1, y1) {
  if (Array.isArray(fill)) {
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    fill.forEach((c, i) => grad.addColorStop(i / (fill.length - 1), c));
    return grad;
  }
  return fill || '#ffffff';
}

// Draws stacked lines into a new canvas, sized to fit. Returns { canvas, width, height }.
export function renderText(lines, { padding = 24, lineGap = 0.12, align = 'center', maxWidth = 2048 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const widths = lines.map((l) => measureLine(g, l) + (l.italic ? l.size * 0.35 : 0));
  const strokeMax = Math.max(...lines.map((l) => l.strokeWidth || 0));
  const w = Math.min(maxWidth, Math.ceil(Math.max(...widths) + padding * 2 + strokeMax * 2));
  const heights = lines.map((l) => l.size * (1 + lineGap));
  const h = Math.ceil(heights.reduce((a, b) => a + b, 0) + padding * 2 + strokeMax);
  c.width = w;
  c.height = h;

  let y = padding + strokeMax / 2;
  lines.forEach((l, i) => {
    g.save();
    g.font = fontString(l);
    g.textBaseline = 'top';
    g.lineJoin = 'round';
    g.miterLimit = 2;
    const lw = measureLine(g, l);
    let x = align === 'center' ? (w - lw) / 2 : padding + strokeMax / 2;
    const top = y + l.size * 0.06;
    if (l.italic) {
      // Skew around the line's baseline for a faux italic.
      g.translate(0, top + l.size);
      g.transform(1, 0, -0.22, 1, 0, 0);
      g.translate(l.size * 0.12, -(top + l.size));
    }
    const segments = l.spans || [{ text: l.text, fill: l.fill }];
    const draw = (fn) => {
      let cx = x;
      for (const s of segments) {
        fn(s, cx);
        cx += g.measureText(s.text).width;
      }
    };
    if (l.shadow) {
      g.fillStyle = l.shadow;
      draw((s, cx) => {
        if (l.strokeWidth) {
          g.lineWidth = l.strokeWidth;
          g.strokeStyle = l.shadow;
          g.strokeText(s.text, cx + l.size * 0.05, top + l.size * 0.07);
        }
        g.fillText(s.text, cx + l.size * 0.05, top + l.size * 0.07);
      });
    }
    if (l.strokeWidth) {
      g.lineWidth = l.strokeWidth;
      g.strokeStyle = l.stroke || '#14183a';
      draw((s, cx) => g.strokeText(s.text, cx, top));
    }
    draw((s, cx) => {
      g.fillStyle = fillFor(g, s.fill ?? l.fill, cx, top, cx, top + l.size);
      g.fillText(s.text, cx, top);
    });
    g.restore();
    y += heights[i];
  });
  return { canvas: c, width: w, height: h };
}

export function canvasTexture(canvas, aniso = 8) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// A flat text plane, `height` world units tall (width follows the aspect ratio).
export function textPlane(lines, height, opts = {}) {
  const { canvas, width, height: h } = renderText(lines, opts);
  const tex = canvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: opts.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    toneMapped: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry((height * width) / h, height), mat);
  mesh.renderOrder = 5;
  return mesh;
}

// A camera-facing sprite. Keeps a constant world size like Roblox BillboardGuis.
export function textSprite(lines, height, opts = {}) {
  const { canvas, width, height: h } = renderText(lines, opts);
  const tex = canvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false });
  if (opts.depthTest === false) mat.depthTest = false;
  const s = new THREE.Sprite(mat);
  s.scale.set((height * width) / h, height, 1);
  s.renderOrder = 6;
  return s;
}

// Re-renders a sprite/plane's texture in place (for countdowns).
export function updateTextObject(obj, lines, height, opts = {}) {
  const { canvas, width, height: h } = renderText(lines, opts);
  const old = obj.material.map;
  obj.material.map = canvasTexture(canvas);
  obj.material.needsUpdate = true;
  old?.dispose();
  if (obj.isSprite) obj.scale.set((height * width) / h, height, 1);
  else {
    obj.geometry.dispose();
    obj.geometry = new THREE.PlaneGeometry((height * width) / h, height);
  }
}

// Common styles from the reference
export const STYLE = {
  sign: (text, size = 96, extra = {}) => ({ text, size, font: FONTS.fredoka, fill: '#ffffff', stroke: '#1b2350', strokeWidth: size * 0.16, ...extra }),
  bold: (text, size = 64, extra = {}) => ({ text, size, font: FONTS.montserrat, weight: 900, fill: '#ffffff', stroke: '#141833', strokeWidth: size * 0.16, ...extra }),
};
