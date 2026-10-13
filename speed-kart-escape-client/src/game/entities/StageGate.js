// Stage 1 gate, modelled on the reference: a big, tall, wide opening in a light
// studded gate block, filled with a see-through blue wall you drive straight
// through. The travelling-merchant timer sits on a dark screen across the top.
// Behind the wall: the dark track, signs, coins, trees and the Stage 2 gate.

import * as THREE from 'three';
import { studBox, plainBox, checkerBox } from '../util/textures.js';
import { textSprite, textPlane, updateTextObject, FONTS } from '../util/text.js';
import { makeBillboard } from './Billboard.js';
import { makeTree } from './Scenery.js';
import { formatClock, merchantStatus } from '../../shared/gameData.js';
import { GRASS_CHECKER } from './Arena.js';

const FRAME = '#93a9de'; // light studded gate block
const TUNNEL = '#3a62c8'; // inner tunnel walls
const BAND = '#1f8cff'; // bright strip under the lintel
const TRACK = '#1a2a6a';
const AREA_WALL = '#6b8de0';

// Gate geometry
const Z0 = -128; // front face
const DEPTH = 24;
const HALF = 30; // half opening width (60 wide: three karts side by side)
const OPEN_H = 40; // opening height
const SIDE_W = 30;
const TOTAL_H = 64;

// Stage area behind the gate
const AREA = { minX: -84, maxX: 84, minZ: -334, maxZ: -135 };

// Vertical gradient with faint scrolling scan lines for the see-through wall.
function wallTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(90,170,255,0.75)');
  grad.addColorStop(0.25, 'rgba(50,120,255,0.5)');
  grad.addColorStop(1, 'rgba(40,90,230,0.38)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = 'rgba(170,215,255,0.12)';
  for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 64, 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function seeThroughWall(w, h) {
  const tex = wallTexture();
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.renderOrder = 3;
  return { mesh: m, tex };
}

function coin() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#ffcf1f', emissive: '#d99a00', emissiveIntensity: 0.85 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.45, 24), mat);
  disc.rotation.x = Math.PI / 2;
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 24), new THREE.MeshLambertMaterial({ color: '#ffe36a', emissive: '#e8b000', emissiveIntensity: 0.85 }));
  face.rotation.x = Math.PI / 2;
  g.add(disc, face);
  return g;
}

export class StageGate {
  constructor(collision) {
    this.root = new THREE.Group();
    const add = (m, x, y, z) => {
      m.position.set(x, y, z);
      this.root.add(m);
      return m;
    };
    const frame = (w, h, d, color = FRAME) => studBox(w, h, d, color, { unit: 6, cells: 4, style: 'dot' });
    const zc = Z0 - DEPTH / 2;

    // --- gate block ---------------------------------------------------------
    for (const sx of [-1, 1]) {
      const cx = sx * (HALF + SIDE_W / 2);
      add(frame(SIDE_W, TOTAL_H, DEPTH), cx, TOTAL_H / 2, zc);
      collision.addBox(cx, zc, SIDE_W, DEPTH);
      // inner tunnel wall
      add(frame(0.8, OPEN_H, DEPTH, TUNNEL), sx * (HALF - 0.4), OPEN_H / 2, zc);
      // trim pillars framing the opening
      add(frame(2.4, OPEN_H + 2, 2.4, '#7f97d4'), sx * (HALF + 1.2), (OPEN_H + 2) / 2, Z0 + 0.6);
    }
    add(frame(HALF * 2, TOTAL_H - OPEN_H, DEPTH), 0, OPEN_H + (TOTAL_H - OPEN_H) / 2, zc);
    add(plainBox(HALF * 2 + 4.8, 2.4, 2.4, '#7f97d4'), 0, OPEN_H + 1.2, Z0 + 0.6);
    // tunnel ceiling + bright band under the lintel
    add(plainBox(HALF * 2, 0.6, DEPTH, TUNNEL), 0, OPEN_H - 0.3, zc);
    add(plainBox(HALF * 2 - 0.2, 2.2, 0.4, BAND, { emissive: new THREE.Color(BAND), emissiveIntensity: 0.9 }), 0, OPEN_H - 1.4, Z0 - 0.8);
    // floor through the gate
    add(plainBox(HALF * 2, 0.4, DEPTH + 4, TRACK), 0, -0.15, zc + 1);

    // --- merchant timer screen across the top -------------------------------
    add(frame(HALF * 1.4, 12, 1.6, '#7f97d4'), 0, OPEN_H + 9, Z0 + 1.2);
    add(plainBox(HALF * 1.4 - 2, 10, 0.4, '#101c4a', { emissive: new THREE.Color('#0b1640'), emissiveIntensity: 0.9 }), 0, OPEN_H + 9, Z0 + 2.1);
    const title = textPlane([{ text: 'Merchant', size: 64, font: FONTS.montserrat, weight: 800, fill: '#3ec7ff', stroke: '#06123a', strokeWidth: 4 }], 2.4);
    add(title, 0, OPEN_H + 11.4, Z0 + 2.35);
    this.timerStyle = (text) => [{ text, size: 72, font: FONTS.montserrat, weight: 800, fill: '#ffffff', stroke: '#06123a', strokeWidth: 4 }];
    this.merchantTime = textPlane(this.timerStyle('Arrives in 0:00'), 3.0);
    add(this.merchantTime, 0, OPEN_H + 7.4, Z0 + 2.35);
    this.lastTimer = '';

    // --- the see-through blue wall you drive through ------------------------
    const front = seeThroughWall(HALF * 2, OPEN_H - 2.6);
    add(front.mesh, 0, (OPEN_H - 2.6) / 2, Z0 - 1.2);
    this.wallTex = front.tex;

    const stage1 = textSprite([{ text: 'Stage 1', size: 170, font: FONTS.fredoka, fill: '#ffffff', stroke: '#1f63ff', strokeWidth: 26 }], 11);
    add(stage1, 0, 18, Z0 + 2);

    this.buildStageArea(add);
  }

