// Procedural "stud" surface textures (the blocky plastic look of the reference) and
// helpers that scale box UVs so studs keep a constant world size on every face.

import * as THREE from 'three';

let maxAniso = 8;
export const setMaxAnisotropy = (n) => (maxAniso = n);

const cache = new Map();

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// White-based stud tile so one texture can be tinted by material.color.
//  - cells: studs per side
//  - checker: tint alternate blocks of `checker` studs slightly darker (floor/grass look)
//  - style: 'tile' (raised square with bevel, floor) or 'dot' (small square studs, walls)
export function studTexture({ cells = 4, checker = 0, style = 'tile', contrast = 1 } = {}) {
  const key = `${cells}|${checker}|${style}|${contrast}`;
  if (cache.has(key)) return cache.get(key);
  const px = 64;
  const size = cells * px;
  const c = makeCanvas(size);
  const g = c.getContext('2d');
  const k = contrast;

  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const x = cx * px;
      const y = cy * px;
      const dark = checker && ((Math.floor(cx / checker) + Math.floor(cy / checker)) % 2 === 1);
      const base = dark ? 236 : 250;
      g.fillStyle = `rgb(${base},${base},${base})`;
      g.fillRect(x, y, px, px);

      if (style === 'tile') {
        // Roblox-like stud: inset square, dark top/left groove, bright bottom/right lip.
        const i = 12;
        const s = px - i * 2;
        g.fillStyle = `rgba(255,255,255,${0.55 * k})`;
        g.fillRect(x + i, y + i, s, s);
        g.fillStyle = `rgba(40,48,90,${0.42 * k})`;
        g.fillRect(x + i - 3, y + i - 3, s + 3, 4); // top groove
        g.fillRect(x + i - 3, y + i - 3, 4, s + 3); // left groove
        g.fillStyle = `rgba(40,48,90,${0.16 * k})`;
        g.fillRect(x + i + 1, y + i + s - 3, s - 1, 3);
        g.fillRect(x + i + s - 3, y + i + 1, 3, s - 1);
        // seam between tiles
        g.fillStyle = `rgba(40,48,90,${0.1 * k})`;
        g.fillRect(x, y, px, 1.5);
        g.fillRect(x, y, 1.5, px);
      } else {
        // Wall studs: a small raised square with a shaded lower-right edge.
        const s = 26;
        const o = (px - s) / 2;
        g.fillStyle = `rgba(30,40,90,${0.22 * k})`;
        g.fillRect(x + o + 3, y + o + 3, s, s);
        g.fillStyle = `rgba(255,255,255,${0.6 * k})`;
        g.fillRect(x + o, y + o, s, s);
        g.fillStyle = `rgba(30,40,90,${0.12 * k})`;
        g.fillRect(x + o, y + o, s, 2);
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  cache.set(key, tex);
  return tex;
}

// Two-colour checkerboard of stud blocks (the plaza floor / grass look):
// `block` studs per checker square, each stud a small raised square with a
// light top edge and a coloured shadow on its lower edge. Colours are absolute.
export function checkerStudTexture({ light, dark, shadow, highlight = 'rgba(255,255,255,0.55)', block = 4, studPx = 32 } = {}) {
  const key = `chk|${light}|${dark}|${shadow}|${block}`;
  if (cache.has(key)) return cache.get(key);
  const studs = block * 2; // texture holds 2x2 checker squares
  const size = studs * studPx;
  const c = makeCanvas(size);
  const g = c.getContext('2d');
  for (let sy = 0; sy < studs; sy++) {
    for (let sx = 0; sx < studs; sx++) {
      const x = sx * studPx;
      const y = sy * studPx;
      const isDark = (Math.floor(sx / block) + Math.floor(sy / block)) % 2 === 1;
      g.fillStyle = isDark ? dark : light;
      g.fillRect(x, y, studPx, studPx);
      // thin cell grid line
      g.fillStyle = 'rgba(60,70,130,0.16)';
      g.fillRect(x, y, studPx, 1);
      g.fillRect(x, y, 1, studPx);
      // raised stud: shadow offset down, body, highlight on top
      const s = Math.round(studPx * 0.46);
      const o = Math.round((studPx - s) / 2);
      g.fillStyle = shadow;
      g.fillRect(x + o - 1, y + o + 2, s + 1, s);
      g.fillStyle = isDark ? dark : light;
      g.fillRect(x + o, y + o, s, s - 1);
      g.fillStyle = highlight;
      g.fillRect(x + o, y + o, s, 2);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x + o + 1, y + o + 2, s - 2, s - 4);
    }
  }
  // slightly darker seam between checker squares
  g.fillStyle = 'rgba(60,70,130,0.22)';
  for (let i = 0; i <= 2; i++) {
    g.fillRect(i * block * studPx - 1, 0, 2, size);
    g.fillRect(0, i * block * studPx - 1, size, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  cache.set(key, tex);
  return tex;
}

// Box mesh using a checker stud texture; `unit` = world size of one texture repeat.
export function checkerMaterial(colors) {
  const key = `chkmat|${colors.light}|${colors.dark}|${colors.shadow}`;
  let mat = matCache.get(key);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ map: checkerStudTexture(colors) });
    matCache.set(key, mat);
  }
  return mat;
}

export function checkerBox(w, h, d, colors, { unit = 11.2, cast = false, receive = true } = {}) {
  const geo = boxUVs(new THREE.BoxGeometry(w, h, d), w, h, d, unit);
  const mesh = new THREE.Mesh(geo, checkerMaterial(colors));
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

// Scales BoxGeometry UVs so the texture repeats every `unit` world units on every face.
// BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each).
export function boxUVs(geo, w, h, d, unit) {
  const uv = geo.attributes.uv;
  const spans = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = spans[f];
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * (su / unit), uv.getY(i) * (sv / unit));
    }
  }
  uv.needsUpdate = true;
  return geo;
}

const matCache = new Map();

// Shared stud material. `unit` is world units per texture repeat.
export function studMaterial(color, opts = {}) {
  const { cells = 4, checker = 0, style = 'tile', contrast = 1, emissive = 0x000000, emissiveIntensity = 0 } = opts;
  const key = `${color}|${cells}|${checker}|${style}|${contrast}|${emissive}|${emissiveIntensity}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({
    color: new THREE.Color(color),
    map: studTexture({ cells, checker, style, contrast }),
    emissive: new THREE.Color(emissive),
    emissiveIntensity,
  });
  matCache.set(key, m);
  return m;
}

const plainCache = new Map();
export function plainMaterial(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (plainCache.has(key)) return plainCache.get(key);
  const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(color), ...opts });
  plainCache.set(key, m);
  return m;
}

// Convenience: studded box mesh. `unit` = world units per texture tile (cells studs).
export function studBox(w, h, d, color, { unit = 10, cast = true, receive = true, ...opts } = {}) {
  const geo = boxUVs(new THREE.BoxGeometry(w, h, d), w, h, d, unit);
  const mesh = new THREE.Mesh(geo, studMaterial(color, opts));
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

export function plainBox(w, h, d, color, { cast = true, receive = true, ...opts } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plainMaterial(color, opts));
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

// Animated belt texture for treadmills: dark rubber with light cross stripes.
export function beltTexture() {
  if (cache.has('belt')) return cache.get('belt').clone();
  const c = makeCanvas(128);
  const g = c.getContext('2d');
  g.fillStyle = '#1a2552';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = '#2c3a74';
    g.fillRect(0, i * 32 + 4, 128, 14);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(0, i * 32 + 4, 128, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  cache.set('belt', tex);
  return tex.clone();
}
