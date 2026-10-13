// Blocky studded trees and the small pink pads scattered on the grass.

import * as THREE from 'three';
import { studBox, checkerBox } from '../util/textures.js';

const TREE_GREEN = '#18e05a';
const TRUNK = '#7a4f55';
const GRASS_Y = 0.8;

export function makeTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = studBox(2.6 * scale, 6 * scale, 2.6 * scale, TRUNK, { unit: 2.6, cells: 2, style: 'dot' });
  trunk.position.y = 3 * scale;
  g.add(trunk);
  // Stepped canopy: wide base, narrowing tiers, little cap — like the reference trees.
  const tiers = [
    [13, 4.2],
    [10.4, 4.2],
    [7.8, 4.2],
    [5.2, 4.2],
    [2.6, 3],
  ];
  let y = 5.2 * scale;
  for (const [w, h] of tiers) {
    const t = studBox(w * scale, h * scale, w * scale, TREE_GREEN, { unit: 2.6 * scale, cells: 1, style: 'tile', contrast: 0.9 });
    t.position.y = y + (h * scale) / 2;
    y += h * scale;
    g.add(t);
  }
  return g;
}

const TREES = [
  // North-west grass block (kept clear of the sign, stall and screen)
  [-96, -96], [-90, -122], [-80, -120], [-140, -100],
  [-118, -92], [-136, -92], [-152, -80], [-128, -116], [-150, -110],
  // North-east grass block
  [124, -96], [92, -116], [112, -84], [100, -118],
  [120, -72], [136, -96], [150, -66], [128, -116], [150, -112],
  // West strip
  [-180, -104], [-186, -70], [-178, -48], [-186, 32], [-178, 48],
  // East strip, behind the leaderboards
  [174, -104], [182, -70], [172, -50], [184, -18], [172, 14], [184, 40], [170, 50],
];

const PINK_PADS = [
  [-164, -18], [-172, 10], [-96, -110], [-90, -100], [130, -66], [72, -112], [166, -30], [164, 30], [-164, 40], [56, -110], [-140, -80], [140, -84],
];

export function buildScenery(scene, collision) {
  const group = new THREE.Group();
  group.name = 'Scenery';
  TREES.forEach(([x, z], i) => {
    const s = 0.85 + ((i * 37) % 10) / 30;
    const t = makeTree(s);
    t.position.set(x, GRASS_Y, z);
    group.add(t);
    collision.addBox(x, z, 2.8 * s, 2.8 * s);
  });

  for (const [x, z] of PINK_PADS) {
    const base = studBox(7.8, 0.5, 5.2, '#2ad86a', { unit: 2.6, cells: 1, cast: false });
    base.position.set(x, GRASS_Y + 0.25, z);
    const top = studBox(4.4, 0.6, 2.8, '#f25af7', { unit: 2.6, cells: 1, cast: false, emissive: 0xf25af7, emissiveIntensity: 0.15 });
    top.position.set(x + 0.6, GRASS_Y + 0.7, z - 0.3);
    group.add(base, top);
  }
  scene.add(group);
  return group;
}

// Spawn tile from the reference: darker lavender base, white studded tile on top,
// and the navy sun emblem — thick ring, white gap, 8 curved thorn rays whose bases
// are hollow and whose tips are solid.
const NAVY = '#1c2a52';
const TILE_WHITE = { light: '#efedfb', dark: '#efedfb', shadow: '#c3c8ea', highlight: 'rgba(255,255,255,0.9)' };

function drawSunEmblem(size = 1024) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const H = size / 2;
  g.translate(H, H);
  g.scale(H, H); // work in units where the tile half-width is 1

  const pt = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
  const START = (-112 * Math.PI) / 180; // first ray points up and slightly left
  const STEP = Math.PI / 4;
  const TWIST = 0.1; // tips curl clockwise a little
  const HW = STEP / 2; // ray bases meet their neighbours

  const ray = (rb, rt, hw, a, twist) => {
    const [b1x, b1y] = pt(rb, a - hw);
    const [tx, ty] = pt(rt, a + twist);
    const [c1x, c1y] = pt(rb + (rt - rb) * 0.32, a - hw * 0.42 + twist * 0.4);
    const [c2x, c2y] = pt(rb + (rt - rb) * 0.32, a + hw * 0.42 + twist * 0.4);
    const [b2x, b2y] = pt(rb, a + hw);
    g.beginPath();
    g.moveTo(b1x, b1y);
    g.quadraticCurveTo(c1x, c1y, tx, ty);
    g.quadraticCurveTo(c2x, c2y, b2x, b2y);
    g.arc(0, 0, rb, a + hw, a - hw, true);
    g.closePath();
    g.fill();
  };

  for (let i = 0; i < 8; i++) {
    const a = START + i * STEP;
    const rt = i % 2 === 0 ? 0.97 : 0.9;
    g.fillStyle = NAVY;
    ray(0.42, rt, HW, a, TWIST);
    // Hollow out the base of each ray, leaving thin navy sides and a solid tip.
    g.fillStyle = TILE_WHITE.light;
    ray(0.465, 0.42 + (rt - 0.42) * 0.4, HW - 0.17, a, TWIST * 0.6);
  }

  // White gap, then the thick ring
  g.fillStyle = TILE_WHITE.light;
  g.beginPath();
  g.arc(0, 0, 0.405, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = NAVY;
  g.lineWidth = 0.09;
  g.beginPath();
  g.arc(0, 0, 0.33, 0, Math.PI * 2);
  g.stroke();

  // Knock the tile white back out so only navy remains (decal sits on the studded tile)
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  // Anti-aliased edges become partial alpha so the emblem stays crisp with no halo.
  for (let p = 0; p < d.length; p += 4) {
    if (d[p + 3] === 0) continue;
    const t = Math.min(1, Math.max(0, (239 - d[p]) / (239 - 28)));
    d[p] = 28;
    d[p + 1] = 42;
    d[p + 2] = 82;
    d[p + 3] = Math.round(t * 255);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.putImageData(img, 0, 0);
  return c;
}

export function buildSpawnPad(scene, x, z, collision) {
  const group = new THREE.Group();
  const base = studBox(15.6, 0.35, 15.6, '#9e9cc6', { unit: 2.8, cells: 2, cast: false });
  base.position.y = 0.175;
  group.add(base);
  const tile = checkerBox(14, 0.3, 14, TILE_WHITE, { unit: 5.6 });
  tile.position.y = 0.5;
  group.add(tile);

  const tex = new THREE.CanvasTexture(drawSunEmblem());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(13.8, 13.8),
    new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
  );
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = 0.66;
  decal.receiveShadow = true;
  group.add(decal);

  group.position.set(x, 0, z);
  scene.add(group);
  collision?.addHeight(x - 7.8, x + 7.8, z - 7.8, z + 7.8, 0.65);
  return group;
}