  buildStageArea(add) {
    const a = AREA;
    const zMid = (a.minZ + a.maxZ) / 2;
    const len = a.maxZ - a.minZ;
    // Grass ground + dark track with low curbs
    add(checkerBox(a.maxX - a.minX, 2, len, GRASS_CHECKER), 0, -0.2, zMid);
    const trackStart = Z0 - DEPTH; // -152
    const trackEnd = -312;
    const tLen = trackStart - trackEnd;
    add(studBox(HALF * 2, 0.6, tLen, TRACK, { unit: 6, cells: 4, style: 'dot', cast: false }), 0, 0.95, (trackStart + trackEnd) / 2);
    for (const sx of [-1, 1]) add(studBox(1.6, 1.8, tLen, '#2a3f8f', { unit: 2.6, cells: 2, style: 'dot' }), sx * (HALF + 0.8), 1.5, (trackStart + trackEnd) / 2);

    // Enclosing walls
    for (const sx of [-1, 1]) add(studBox(6, 52, len, AREA_WALL, { unit: 6, cells: 4, style: 'dot', cast: false }), sx * (a.maxX + 3), 26, zMid);
    add(studBox(a.maxX * 2 + 12, 52, 6, AREA_WALL, { unit: 6, cells: 4, style: 'dot', cast: false }), 0, 26, a.minZ - 3);

    // Trees on the grass either side
    for (const [x, z] of [[-62, -170], [-70, -232], [-60, -276], [64, -196], [70, -250], [58, -290], [-74, -300], [72, -168]]) {
      const t = makeTree(0.9);
      t.position.set(x, 0.8, z);
      this.root.add(t);
    }

    // Signs beside the track
    const S = (text, size) => ({ text, size, font: FONTS.fredoka, fill: '#ffffff', stroke: '#1b2350', strokeWidth: size * 0.16 });
    const left = makeBillboard({
      width: 26,
      height: 13,
      lift: 2,
      lines: [S('Stage 2 will give you', 80), S('better Trails which can', 80), S('boost your speed!', 80)],
      textHeight: 9.5,
    });
    left.position.set(-58, 0.8, -206);
    left.rotation.y = 0.35;
    this.root.add(left);
    const right = makeBillboard({ width: 24, height: 12, lift: 2, lines: [S('Get wins to', 84), S('unlock new', 84), S('karts!!!', 84)], textHeight: 9 });
    right.position.set(60, 0.8, -214);
    right.rotation.y = -0.35;
    this.root.add(right);
    for (let i = 0; i < 3; i++) {
      const arrow = textSprite([{ text: '➘', size: 120, font: FONTS.fredoka, fill: '#3dff4a', stroke: '#0a3a14', strokeWidth: 10 }], 3.2);
      arrow.material.rotation = Math.PI / 2;
      add(arrow, 44 - i * 2.5, 12 - i * 2.6, -210 + i * 1.5);
    }

    // Coins along the track
    this.coins = [];
    for (let i = 0; i < 7; i++) {
      const c = coin();
      c.userData.dynamic = true;
      add(c, ((i % 3) - 1) * 16, 3.2, -170 - i * 19);
      this.coins.push(c);
    }

    // Stage 2 gate at the far end (also behind a see-through wall)
    const s2 = -300;
    const frame = (w, h, d, color = FRAME) => studBox(w, h, d, color, { unit: 6, cells: 4, style: 'dot' });
    for (const sx of [-1, 1]) add(frame(16, 28, 14), sx * (HALF + 8), 14, s2 - 7);
    add(frame(HALF * 2, 8, 14), 0, 24, s2 - 7);
    add(plainBox(HALF * 2, 1.6, 0.4, BAND, { emissive: new THREE.Color(BAND), emissiveIntensity: 0.9 }), 0, 19, s2 - 0.3);
    const back = seeThroughWall(HALF * 2, 19);
    add(back.mesh, 0, 9.5, s2 - 0.5);
    this.wallTex2 = back.tex;
    add(textSprite([{ text: 'Stage 2', size: 120, font: FONTS.fredoka, fill: '#ffffff', stroke: '#1f63ff', strokeWidth: 18 }], 4.2), 0, 10, s2 + 2);
    this.arrow = textSprite([{ text: '⬇', size: 110, font: FONTS.fredoka, fill: '#3dff4a', stroke: '#0a3a14', strokeWidth: 10 }], 3.6);
    add(this.arrow, 12, 8, s2 + 3);
    this.t = 0;
  }

  update(dt, now) {
    this.t += dt;
    this.wallTex.offset.y -= dt * 0.05;
    this.wallTex2.offset.y -= dt * 0.05;
    this.arrow.position.y = 8 + Math.sin(this.t * 3) * 0.8;
    for (const [i, c] of this.coins.entries()) {
      c.rotation.y = this.t * 2 + i;
      c.position.y = 3.2 + Math.sin(this.t * 2.5 + i) * 0.4;
    }
    const m = merchantStatus(now);
    const text = `${m.present ? 'Here for' : 'Arrives in'} ${formatClock(m.msLeft)}`;
    if (text !== this.lastTimer) {
      this.lastTimer = text;
      updateTextObject(this.merchantTime, this.timerStyle(text), 3.0);
    }
  }
}
