// "World 2" portal arch, modelled on the reference: smooth pale-lavender stone,
// rounded pillars with recessed glowing cyan capsule strips, flared capitals and
// plinths, a curved arch with cyan hex gems and a crystal keystone, and bubbles
// drifting up through the opening.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { textSprite, FONTS } from '../util/text.js';
import { TUNING } from '../../shared/gameData.js';

// Dimensions (world units)
export const GATE = {
  halfOpening: 8.5, // inner half-width
  pillarW: 4,
  pillarD: 4,
  springY: 22, // where the arch starts curving
};
GATE.pillarX = GATE.halfOpening + GATE.pillarW / 2;

const STONE = '#dcdff6';
const STONE_SHADE = '#c4c9ec';
const RECESS = '#9aa6da';
const CYAN = '#2ff0ff';

const stoneMat = new THREE.MeshLambertMaterial({ color: STONE, emissive: '#8f98d8', emissiveIntensity: 0.18 });
const shadeMat = new THREE.MeshLambertMaterial({ color: STONE_SHADE, emissive: '#7f88cc', emissiveIntensity: 0.15 });
const recessMat = new THREE.MeshLambertMaterial({ color: RECESS });
const glowMat = new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false });

function rounded(w, h, d, mat, r = 0.5) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Half-annulus arch extruded along Z with a soft bevel.
function archMesh(inner, outer, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI, false);
  shape.lineTo(-inner, 0);
  shape.absarc(0, 0, inner, Math.PI, 0, true);
  shape.lineTo(outer, 0);
  const bevel = 0.45;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 48,
  });
  geo.translate(0, 0, -(depth - bevel * 2) / 2);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, stoneMat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Glowing capsule set into a darker recess, on the front and back of a pillar.
function glowStrip(length) {
  const g = new THREE.Group();
  const recess = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, length, 8, 16), recessMat);
  recess.scale.z = 0.35;
  const glow = new THREE.Mesh(new THREE.CapsuleGeometry(0.58, length - 0.2, 8, 16), glowMat);
  glow.scale.z = 0.35;
  glow.position.z = 0.12;
  // soft halo
  const halo = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.1, length + 0.4, 8, 16),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false })
  );
  halo.scale.z = 0.2;
  halo.position.z = 0.2;
  g.add(recess, glow, halo);
  return g;
}

function hexGem(r) {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.5, 6), glowMat);
  gem.rotation.x = Math.PI / 2;
  gem.rotation.y = Math.PI / 6;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.3, 6), shadeMat);
  rim.rotation.x = Math.PI / 2;
  rim.rotation.y = Math.PI / 6;
  rim.position.z = -0.15;
  g.add(rim, gem);
  return g;
}

