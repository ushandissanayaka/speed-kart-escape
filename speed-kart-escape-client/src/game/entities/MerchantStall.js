// Merchant's potion stall — "Merchant / Buy Potions" — plus the glowing blue pad in
// front that opens the potion shop. A big chunky market hut: stone base, wooden
// counter with planks, curved striped awning with a scalloped edge, a peaked roof
// with a sign, hanging lanterns, shelves of glowing potions and crates.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { studBox, plainBox } from '../util/textures.js';
import { textSprite, FONTS } from '../util/text.js';

const WOOD = '#8a5a44';
const WOOD_DARK = '#5e3a2e';
const WOOD_LIGHT = '#b07a58';
const STONE = '#a7aed6';
const CYAN = '#3fd8ea';

export const STALL_SIZE = { w: 30, d: 16 };

const mat = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
function rounded(w, h, d, m, r = 0.35) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function stripeTexture(n = 8) {
  const c = document.createElement('canvas');
  c.width = 64 * n;
  c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? '#ffffff' : CYAN;
    g.fillRect(i * 64, 0, 64, 64);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.fillRect(i * 64 + 58, 0, 6, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Glass potion bottle: body, neck, cork, glowing liquid.
function potion(color, scale = 1) {
  const g = new THREE.Group();
  const liquid = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), mat(color, { emissive: color, emissiveIntensity: 0.55 }));
  liquid.position.y = 0.85;
  liquid.scale.y = 1.05;
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false }));
  glass.position.y = 0.9;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.8, 12), new THREE.MeshLambertMaterial({ color: '#dfe8ff', transparent: true, opacity: 0.6 }));
  neck.position.y = 1.95;
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.4, 12), mat('#a8743c'));
  cork.position.y = 2.5;
  g.add(liquid, glass, neck, cork);
  g.scale.setScalar(scale);
  return g;
}

