// 2D collision on the XZ plane (oriented boxes + circles) and a ground height map
// built from rectangles. Plenty for a kart in a blocky plaza.

export class Collision {
  constructor() {
    this.boxes = []; // { x, z, hw, hd, cos, sin }
    this.circles = []; // { x, z, r }
    this.heights = []; // { minX, maxX, minZ, maxZ, y }
    this.bounds = null;
  }

  addBox(x, z, w, d, ry = 0) {
    this.boxes.push({ x, z, hw: w / 2, hd: d / 2, cos: Math.cos(ry), sin: Math.sin(ry) });
  }

  addCircle(x, z, r) {
    this.circles.push({ x, z, r });
  }

  addHeight(minX, maxX, minZ, maxZ, y) {
    this.heights.push({ minX, maxX, minZ, maxZ, y });
  }

  setBounds(b) {
    this.bounds = b;
  }

  // Sloped ground: height goes from yNear (at maxZ) to yFar (at minZ).
  addRamp(minX, maxX, minZ, maxZ, yNear, yFar) {
    (this.ramps ||= []).push({ minX, maxX, minZ, maxZ, yNear, yFar });
  }

  // Ground whose height is any function of z (curved hills).
  addCurve(minX, maxX, minZ, maxZ, fn) {
    (this.curves ||= []).push({ minX, maxX, minZ, maxZ, fn });
  }

  heightAt(x, z) {
    let y = 0;
    for (const h of this.heights) {
      if (x >= h.minX && x <= h.maxX && z >= h.minZ && z <= h.maxZ && h.y > y) y = h.y;
    }
    for (const c of this.curves || []) {
      if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
      const cy = c.fn(z);
      if (cy > y) y = cy;
    }
    for (const r of this.ramps || []) {
      if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
      const ry = r.yNear + ((r.maxZ - z) / (r.maxZ - r.minZ)) * (r.yFar - r.yNear);
      if (ry > y) y = ry;
    }
    return y;
  }

  // Pushes a circle of radius r out of every obstacle. Returns { x, z, hit, nx, nz }.
  resolve(x, z, r) {
    let hit = false;
    let nx = 0;
    let nz = 0;
    for (let iter = 0; iter < 2; iter++) {
      for (const b of this.boxes) {
        // Into box space (rotation by -ry)
        const dx = x - b.x;
        const dz = z - b.z;
        const lx = dx * b.cos - dz * b.sin;
        const lz = dx * b.sin + dz * b.cos;
        const cx = Math.max(-b.hw, Math.min(b.hw, lx));
        const cz = Math.max(-b.hd, Math.min(b.hd, lz));
        let ox = lx - cx;
        let oz = lz - cz;
        let d2 = ox * ox + oz * oz;
        if (d2 >= r * r) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-5) {
          // Centre inside the box: push out along the shallowest axis.
          const px = b.hw - Math.abs(lx);
          const pz = b.hd - Math.abs(lz);
          if (px < pz) {
            ox = Math.sign(lx) || 1;
            oz = 0;
            d = -px;
          } else {
            ox = 0;
            oz = Math.sign(lz) || 1;
            d = -pz;
          }
        } else {
          ox /= d;
          oz /= d;
        }
        const push = r - d;
        const lpx = lx + ox * push;
        const lpz = lz + oz * push;
        // Back to world space (rotation by +ry)
        x = b.x + lpx * b.cos + lpz * b.sin;
        z = b.z - lpx * b.sin + lpz * b.cos;
        nx = ox * b.cos + oz * b.sin;
        nz = -ox * b.sin + oz * b.cos;
        hit = true;
      }
      for (const c of this.circles) {
        const dx = x - c.x;
        const dz = z - c.z;
        const min = r + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-8) continue;
        const d = Math.sqrt(d2);
        x = c.x + (dx / d) * min;
        z = c.z + (dz / d) * min;
        nx = dx / d;
        nz = dz / d;
        hit = true;
      }
    }
    if (this.bounds) {
      const b = this.bounds;
      if (x < b.minX + r) { x = b.minX + r; nx = 1; nz = 0; hit = true; }
      if (x > b.maxX - r) { x = b.maxX - r; nx = -1; nz = 0; hit = true; }
      if (z < b.minZ + r) { z = b.minZ + r; nx = 0; nz = 1; hit = true; }
      if (z > b.maxZ - r) { z = b.maxZ - r; nx = 0; nz = -1; hit = true; }
    }
    return { x, z, hit, nx, nz };
  }
}