export class WorldGate {
  constructor(x, z, ry) {
    this.root = new THREE.Group();
    this.root.position.set(x, 0.8, z);
    this.root.rotation.y = ry;
    const { halfOpening, pillarW, pillarD, springY, pillarX } = GATE;

    for (const sx of [-1, 1]) {
      const px = sx * pillarX;
      // Plinth (two steps)
      const p1 = rounded(pillarW + 2.2, 1.2, pillarD + 2.2, shadeMat, 0.35);
      p1.position.set(px, 0.6, 0);
      const p2 = rounded(pillarW + 1.2, 1.4, pillarD + 1.2, stoneMat, 0.4);
      p2.position.set(px, 1.8, 0);
      // Shaft
      const shaftH = springY - 4.6;
      const shaft = rounded(pillarW, shaftH, pillarD, stoneMat, 0.7);
      shaft.position.set(px, 2.5 + shaftH / 2, 0);
      // Capital (flared block under the arch)
      const cap1 = rounded(pillarW + 1.4, 1.0, pillarD + 1.2, shadeMat, 0.35);
      cap1.position.set(px, springY - 1.6, 0);
      const cap2 = rounded(pillarW + 2.0, 1.2, pillarD + 1.6, stoneMat, 0.4);
      cap2.position.set(px, springY - 0.6, 0);
      this.root.add(p1, p2, shaft, cap1, cap2);

      // Glow strips on both faces
      const len = shaftH - 4.5;
      for (const face of [1, -1]) {
        const s = glowStrip(len);
        s.position.set(px, 2.5 + shaftH / 2, face * (pillarD / 2 + 0.02));
        if (face < 0) s.rotation.y = Math.PI;
        this.root.add(s);
      }
    }

    // Curved arch resting on the capitals
    const inner = halfOpening + 0.2;
    const outer = pillarX + pillarW / 2 + 0.8;
    const arch = archMesh(inner, outer, pillarD + 0.8);
    arch.position.y = springY;
    this.root.add(arch);
    // Inner trim ring (slightly darker) for depth
    const trim = archMesh(inner - 0.5, inner + 0.3, pillarD + 1.3);
    trim.material = shadeMat;
    trim.position.y = springY;
    this.root.add(trim);

    // Hex gems on the arch face (front and back)
    const mid = (inner + outer) / 2;
    for (const face of [1, -1]) {
      for (const a of [Math.PI * 0.84, Math.PI * 0.16]) {
        const gem = hexGem(0.95);
        gem.position.set(Math.cos(a) * mid, springY + Math.sin(a) * mid, face * ((pillarD + 0.8) / 2 + 0.05));
        if (face < 0) gem.rotation.y = Math.PI;
        this.root.add(gem);
      }
    }

    // Crystal keystone at the top of the arch
    this.crystal = new THREE.Group();
    const crystalMat = new THREE.MeshLambertMaterial({ color: '#7ff4ff', emissive: '#18c8ff', emissiveIntensity: 0.9, transparent: true, opacity: 0.92 });
    const main = new THREE.Mesh(new THREE.OctahedronGeometry(1.8, 0), crystalMat);
    main.scale.set(1, 1.7, 0.7);
    const sideL = new THREE.Mesh(new THREE.OctahedronGeometry(1.0, 0), crystalMat);
    sideL.scale.set(1, 1.5, 0.6);
    sideL.position.set(-1.6, -0.6, 0);
    sideL.rotation.z = 0.35;
    const sideR = sideL.clone();
    sideR.position.x = 1.6;
    sideR.rotation.z = -0.35;
    this.crystal.add(main, sideL, sideR);
    this.crystal.position.set(0, springY + outer - 1.2, (pillarD + 0.8) / 2 + 0.6);
    this.crystal.userData.dynamic = true;
    this.root.add(this.crystal);

    // Faint portal sheet + rising bubbles in the opening
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(halfOpening * 2, springY + inner - 1),
      new THREE.MeshBasicMaterial({ color: '#9ff4ff', transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
    );
    sheet.position.y = (springY + inner - 1) / 2;
    this.root.add(sheet);
    const bubbleMat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#cfe8ff', emissiveIntensity: 0.4, transparent: true, opacity: 0.55, depthWrite: false });
    this.bubbles = Array.from({ length: 14 }, (_, i) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), bubbleMat);
      b.userData.dynamic = true;
      b.userData = { phase: i / 14, x: (Math.random() - 0.5) * 6, size: 0.35 + Math.random() * 0.5, sway: Math.random() * 6 };
      this.root.add(b);
      return b;
    });
    this.height = springY + inner;
    this.t = 0;

    // Label
    const label = textSprite(
      [
        { text: 'World 2', size: 150, font: FONTS.fredoka, fill: '#ffffff', stroke: '#2d2a44', strokeWidth: 22 },
        { text: `REQUIRED: ${TUNING.world2Rebirths} rebirths`, size: 74, font: FONTS.fredoka, fill: '#ff5a64', stroke: '#2d2a44', strokeWidth: 13 },
      ],
      9.5
    );
    label.position.set(0, springY + outer + 6.5, 0);
    this.root.add(label);
  }

  update(dt) {
    this.t += dt;
    this.crystal.rotation.y = Math.sin(this.t * 0.8) * 0.35;
    this.crystal.position.y = GATE.springY + GATE.pillarX + GATE.pillarW / 2 - 0.4 + Math.sin(this.t * 1.6) * 0.25;
    for (const b of this.bubbles) {
      const u = b.userData;
      const p = (this.t * 0.12 + u.phase) % 1;
      b.position.set(u.x + Math.sin(this.t * 1.3 + u.sway) * 0.6, 1 + p * (this.height - 3), Math.sin(u.sway) * 0.5);
      const fade = Math.min(1, p * 6, (1 - p) * 4);
      b.scale.setScalar(u.size * (0.4 + fade * 0.8));
    }
  }
}