export class MerchantStall {
  constructor(x, z, padX, padZ) {
    this.root = new THREE.Group();
    const stall = new THREE.Group();
    stall.position.set(x, 0, z);
    const { w: W, d: D } = STALL_SIZE;
    const add = (m, px, py, pz) => {
      m.position.set(px, py, pz);
      stall.add(m);
      return m;
    };

    // Stone base
    add(studBox(W + 2, 1.2, D + 2, STONE, { unit: 2.6, cells: 2, style: 'dot' }), 0, 0.6, 0);

    // Chunky rounded wooden posts
    const postH = 17;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        add(rounded(1.8, postH, 1.8, mat(WOOD_DARK)), sx * (W / 2 - 1), 1.2 + postH / 2, sz * (D / 2 - 1));
      }
    }

    // Back wall of planks + shelves of potions
    for (let i = 0; i < 9; i++) add(rounded(W - 2, 1.9, 0.8, mat(i % 2 ? WOOD : WOOD_LIGHT), 0.25), 0, 2.4 + i * 2, -D / 2 + 1.2);
    const colors = ['#ff3d7a', '#3ec7ff', '#9b3bff', '#42ec7c', '#ffd21c', '#ff7a2a'];
    for (const [row, y] of [
      [0, 8.6],
      [1, 12.2],
    ]) {
      add(rounded(W - 4, 0.5, 2.6, mat(WOOD_DARK), 0.15), 0, y, -D / 2 + 2.6);
      for (let i = 0; i < 7; i++) add(potion(colors[(i + row * 3) % colors.length], 0.85), -11 + i * 3.7, y + 0.25, -D / 2 + 2.6);
    }

    // Front counter: planked, with a thick rounded top and big potions on it
    add(studBox(W - 2, 6, 3.4, WOOD, { unit: 2.6, cells: 2, style: 'dot' }), 0, 4.2, D / 2 - 2.6);
    for (let i = 0; i < 5; i++) add(plainBox(0.25, 5.4, 0.2, WOOD_DARK), -11 + i * 5.5, 4.2, D / 2 - 0.85);
    add(rounded(W, 0.9, 4.4, mat(WOOD_LIGHT), 0.3), 0, 7.6, D / 2 - 2.6);
    colors.slice(0, 4).forEach((c, i) => add(potion(c, 1.3), -8 + i * 5.3, 8.05, D / 2 - 2.6));

    // Crates beside the counter
    for (const [px, pz, s] of [
      [W / 2 + 2.6, D / 2 - 2, 3.2],
      [W / 2 + 2.4, D / 2 - 5.4, 2.6],
      [-W / 2 - 2.6, D / 2 - 2.5, 3],
    ]) {
      const crate = add(rounded(s, s, s, mat(WOOD_LIGHT), 0.2), px, 1.2 + s / 2, pz);
      crate.rotation.y = px * 0.03;
      add(plainBox(s + 0.05, 0.4, s + 0.05, WOOD_DARK), px, 1.2 + s / 2, pz);
    }

    // Curved striped awning: a half-cylinder shell sloping forward, scalloped edge
    const awTex = stripeTexture(10);
    awTex.wrapS = THREE.RepeatWrapping;
    const awning = new THREE.Mesh(
      new THREE.CylinderGeometry(D * 0.62, D * 0.62, W + 3, 40, 1, true, Math.PI * 0.15, Math.PI * 0.7),
      new THREE.MeshLambertMaterial({ map: awTex, side: THREE.DoubleSide })
    );
    awning.rotation.z = Math.PI / 2;
    awning.position.set(0, 1.2 + postH - 3.6, 1.2);
    awning.castShadow = true;
    stall.add(awning);
    // scalloped valance hanging from the awning's front edge
    for (let i = 0; i < 12; i++) {
      const v = new THREE.Mesh(new THREE.CircleGeometry(1.35, 16, Math.PI, Math.PI), mat(i % 2 ? '#ffffff' : CYAN, { side: THREE.DoubleSide }));
      v.position.set(-W / 2 - 0.2 + 1.35 + i * ((W + 0.4 - 2.7) / 11), 19.1, 10.0);
      v.rotation.x = -0.35;
      stall.add(v);
    }
    // wooden beam under the awning edge
    add(rounded(W + 2, 0.8, 0.8, mat(WOOD_DARK), 0.25), 0, 18.6, 9.6);

    // Hanging lanterns at the front corners
    this.lanterns = [];
    for (const sx of [-1, 1]) {
      add(plainBox(0.2, 2, 0.2, '#3a2a22'), sx * (W / 2 - 3), 16.6, D / 2 + 1.6);
      const l = add(
        rounded(1.5, 2, 1.5, mat('#ffd36a', { emissive: '#ffb020', emissiveIntensity: 0.9 }), 0.4),
        sx * (W / 2 - 3),
        14.8,
        D / 2 + 1.6
      );
      this.lanterns.push(l);
    }
    stall.scale.setScalar(1.15);
    this.root.add(stall);

    // Glowing pad in front
    this.pad = new THREE.Group();
    this.pad.position.set(padX, 0, padZ);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(7.5, 7.5, 0.35, 48),
      new THREE.MeshLambertMaterial({ color: '#7d8ffb', emissive: '#3b5bff', emissiveIntensity: 0.35, transparent: true, opacity: 0.85 })
    );
    disc.position.y = 0.2;
    this.pad.add(disc);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.45, 12, 64), new THREE.MeshBasicMaterial({ color: '#2e7bff', toneMapped: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.45;
    this.pad.add(this.ring);
    this.glow = new THREE.Mesh(
      new THREE.CylinderGeometry(7.6, 7.6, 2.2, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: '#4d8dff', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
    );
    this.glow.position.y = 1.2;
    this.pad.add(this.glow);
    this.root.add(this.pad);

    // Labels above the hut
    const title = textSprite([{ text: 'Merchant', size: 120, font: FONTS.fredoka, fill: ['#5ff0ff', '#1a8cff'], stroke: '#0b1a4a', strokeWidth: 16 }], 8);
    title.position.set(x, 37, z);
    const sub = textSprite([{ text: 'Buy Potions', size: 80, font: FONTS.montserrat, weight: 800, fill: '#ffffff', stroke: '#141833', strokeWidth: 12 }], 4.2);
    sub.position.set(x, 31.5, z + 2);
    this.root.add(title, sub);
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    this.glow.material.opacity = 0.16 + Math.sin(this.t * 3) * 0.06;
    for (const [i, l] of this.lanterns.entries()) l.material.emissiveIntensity = 0.75 + Math.sin(this.t * 4 + i) * 0.2;
  }
}
