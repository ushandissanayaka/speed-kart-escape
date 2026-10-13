// The six stages behind the Stage 1 gate, built from the reference recordings.
//
//  Stage 1-3  "grass"    dark navy road between green grass, trees, signs, Legion
//                        screens; swinging brown log bars (2 in stage 1, more and
//                        faster later, plus sliding logs in stage 3)
//  Stage 4    "desert"   red-brown brick floor, cactus, fields of red spikes with
//                        a gap you must drive through
//  Stage 5    "lava"     orange lava with blue crystal shards; raised brick paths
//                        and platforms are the only safe ground
//  Stage 6    "corridor" blue walled corridor with sliding red walls and floating
//                        cyan orbs
//
// Every stage ends at a gate with a purple "Skip Stage" pad, a yellow "+N Wins /
// Return" pad and a 250-coin safe. Hazards are deterministic functions of the
// clock so every player sees them in the same place.

import * as THREE from 'three';
import { studBox, plainBox, checkerBox, studMaterial, boxUVs } from '../util/textures.js';
import { textSprite, FONTS } from '../util/text.js';
import { makeBillboard } from './Billboard.js';
import { makeTree } from './Scenery.js';
import { makeVideoScreen } from './VideoScreen.js';
import { GRASS_CHECKER } from './Arena.js';
import { COURSE, GEM_PRODUCTS, SAFE_COINS, STAGES, STAGE_COINS, stagePads } from '../../shared/gameData.js';

const HW = COURSE.halfWidth; // 60
const WALL_X = HW + 3;
const BASE_WALL_H = 80;
const WALL_H = BASE_WALL_H;
const ROAD = '#18265f';
const BRICK = { light: '#b06a58', dark: '#9c5a4c', shadow: '#7a4036', highlight: 'rgba(255,220,200,0.35)' };
const STONE = { light: '#c3c8ee', dark: '#b3b9e4', shadow: '#8392d4', highlight: 'rgba(255,255,255,0.7)' };
const WALL_BLUE = '#6b8de0';
const SAND_WALL = '#8e6f9a';
const LOG = '#7a4a3a';

const dyn = (o) => {
  o.userData.dynamic = true;
  return o;
};

// --- small builders -----------------------------------------------------------
function seeThrough(w, h) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(90,170,255,0.75)');
  grad.addColorStop(0.3, 'rgba(50,120,255,0.5)');
  grad.addColorStop(1, 'rgba(40,90,230,0.35)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  m.renderOrder = 3;
  return m;
}

function coinMesh() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.5, 24), new THREE.MeshLambertMaterial({ color: '#ffc21a', emissive: '#d98a00', emissiveIntensity: 0.8 }));
  rim.rotation.x = Math.PI / 2;
  const face = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.56, 24), new THREE.MeshLambertMaterial({ color: '#ffe36a', emissive: '#e8b000', emissiveIntensity: 0.7 }));
  face.rotation.x = Math.PI / 2;
  g.add(rim, face);
  return dyn(g);
}

const label = (lines, h) => textSprite(lines, h);
const fred = (text, size, fill = '#ffffff', stroke = '#141833', extra = {}) => ({ text, size, font: FONTS.fredoka, fill, stroke, strokeWidth: size * 0.16, ...extra });

// Big 3D green arrow (white rim, like the reference) pointing down along -Y.
const arrowGreen = new THREE.MeshLambertMaterial({ color: '#5cff2a', emissive: '#2fd40a', emissiveIntensity: 0.55 });
const arrowRim = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
function arrow3D(h = 16, w = 9) {
  const shape = new THREE.Shape();
  const sw = w * 0.42; // shaft width
  const hh = h * 0.42; // head height
  shape.moveTo(-sw / 2, h);
  shape.lineTo(sw / 2, h);
  shape.lineTo(sw / 2, hh);
  shape.lineTo(w / 2, hh);
  shape.lineTo(0, 0);
  shape.lineTo(-w / 2, hh);
  shape.lineTo(-sw / 2, hh);
  shape.closePath();
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.25, bevelSegments: 2 }), arrowGreen);
  body.geometry.translate(0, 0, -0.8);
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: true, bevelSize: 0.75, bevelThickness: 0.1, bevelSegments: 1 }), arrowRim);
  rim.geometry.translate(0, 0, -0.6);
  body.castShadow = true;
  g.add(rim, body);
  return dyn(g);
}

// Fades text sprites out as the camera approaches so they never fill the screen.
export function fadeNear(objs, camPos) {
  for (const o of objs) {
    const d = o.position.distanceTo(camPos);
    o.material.opacity = Math.max(0, Math.min(1, (d - 18) / 22));
    o.visible = o.material.opacity > 0.01;
  }
}

// Stage 3 spike cycle (seconds): calm, red warning, spikes up.
const SPIKE_CALM = 3;
const SPIKE_WARN = 2;
const SPIKE_UP = 4; // spikes stay up 4 s, then 5 s without them (3 calm + 2 red warning)
const SPIKE_CYCLE = SPIKE_CALM + SPIKE_WARN + SPIKE_UP;
function spikeRise(sec, t) {
  const u = (((t + sec.offset) % SPIKE_CYCLE) + SPIKE_CYCLE) % SPIKE_CYCLE;
  const a = u - SPIKE_CALM - SPIKE_WARN;
  if (a < 0) return 0;
  return Math.min(1, a / 0.15) * Math.min(1, (SPIKE_UP - a) / 0.15);
}

function cactus() {
  const g = new THREE.Group();
  const green = '#2fd06a';
  const part = (w, h, d, x, y) => {
    const m = studBox(w, h, d, green, { unit: 2.6, cells: 2, style: 'dot' });
    m.position.set(x, y, 0);
    g.add(m);
  };
  part(2.2, 9, 2.2, 0, 4.5);
  part(2.6, 1.6, 1.8, -1.8, 4);
  part(1.6, 3.4, 1.6, -2.8, 5.6);
  part(2.6, 1.6, 1.8, 1.8, 5.6);
  part(1.6, 3, 1.6, 2.8, 7);
  return g;
}

// --- the course -----------------------------------------------------------------
export class StageCourse {
  constructor(scene, collision) {
    this.scene = scene;
    this.collision = collision;
    this.root = new THREE.Group();
    this.root.name = 'StageCourse';
    this.spinners = []; // { pivot, x, z, len, speed, phase }
    this.sliders = []; // { mesh, x0, z, amp, speed, phase, hw, hd, y }
    this.fadeLabels = []; // big gate titles, faded out when the camera is close
    this.pits = []; // lava pits [minX, maxX, minZ, maxZ]
    this.lavaFields = []; // stage 4: lava everywhere except platforms
    this.spikeSections = []; // stage 3 pop-up spike fields
    this.beams = []; // logs sliding along z: { mesh, x, z0, z1, speed, phase, hw, top }
    this.orbs = []; // { mesh, z, amp, speed, phase, y }
    this.spikeRects = []; // [minX, maxX, minZ, maxZ]
    this.coins = []; // { def, mesh, hiddenUntil }
    this.arrows = [];
    this.lava = null; // stage 5 lava zone [minZ, maxZ]

    for (const s of STAGES) this.buildStage(s);
    for (const s of STAGES) this.buildGate(s);
    this.buildCoins();

    // Close the far end.
    this.add(studBox(WALL_X * 2 + 6, WALL_H, 6, WALL_BLUE, { unit: 6, cells: 4, style: 'dot', cast: false }), 0, WALL_H / 2, COURSE.endZ - 3);
    collision.addBox(0, COURSE.endZ - 3, WALL_X * 2 + 6, 6);
    scene.add(this.root);
  }

  add(m, x, y, z) {
    m.position.set(x, y, z);
    this.root.add(m);
    return m;
  }

  // ---------------------------------------------------------------------------
  buildStage(s) {
    const yb = s.baseY || 0;
    if (!yb) return this.buildStageAt(s);
    const realRoot = this.root;
    const realCol = this.collision;
    const group = new THREE.Group();
    group.position.y = yb;
    realRoot.add(group);
    this.root = group;
    this.collision = {
      addBox: (...a) => realCol.addBox(...a),
      addCircle: (...a) => realCol.addCircle(...a),
      addHeight: (x0, x1, z0, z1, y) => realCol.addHeight(x0, x1, z0, z1, y + yb),
      addRamp: (x0, x1, z0, z1, a, b) => realCol.addRamp(x0, x1, z0, z1, a + yb, b + yb),
      addCurve: (x0, x1, z0, z1, fn) => realCol.addCurve(x0, x1, z0, z1, (z) => fn(z) + yb),
      heightAt: (x, z) => realCol.heightAt(x, z) - yb,
    };
    try {
      this.buildStageAt(s);
    } finally {
      this.root = realRoot;
      this.collision = realCol;
    }
    // the whole stage floor (and the gate leading into it) is at yb
    realCol.addHeight(-(s.hw ?? HW) - 3, (s.hw ?? HW) + 3, s.endZ, s.startZ + COURSE.gateDepth + 1, yb);
    if (s.theme === 'lava') this.lavaBase = yb;
  }

  buildStageAt(s) {
    const zMid = (s.startZ + s.endZ) / 2;
    const len = s.startZ - s.endZ + COURSE.gateDepth;
    const zc = s.startZ - len / 2;
    const theme = s.theme;
    const wallX = (s.hw ?? HW) + 3;
    const WALL_H = s.wallH || BASE_WALL_H;
    const wallColor = theme === 'grass' ? WALL_BLUE : theme === 'corridor' ? '#7d9be6' : SAND_WALL;

    // Side walls + top rim (studded, tall like the plaza walls)
    for (const sx of [-1, 1]) {
      this.add(studBox(6, WALL_H, len, wallColor, { unit: 6, cells: 4, style: 'dot', cast: false }), sx * wallX, WALL_H / 2, zc);
      this.add(studBox(8, 2, len, '#86a3e6', { unit: 6, cells: 4, style: 'dot', cast: false }), sx * wallX, WALL_H + 1, zc);
      this.collision.addBox(sx * wallX, zc, 6, len);
    }

    if (theme === 'pits') this.buildStage4(s, zMid);
    else if (theme === 'spikes') this.buildStage3(s, zMid);
    else if (theme === 'grass') this.buildGrass(s, zMid);
    else if (theme === 'desert') this.buildDesert(s, zMid);
    else if (theme === 'lava') this.buildLava(s, zMid);
    else this.buildCorridor(s, zMid);
  }

  floor(s, colors, y = 0) {
    const len = s.len + 2;
    this.add(checkerBox((s.hw ?? HW) * 2 + 6, 2, len, colors), 0, y - 1, (s.startZ + s.endZ) / 2);
  }

  // Stage 1-3: navy road + grass, trees, signs, logs
  buildGrass(s, zMid) {
    if (s.n === 1) return this.buildStage1(s, zMid);
    if (s.n === 2) return this.buildStage2(s, zMid);
    this.floor(s, GRASS_CHECKER);
    const roadW = s.n === 1 ? 60 : 50;
    if (s.n === 2) {
      // winding road: three offset segments joined by cross pieces
      const segs = [
        [0, s.startZ, s.startZ - 90],
        [-22, s.startZ - 90, s.startZ - 200],
        [18, s.startZ - 200, s.endZ],
      ];
      for (const [x, z0, z1] of segs) this.add(studBox(roadW, 0.2, z0 - z1 + roadW, ROAD, { unit: 6, cells: 4, style: 'dot', cast: false }), x, 0.1, (z0 + z1) / 2);
    } else {
      this.add(studBox(roadW, 0.2, s.len, ROAD, { unit: 6, cells: 4, style: 'dot', cast: false }), 0, 0.1, zMid);
      for (const sx of [-1, 1]) this.add(studBox(1.4, 0.8, s.len, '#2a3f8f', { unit: 2.6, cells: 2, style: 'dot', cast: false }), sx * (roadW / 2 + 0.7), 0.4, zMid);
    }

    // Raised grass terraces along the walls (the stepped green banks in the reference)
    for (const sx of [-1, 1]) {
      this.add(checkerBox(10, 4, s.len, GRASS_CHECKER), sx * (HW - 4), 2, zMid);
      this.collision.addBox(sx * (HW - 4), zMid, 10, s.len);
    }

    // Trees on the terraces
    for (let i = 0; i < 6; i++) {
      for (const sx of [-1, 1]) {
        const t = makeTree(0.85 + ((i + s.n) % 3) * 0.12);
        this.add(t, sx * (HW - 4), 4, s.startZ - 25 - i * (s.len / 6) - (sx > 0 ? 18 : 0));
      }
    }

    // Grass islands in stage 3
    if (s.n === 3) {
      for (const [x, z] of [[-18, s.startZ - 120], [20, s.startZ - 210]]) {
        this.add(checkerBox(18, 1.6, 30, GRASS_CHECKER), x, 0.8, z);
        this.collision.addBox(x, z, 18, 30);
        this.add(makeTree(0.8), x, 1.6, z);
      }
    }

    // Signs + a Legion screen per stage
    const signs = {
      1: ['Coins give you better', 'Trails! Which can boost', 'your speed!'],
      2: ['Get wins to', 'unlock new', 'karts!!!'],
      3: ['Go further to', 'earn more', 'Wins!'],
    };
    const sign = makeBillboard({ width: 34, height: 15, lift: 2, lines: signs[s.n].map((t) => fred(t, 84)), textHeight: 11 });
    sign.position.set(-HW + 16, 4, s.startZ - 70);
    sign.rotation.y = 0.5;
    this.root.add(sign);
    this.collision.addBox(sign.position.x, sign.position.z, 30, 3, 0.5);
    const scr = makeVideoScreen();
    scr.position.set(HW - 16, 4, s.startZ - 150);
    scr.rotation.y = -0.5;
    this.root.add(scr);
    this.collision.addBox(scr.position.x, scr.position.z, 24, 2, -0.5);

    // Swinging log bars: count and speed rise with the stage
    const spin = { 1: [[0, 110, 0.55]], 2: [[-22, 140, 0.8], [18, 240, -0.9]], 3: [[0, 70, 1.1], [0, 280, -1.2]] }[s.n];
    for (const [x, d, speed] of spin) this.addSpinner(x, s.startZ - d, 46, speed);
    if (s.n === 1) this.addSpinner(0, s.startZ - 190, 46, -0.65);
    if (s.n === 3) {
      this.addSlider(s.startZ - 160, 26, 0.9, 0, LOG, 4);
      this.addSlider(s.startZ - 245, 26, 1.1, 1.5, LOG, 4);
    }
  }

  // Stage 1 (reference screenshots): one huge open room. A wide navy road runs
  // straight to the Stage 2 gate between big grass fields; brown/green terraced
  // cliffs line both walls with Legion screens on posts; small stepped trees, a
  // freestanding Legion screen and the "Coins give you better Trails!" board.
  buildStage1(s, zMid) {
    const hw = s.hw;
    this.floor(s, GRASS_CHECKER);
    const roadW = 70;
    this.add(studBox(roadW, 0.3, s.len + 2, ROAD, { unit: 6, cells: 4, style: 'dot', cast: false }), 0, 0.15, zMid);
    for (const sx of [-1, 1]) {
      this.add(studBox(2.4, 1.2, s.len + 2, '#a9b4e4', { unit: 2.6, cells: 2, style: 'dot', cast: false }), sx * (roadW / 2 + 1.2), 0.6, zMid);
    }

    // Fill the gap between the plaza gate block and the wide room walls.
    for (const sx of [-1, 1]) {
      this.add(studBox(hw + 3 - 60, WALL_H, 24, WALL_BLUE, { unit: 6, cells: 4, style: 'dot', cast: false }), sx * (60 + (hw + 3 - 60) / 2), WALL_H / 2, s.startZ + 12);
      this.collision.addBox(sx * (60 + (hw + 3 - 60) / 2), s.startZ + 12, hw + 3 - 60, 24);
    }

    // Terraced cliffs: three stepped tiers of purple-brown studded blocks with green
    // caps, broken into chunks with jittered heights so the silhouette is uneven.
    const CLIFF = '#8a6278';
    const rnd = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const z0 = s.startZ - 6;
    const z1 = s.endZ + 4;
    const depth = 40;
    let k = 0;
    for (const sx of [-1, 1]) {
      for (let z = z0; z > z1; z -= 22) {
        const zl = Math.min(22, z - z1);
        // tall faces, shallow steps: the brown faces dominate, green only on top
        const tiers = [
          [depth, 18],
          [depth * 0.66, 34],
          [depth * 0.33, 50],
        ];
        for (const [d, h0] of tiers) {
          const h = h0 + (rnd(++k) - 0.5) * 4;
          const dd = d + (rnd(++k) - 0.5) * 6;
          const x = sx * (hw - dd / 2);
          const zc = z - zl / 2 + (rnd(++k) - 0.5) * 3;
          this.add(studBox(dd, h, zl + 0.5, CLIFF, { unit: 2.6, cells: 2, style: 'dot', contrast: 0.7, emissive: 0x3a2236, emissiveIntensity: 0.45 }), x, h / 2, zc);
          this.add(checkerBox(dd + 0.6, 1.2, zl + 0.8, GRASS_CHECKER), x, h + 0.4, zc);
        }
      }
      this.collision.addBox(sx * (hw - depth / 2), (z0 + z1) / 2, depth, z0 - z1);
      // Legion screens on posts on top of the cliffs, facing the road
      for (const d of [55, 150, 235]) {
        const scr = makeVideoScreen();
        scr.scale.setScalar(0.8);
        scr.position.set(sx * (hw - 8), 51, s.startZ - d - (sx > 0 ? 25 : 0));
        scr.rotation.y = -sx * Math.PI / 2;
        this.root.add(scr);
      }
    }

    // Small stepped trees scattered on both grass fields
    const fieldMin = roadW / 2 + 18;
    const fieldMax = hw - depth - 4;
    for (let i = 0; i < 30; i++) {
      const sx = i % 2 ? 1 : -1;
      const x = sx * (fieldMin + rnd(100 + i) * (fieldMax - fieldMin));
      const z = s.startZ - 20 - rnd(200 + i) * (s.len - 70);
      if (sx < 0 && Math.abs(z - (s.startZ - 150)) < 30 && Math.abs(x + 44) < 14) continue; // keep the board clear
      const t = makeTree(1.2 + rnd(300 + i) * 0.5);
      this.add(t, x, 0, z);
      this.collision.addBox(x, z, 4, 4);
    }

    // "Coins give you better Trails!" board on the left field, angled at the road
    const board = makeBillboard({
      width: 46,
      height: 20,
      lift: 3,
      lines: [fred('Coins give you better', 96), fred('Trails! Which can boost', 96), fred('your speed!', 96)],
      textHeight: 15,
    });
    // right beside the road, turned to face it
    board.position.set(-44, 0, s.startZ - 150);
    board.rotation.y = Math.PI / 2 - 0.25;
    this.root.add(board);
    this.collision.addBox(-44, s.startZ - 150, 3, 40, -0.25);

    // Legion screens on light blocks beside the road, facing it
    for (const [sx, d] of [
      [1, 110],
      [-1, 60],
      [1, 220],
    ]) {
      const x = sx * 46;
      this.add(studBox(6, 10, 10, '#b8c8f2', { unit: 2.6, cells: 2, style: 'dot' }), x, 5, s.startZ - d);
      this.collision.addBox(x, s.startZ - d, 6, 10);
      const scr = makeVideoScreen();
      scr.scale.setScalar(0.5);
      scr.position.set(x - sx * 3.2, 4, s.startZ - d);
      scr.rotation.y = -sx * Math.PI / 2;
      this.root.add(scr);
    }

    // Stage 1 has no obstacles: it is a free drive to the Stage 2 gate.
  }

  // Stage 2 (reference screenshots): roads raised above sunken grass pits. A
  // central road runs to a wide crossroad; side roads branch left and right; the
  // centre road then climbs a hill up to the Stage 3 door. Big round logs roll
  // down the hill from the Stage 3 end and on along the centre road, spinning as
  // they go: jump them (Space) or get sent back to the starting place. The grass
  // pits can't be driven into. Tall angled cliffs line both walls.
  buildStage2(s, zMid) {
    const hw = s.hw;
    const S = s.startZ;
    const H = s.rampH; // hill height at the Stage 3 door
    const PIT = -8; // grass pit floor (deep, like the reference)
    const rnd = (i) => ((Math.sin(i * 78.233 + 4.1) * 43758.5453) % 1 + 1) % 1;

    // Sunken grass everywhere; roads are raised slabs on top of it.
    this.add(checkerBox(hw * 2 + 6, 2, s.len + 2, GRASS_CHECKER), 0, PIT - 1, zMid);

    // Fill the gap between the 60-wide gate block and the wide room walls.
    for (const sx of [-1, 1]) {
      this.add(studBox(hw + 3 - 60, WALL_H, 24, WALL_BLUE, { unit: 6, cells: 4, style: 'dot', cast: false }), sx * (60 + (hw + 3 - 60) / 2), WALL_H / 2, S + 12);
    }

    // Road slab: grey studded sides (the curbs seen around the pits) + navy top.
    const road = (x0, x1, d0, d1, top = 0) => {
      const w = x1 - x0;
      const d = d1 - d0;
      const cx = (x0 + x1) / 2;
      const cz = S - (d0 + d1) / 2;
      const h = top - PIT;
      this.add(studBox(w, h, d, '#9a9ed2', { unit: 2.6, cells: 2, style: 'dot', cast: false }), cx, PIT + h / 2 - 0.05, cz);
      this.add(studBox(w - 1.6, 0.3, d - 1.6, ROAD, { unit: 6, cells: 4, style: 'dot', cast: false }), cx, top + 0.05, cz);
      if (top) this.collision.addHeight(x0, x1, S - d1, S - d0, top);
    };
    // Map from the reference: a long centre road that climbs all the way to the Stage
    // 3 door. The climb starts almost flat at the entrance and gets steeper toward
    // the top (h = H * (d / D)^3). Two dead-end branches go left and two go right,
    // each flat at the height where it joins; grass pits fill every gap.
    const D = s.len - 35; // where the hilltop begins
    const hAt = (d) => H * Math.pow(Math.max(0, Math.min(d, D)) / D, 3);
    const CW = 22; // centre road half width
    // Curved centre road: tilted navy segments on red-brick / grey supports.
    const N = 28;
    for (let k = 0; k < N; k++) {
      const d0 = (k * D) / N;
      const d1 = ((k + 1) * D) / N;
      const h0 = hAt(d0);
      const h1 = hAt(d1);
      const seg = studBox(CW * 2, 0.5, Math.hypot(d1 - d0, h1 - h0) + 0.3, ROAD, { unit: 6, cells: 4, style: 'dot', cast: false });
      seg.rotation.x = Math.atan2(h1 - h0, d1 - d0);
      seg.position.set(0, (h0 + h1) / 2 - 0.15, S - (d0 + d1) / 2);
      this.root.add(seg);
      const supH = Math.min(h0, h1) - PIT;
      const supColor = '#c8564f'; // red brick along the whole length (no blue-grey part)
      this.add(studBox(CW * 2 + 1.4, supH, d1 - d0 + 0.02, supColor, { unit: 2.6, cells: 2, style: 'dot', cast: false, emissive: 0x4a1410, emissiveIntensity: 0.25 }), 0, PIT + supH / 2 - 0.4, S - (d0 + d1) / 2);
    }
    this.collision.addCurve(-CW, CW, S - D, S + 2, (z) => hAt(S - z));
    // Branches (flat, at the height where they meet the centre road)
    const branch = (x0, x1, d0, d1) => road(x0, x1, d0, d1, hAt((d0 + d1) / 2));
    branch(CW, hw - 24, 50, 95); // right 1 -> up to the cliffs
    branch(-hw + 24, -CW, 120, 165); // left 1 -> up to the cliffs
    branch(CW, 128, 200, 245); // right 2
    branch(-128, -CW, 270, 315); // left 2
    road(-60, 60, D, s.len + 2, H); // hilltop in front of the Stage 3 door
    // Red brick terrace face under the hilltop, seen from the pits
    this.add(studBox(120, H - PIT, 1, '#c8564f', { unit: 2.6, cells: 2, style: 'dot', cast: false, emissive: 0x4a1410, emissiveIntensity: 0.25 }), 0, PIT + (H - PIT) / 2, S - D + 0.4);
    // Close the gap under the pad platform on both sides: red brick wall from the
    // pit floor up to the platform, out to the side walls.
    for (const sx of [-1, 1]) {
      this.add(studBox(hw - 60 + 3, H - PIT, 1.2, '#c8564f', { unit: 2.6, cells: 2, style: 'dot', cast: false, emissive: 0x4a1410, emissiveIntensity: 0.25 }), sx * (60 + (hw - 60 + 3) / 2), PIT + (H - PIT) / 2, s.endZ + 30.6);
    }
    // Grey studded platform in front of the gate for the pads and the safe
    this.add(studBox(hw * 2 - 4, 0.4, 30, '#b8bce4', { unit: 2.6, cells: 2, style: 'dot', cast: false }), 0, H + 0.2, s.endZ + 15);
    this.collision.addHeight(-hw, hw, s.endZ, s.endZ + 30, H);

    // Back wall: horizontal studded ledges across the whole wall (stadium-like
    // tiers) and a Legion screen on top, as in the recording.
    for (const [y, dz] of [
      [H + 20, 3],
      [H + 38, 5],
      [H + 56, 7],
    ]) {
      if (y > 60) this.add(studBox(hw * 2 + 6, 4, dz, '#9fb6ec', { unit: 6, cells: 4, style: 'dot', cast: false }), 0, y, s.endZ + dz / 2);
      else for (const sx of [-1, 1]) this.add(studBox(hw - 40, 4, dz, '#9fb6ec', { unit: 6, cells: 4, style: 'dot', cast: false }), sx * (40 + (hw - 40) / 2), y, s.endZ + dz / 2);
    }
    const topScreen = makeVideoScreen();
    topScreen.scale.setScalar(1.3);
    topScreen.position.set(0, WALL_H - 2, s.endZ - 4);
    this.root.add(topScreen);


    // Pits are off limits: solid blocks everywhere that is not road.
    const pit = (x0, x1, d0, d1) => this.collision.addBox((x0 + x1) / 2, S - (d0 + d1) / 2, x1 - x0, d1 - d0);
    pit(-hw, -CW, 0, 120);
    pit(hw - 24, hw, 50, 95);
    pit(-hw, -hw + 24, 120, 165);
    pit(-hw, -CW, 165, 270);
    pit(-hw, -128, 270, 315);
    pit(-hw, -CW, 315, D);
    pit(CW, hw, 0, 50);
    pit(CW, hw, 95, 200);
    pit(128, hw, 200, 245);
    pit(CW, hw, 245, D);
    pit(-hw, -60, D, s.len - 30);
    pit(60, hw, D, s.len - 30);

    // Trees growing down in the pits
    const spots = [
      [-60, 30], [-110, 80], [-45, 105], [60, 25], [110, 30], [50, 130], [100, 170],
      [-60, 200], [-110, 240], [-140, 290], [-60, 350], [60, 280], [110, 330], [140, 220], [-100, 390], [95, 390],
    ];
    spots.forEach(([x, d], i) => this.add(makeTree(1 + rnd(i) * 0.5), x, PIT, S - d));

    // Red strip along the bottom of both side walls (as in the screenshots)
    for (const sx of [-1, 1]) this.add(plainBox(1.2, 7, s.len, '#d8454a', { cast: false }), sx * (hw - 0.6), PIT + 3.5, zMid);

    // Cliffs (reference): big chunky boulders along both walls, rising straight out
    // of the pit edge. Thick flat green tops, purple-brown sides, mixed heights,
    // each block turned and tipped a little so they overlap like tumbled rocks.
    const SIDE = '#7a5468';
    let k = 0;
    for (const sx of [-1, 1]) {
      for (let d = -4; d < s.len - 20; d += 22) {
        for (const [off, base] of [
          [10, 14], // front row, nearest the road
          [26, 26], // back row, taller
        ]) {
          const w = 22 + rnd(++k) * 14;
          const dd = 22 + rnd(++k) * 12;
          const h = base + rnd(++k) * 12 - PIT;
          const g = new THREE.Group();
          const body = studBox(w, h, dd, SIDE, { unit: 2.6, cells: 2, style: 'dot', contrast: 0.6, emissive: 0x2a1622, emissiveIntensity: 0.4 });
          body.position.y = h / 2;
          const top = checkerBox(w + 0.4, 2.6, dd + 0.4, GRASS_CHECKER);
          top.position.y = h + 1.1;
          g.add(body, top);
          g.position.set(sx * (hw - off + (rnd(++k) - 0.5) * 6), PIT, S - d - dd / 2);
          g.rotation.y = (rnd(++k) - 0.5) * 0.5;
          g.rotation.z = sx * (rnd(++k) - 0.5) * 0.16;
          g.rotation.x = (rnd(++k) - 0.5) * 0.12;
          this.root.add(g);
        }
      }
    }

    // Rolling logs: from the hilltop, down the hill, along the centre road.
    const R = 1.8;
    const logMat = new THREE.MeshLambertMaterial({ color: '#7a4a32', emissive: '#2a140c', emissiveIntensity: 0.3 });
    const endMat = new THREE.MeshLambertMaterial({ color: '#c89a68' });
    for (const phase of [0, 0.5]) {
      const g = dyn(new THREE.Group());
      const log = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 42, 20), [logMat, endMat, endMat]);
      log.rotation.z = Math.PI / 2; // axis along x
      log.castShadow = true;
      // stripes so the spin is easy to see
      for (const x of [-14, 0, 14]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.08, R + 0.08, 1.2, 20), new THREE.MeshLambertMaterial({ color: '#4a2a1a' }));
        band.rotation.z = Math.PI / 2;
        band.position.x = x;
        g.add(band);
      }
      g.add(log);
      this.root.add(g);
      this.beams.push({ mesh: g, x: 0, z0: S - (s.len - 15), z1: S - 4, speed: 0.075, phase, hw: 21, top: 2 * R, roll: R });
    }
  }

  // Stage 3 (reference recording): a long, wide desert floor. Pink checker fields
  // are split by brown safe lanes and brown bands. Each field runs a cycle: calm
  // pink -> glowing bright red warning -> tall brown spikes shoot up -> drop back.
  // Fields are staggered so different parts fire at different times. Touch a raised
  // spike and you're sent back to the starting place. Stepped mauve rock ledges
  // with cactus line both walls.
  buildStage3(s, zMid) {
    const hw = s.hw;
    const S = s.startZ;
    const EDGE = hw - 26; // rock ledges beyond this
    const SAFE = { light: '#a8746a', dark: '#996660', shadow: '#7a4e48', highlight: 'rgba(255,220,210,0.35)' };
    // Whole floor is a brown safe colour; the pink fields sit on top of it.
    this.add(checkerBox(hw * 2 + 6, 2, s.len + 2, SAFE), 0, -1, zMid);

    // Three full-width red rows, separated by brown safe bands a little longer
    // than a kart. The whole stage turns red and fires its spikes together.
    const sections = [
      { d0: 20, d1: 129, lanes: [], offset: 0 },
      { d0: 165, d1: 274, lanes: [], offset: 0 },
      { d0: 310, d1: 419, lanes: [], offset: 0 },
    ];
    const pyramid = new THREE.ConeGeometry(3.4, 11, 4);
    pyramid.rotateY(Math.PI / 4);
    pyramid.translate(0, 5.5, 0);
    const spikeMat = studMaterial('#c08a5a', { unit: 2.6, cells: 2, style: 'dot' });
    for (const sec of sections) {
      // red intervals = floor width minus the safe lanes
      const red = [];
      let x = -EDGE;
      for (const [a, b] of [...sec.lanes].sort((p, q) => p[0] - q[0])) {
        if (a > x) red.push([x, a]);
        x = b;
      }
      if (x < EDGE) red.push([x, EDGE]);
      const mat = new THREE.MeshLambertMaterial({ color: '#ec7c86', emissive: '#ff1a2a', emissiveIntensity: 0, map: studMaterial('#ffffff', { unit: 2.6, cells: 2, style: 'tile', contrast: 0.5 }).map });
      const depth = sec.d1 - sec.d0;
      const zc = S - (sec.d0 + sec.d1) / 2;
      const spots = [];
      const slabs = [];
      for (const [x0, x1] of red) {
        const w = x1 - x0;
        const slab = new THREE.Mesh(boxUVs(new THREE.BoxGeometry(w, 0.3, depth), w, 0.3, depth, 10.4), mat);
        slab.position.set((x0 + x1) / 2, 0.15, zc);
        slab.receiveShadow = true;
        this.root.add(dyn(slab));
        slabs.push(slab);
        for (let sx = x0 + 4; sx <= x1 - 3; sx += 8) for (let d = sec.d0 + 4; d <= sec.d1 - 3; d += 8) spots.push([sx, S - d]);
      }
      const spikes = new THREE.InstancedMesh(pyramid, spikeMat, spots.length);
      const m = new THREE.Matrix4();
      spots.forEach(([sx, sz], i) => spikes.setMatrixAt(i, m.makeTranslation(sx, 0, sz)));
      spikes.castShadow = true;
      spikes.frustumCulled = false;
      // Thin silver shine along every spike edge (one line mesh per row, moves with the spikes)
      const edge = new THREE.EdgesGeometry(pyramid).attributes.position.array;
      const pts = new Float32Array(edge.length * spots.length);
      spots.forEach(([sx, sz], i) => {
        for (let v = 0; v < edge.length; v += 3) {
          const o = i * edge.length + v;
          pts[o] = edge[v] * 1.02 + sx;
          pts[o + 1] = edge[v + 1] * 1.01;
          pts[o + 2] = edge[v + 2] * 1.02 + sz;
        }
      });
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const shine = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: '#eef3ff', transparent: true, opacity: 0.85, toneMapped: false }));
      shine.frustumCulled = false;
      spikes.add(shine);
      this.root.add(dyn(spikes));
      this.spikeSections.push({ mat, slabs, spikes, red, z0: S - sec.d0, z1: S - sec.d1, offset: sec.offset });
    }

    // Stepped mauve rock ledges along both walls, with cactus on top.
    const rnd = (i) => ((Math.sin(i * 51.77 + 2.3) * 43758.5453) % 1 + 1) % 1;
    let k = 0;
    for (const sx of [-1, 1]) {
      for (let d = -2; d < s.len; d += 26) {
        for (let tier = 0; tier < 3; tier++) {
          const w = 12 + rnd(++k) * 10;
          const h = 12 + tier * 16 + rnd(++k) * 5; // tall stepped ledges
          const len = 24 + rnd(++k) * 14;
          const col = rnd(++k) > 0.5 ? '#9c7486' : '#b18c98';
          const slab = studBox(w, h, len, col, { unit: 2.6, cells: 2, style: 'dot', contrast: 0.6 });
          slab.position.set(sx * (EDGE + 4 + tier * 8 + w / 2 - 4), h / 2, S - d - len / 2 + (rnd(++k) - 0.5) * 8);
          this.root.add(slab);
          // bigger cactus on every level of the ledges, at varied heights
          if (rnd(++k) > 0.45) {
            const c = cactus();
            c.scale.setScalar(1.6 + rnd(++k) * 0.8);
            c.rotation.y = rnd(++k) * Math.PI;
            this.add(c, slab.position.x + (rnd(++k) - 0.5) * (w - 4), h, slab.position.z + (rnd(++k) - 0.5) * 10);
          }
        }
      }
      this.collision.addBox(sx * (EDGE + 13), zMid, 26, s.len);
    }
  }

  updateSpikeSection(sec, t) {
    const u = (((t + sec.offset) % SPIKE_CYCLE) + SPIKE_CYCLE) % SPIKE_CYCLE;
    const rise = spikeRise(sec, t);
    sec.spikes.visible = rise > 0.01;
    sec.spikes.position.y = -11 + 11 * rise;
    if (u >= SPIKE_CALM && u < SPIKE_CALM + SPIKE_WARN) {
      // glowing bright red warning, pulsing
      sec.mat.color.set('#ff2a3a');
      sec.mat.emissiveIntensity = 0.45 + Math.sin(t * 14) * 0.15;
    } else if (rise > 0) {
      sec.mat.color.set('#ff2a3a');
      sec.mat.emissiveIntensity = 0.35;
    }
    // When calm, the red rows are hidden so the floor looks exactly like the normal
    // ground: players can't tell where the red will come until it appears.
    const calm = u < SPIKE_CALM && rise === 0;
    for (const sl of sec.slabs) sl.visible = !calm;
  }

  // Stage 4 (reference recording): brown brick floor with sunken orange lava pits.
  // Long lava channels run along both sides of two raised safe blocks (drive along
  // the block), and three full-width pits have to be jumped (Space) right at the
  // edge. Drop into lava and you're sent back to the starting place. Stepped mauve
  // rock ledges line both walls.
  buildStage4(s, zMid) {
    // No path through the middle: separate brick platforms over deep lava. Every
    // gap must be jumped (Space). Fall in and you go back to the starting place.
    const hw = s.hw;
    const S = s.startZ;
    const EDGE = hw - 26;
    const BRICK4 = { light: '#a86a5c', dark: '#9a5e52', shadow: '#7a4a40', highlight: 'rgba(255,220,200,0.35)' };
    const DEPTH = 34;
    // Rows of separate blocks: lava strips between the rows, and gaps between the
    // blocks in each row (nothing is joined). Rows alternate 3 and 2 blocks.
    const plats = [[-EDGE, EDGE, 0, 30]]; // start
    // wide lava gaps: you have to jump right from the edge
    const three = [[-EDGE, -46], [-24, 24], [46, EDGE]];
    const two = [[-60, -11], [11, 60]];
    for (let r = 0; r < 6; r++) {
      const d0 = 46 + r * 66;
      for (const [x0, x1] of r % 2 ? two : three) plats.push([x0, x1, d0, d0 + 40]);
    }
    plats.push([-EDGE, EDGE, 442, s.len]); // in front of the Stage 5 door
    for (const [x0, x1, d0, d1] of plats) {
      const top = checkerBox(x1 - x0, DEPTH, d1 - d0, BRICK4);
      top.position.set((x0 + x1) / 2, -DEPTH / 2, S - (d0 + d1) / 2);
      this.root.add(top);
    }
    // Deep lava under everything
    this.pitLava = new THREE.MeshLambertMaterial({ color: '#ff8a3a', emissive: '#ff6a10', emissiveIntensity: 0.55 });
    const lava = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 6, 1, s.len), this.pitLava);
    lava.position.set(0, -DEPTH + 1.5, zMid);
    this.root.add(lava);
    // Dark blue crystals in the lava
    const shardMat = new THREE.MeshLambertMaterial({ color: '#1a3cc8', emissive: '#0a1a6a', emissiveIntensity: 0.4 });
    const rr = (i) => ((Math.sin(i * 91.3 + 7.1) * 43758.5453) % 1 + 1) % 1;
    for (let i = 0; i < 40; i++) {
      const x = (rr(i) - 0.5) * EDGE * 2;
      const d = 30 + rr(i + 50) * (s.len - 70);
      if (plats.some(([x0, x1, d0, d1]) => x > x0 - 3 && x < x1 + 3 && d > d0 - 3 && d < d1 + 3)) continue;
      const sh = new THREE.Mesh(new THREE.ConeGeometry(1.4 + rr(i + 9) * 2, 4 + rr(i + 3) * 6, 4), shardMat);
      sh.position.set(x, -DEPTH + 3, S - d);
      sh.rotation.set(rr(i + 1) - 0.5, rr(i + 2) * 3, rr(i + 4) - 0.5);
      this.root.add(sh);
    }
    // Cactus on a few platforms
    for (const [x, d] of [[68, 66], [-34, 132], [68, 198], [34, 264], [-68, 330]]) {
      const c = cactus();
      c.scale.setScalar(1.3);
      this.add(c, x, 0, S - d);
      this.collision.addCircle(x, S - d, 2.4);
    }
    for (const sx of [-1, 1]) {
      const side = studBox(hw + 3 - EDGE + 2, DEPTH, s.len + 2, '#8c6a7c', { unit: 2.6, cells: 2, style: 'dot', cast: false });
      side.position.set(sx * (EDGE - 1 + (hw + 3 - EDGE + 2) / 2), -DEPTH / 2, zMid);
      this.root.add(side);
    }
    this.lavaFields.push({ z0: S, z1: S - s.len, plats: plats.map(([x0, x1, d0, d1]) => [x0, x1, S - d1, S - d0]) });

    // Stepped mauve rock ledges along both walls
    const rnd = (i) => ((Math.sin(i * 37.7 + 1.9) * 43758.5453) % 1 + 1) % 1;
    let k = 0;
    for (const sx of [-1, 1]) {
      for (let d = -2; d < s.len; d += 28) {
        for (let tier = 0; tier < 3; tier++) {
          const w = 10 + rnd(++k) * 8;
          const h = 10 + tier * 14 + rnd(++k) * 5;
          const len = 26 + rnd(++k) * 14;
          const col = rnd(++k) > 0.5 ? '#8c6a7c' : '#a68494';
          const slab = studBox(w, h, len, col, { unit: 2.6, cells: 2, style: 'dot', contrast: 0.6 });
          slab.position.set(sx * (EDGE + 4 + tier * 7 + w / 2 - 4), h / 2, S - d - len / 2 + (rnd(++k) - 0.5) * 8);
          this.root.add(slab);
        }
      }
      this.collision.addBox(sx * (EDGE + 13), zMid, 26, s.len);
    }
  }

  // Stage 4: brick desert + spike fields with a moving gap
  buildDesert(s, zMid) {
    this.floor(s, BRICK);
    this.cactusRow(s);
    // Spike fields: each spans the width except a 24-wide gap that changes side.
    const fields = 6;
    const gaps = [-24, 22, -6, 28, -30, 10];
    const cone = new THREE.ConeGeometry(0.7, 2.2, 4);
    const coneMat = new THREE.MeshLambertMaterial({ color: '#d8c8b4', emissive: '#6a2a2a', emissiveIntensity: 0.25 });
    const spots = [];
    for (let f = 0; f < fields; f++) {
      const zf = s.startZ - 40 - f * ((s.len - 80) / (fields - 1));
      const gx = gaps[f];
      const parts = [
        [-HW + 8, gx - 12],
        [gx + 12, HW - 8],
      ];
      for (const [x0, x1] of parts) {
        if (x1 - x0 < 2) continue;
        this.add(plainBox(x1 - x0, 0.2, 22, '#e8344f', { emissive: new THREE.Color('#a0102a'), emissiveIntensity: 0.25, cast: false }), (x0 + x1) / 2, 0.1, zf);
        this.spikeRects.push([x0, x1, zf - 11, zf + 11]);
        for (let x = x0 + 1.5; x < x1; x += 3) for (let z = zf - 10; z <= zf + 10; z += 3) spots.push([x, z]);
      }
    }
    const spikes = new THREE.InstancedMesh(cone, coneMat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach(([x, z], i) => spikes.setMatrixAt(i, m.makeTranslation(x, 1.1, z)));
    spikes.castShadow = true;
    this.root.add(spikes);
  }

  // Stage 5: lava with raised brick paths
  buildLava(s, zMid) {
    const lavaMat = new THREE.MeshLambertMaterial({ color: '#ff8a2a', emissive: '#ff5a00', emissiveIntensity: 0.55 });
    const lava = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 6, 1, s.len + 2), lavaMat);
    lava.position.set(0, -0.5, zMid);
    this.root.add(lava);
    this.lavaMat = lavaMat;
    this.lava = [s.endZ, s.startZ];
    this.cactusRow(s);

    const H = 3;
    const plat = (x, z, w, d) => {
      this.add(checkerBox(w, H, d, BRICK), x, H / 2, z);
      this.collision.addHeight(x - w / 2, x + w / 2, z - d / 2, z + d / 2, H);
    };
    // start + finish platforms (full width), with the route between them
    plat(0, s.startZ - 18, HW * 2, 36);
    plat(0, s.endZ + 26, HW * 2, 52);
    const route = [
      [-24, -60, 26, 50],
      [6, -92, 70, 20],
      [34, -130, 26, 60],
      [8, -170, 66, 20],
      [-22, -205, 26, 56],
      [0, -244, 70, 22],
      [26, -276, 26, 44],
    ];
    for (const [x, dz, w, d] of route) plat(x, s.startZ + dz, w, d);
    // Blue crystal shards floating in the lava
    const shardMat = new THREE.MeshLambertMaterial({ color: '#1a3cff', emissive: '#0a1a8a', emissiveIntensity: 0.4 });
    for (let i = 0; i < 26; i++) {
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(1.4 + (i % 3) * 0.5), shardMat);
      shard.position.set(((i * 37) % 110) - 55, 0.4, s.startZ - 40 - ((i * 53) % (s.len - 90)));
      shard.rotation.set(i, i * 2, i * 3);
      this.root.add(shard);
      this.collision.addCircle(shard.position.x, shard.position.z, 1.8);
    }
  }

  // Stage 6: corridor with sliding red walls and cyan orbs
  buildCorridor(s, zMid) {
    this.floor(s, BRICK);
    // inner pillars along the walls (the blue panelled corridor look)
    for (let i = 0; i < 12; i++) {
      for (const sx of [-1, 1]) {
        this.add(studBox(4, 30, 8, '#5a7ad6', { unit: 6, cells: 4, style: 'dot' }), sx * (HW - 1), 15, s.startZ - 15 - i * (s.len / 12));
        this.collision.addBox(sx * (HW - 1), s.startZ - 15 - i * (s.len / 12), 4, 8);
      }
    }
    const walls = [
      [60, 0.6, 0],
      [120, 0.8, 1.2],
      [180, 0.7, 2.4],
      [240, 0.95, 0.6],
      [300, 0.75, 1.8],
    ];
    for (const [d, speed, phase] of walls) this.addSlider(s.startZ - d, 30, speed, phase, '#ff1f2a', 20, 28);
    const orbs = [
      [90, 1.3, 0],
      [150, 1.6, 1],
      [210, 1.4, 2],
      [270, 1.8, 0.5],
      [330, 1.5, 1.5],
    ];
    const orbMat = new THREE.MeshLambertMaterial({ color: '#7ff0ff', emissive: '#2ad4ff', emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });
    for (const [d, speed, phase] of orbs) {
      const mesh = dyn(new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14), orbMat));
      this.root.add(mesh);
      this.orbs.push({ mesh, z: s.startZ - d, amp: 46, speed, phase, y: 5 });
    }
  }

  cactusRow(s) {
    const mat = '#2fd84a';
    for (let i = 0; i < 8; i++) {
      for (const sx of [-1, 1]) {
        const g = new THREE.Group();
        const trunk = studBox(2.4, 9, 2.4, mat, { unit: 2.6, cells: 2, style: 'dot' });
        trunk.position.y = 4.5;
        g.add(trunk);
        const arm = studBox(2, 4, 2, mat, { unit: 2.6, cells: 2, style: 'dot' });
        arm.position.set(sx * 2.2, 5.5, 0);
        g.add(arm);
        g.position.set(sx * (HW - 5), 0, s.startZ - 20 - i * (s.len / 8));
        this.root.add(g);
        this.collision.addCircle(g.position.x, g.position.z, 2.2);
      }
    }
  }

  addSpinner(x, z, len, speed, { color = LOG, h = 2.6, post = true } = {}) {
    if (post) {
      this.add(studBox(3, 6, 3, '#5a3a2e', { unit: 2.6, cells: 2, style: 'dot' }), x, 3, z);
      this.collision.addCircle(x, z, 2);
    }
    const pivot = dyn(new THREE.Group());
    pivot.position.set(x, post ? 2.4 : h / 2 + 0.2, z);
    const bar = studBox(len, h, 2.6, color, { unit: 2.6, cells: 2, style: 'dot' });
    pivot.add(bar);
    this.root.add(pivot);
    this.spinners.push({ pivot, x, z, len, speed, phase: (x + z) * 0.01 });
  }

  addSlider(z, amp, speed, phase, color, h, w = 30) {
    const mesh = dyn(studBox(w, h, 3, color, { unit: 2.6, cells: 2, style: 'dot', emissive: color === '#ff1f2a' ? 0xff1f2a : 0, emissiveIntensity: 0.35 }));
    mesh.position.set(0, h / 2, z);
    this.root.add(mesh);
    this.sliders.push({ mesh, z, amp, speed, phase, hw: w / 2, hd: 1.5, y: h / 2 });
  }

  // ---------------------------------------------------------------------------
  // Gate + pads at the end of stage s.
  buildGate(s) {
    const gy = s.rampH || s.baseY || 0;
    if (!gy) return this.buildGateAt(s);
    const realRoot = this.root;
    const group = new THREE.Group();
    group.position.y = gy;
    realRoot.add(group);
    this.root = group;
    try {
      this.buildGateAt(s);
    } finally {
      this.root = realRoot;
    }
    // floor through the gate
    this.collision.addHeight(-45, 45, s.endZ - COURSE.gateDepth - 1, s.endZ, gy);
  }

  buildGateAt(s) {
    const z0 = s.endZ; // front face
    const zc = z0 - COURSE.gateDepth / 2;
    const last = s.n === STAGES.length;
    const frame = (w, h, d, c = '#93a9de') => studBox(w, h, d, c, { unit: 6, cells: 4, style: 'dot' });
    const half = 40; // 80-wide opening
    const openH = 54; // tall opening
    const topH = Math.max(s.wallH || WALL_H, STAGES[s.n]?.wallH || WALL_H); // gates always reach the top of the walls
    for (const sx of [-1, 1]) {
      const sw = (s.hw ?? HW) + 3 - half;
      this.add(frame(sw, topH, COURSE.gateDepth), sx * (half + sw / 2), topH / 2, zc);
      this.collision.addBox(sx * (half + sw / 2), zc, sw, COURSE.gateDepth);
      this.add(frame(0.8, openH, COURSE.gateDepth, '#3a62c8'), sx * (half - 0.4), openH / 2, zc);
    }
    this.add(frame(half * 2, topH - openH, COURSE.gateDepth), 0, openH + (topH - openH) / 2, zc);
    this.add(plainBox(half * 2 - 0.2, 2, 0.4, '#1f8cff', { emissive: new THREE.Color('#1f8cff'), emissiveIntensity: 0.9 }), 0, openH - 1.2, z0 - 0.8);
    this.add(studBox(half * 2, 0.4, COURSE.gateDepth + 2, ROAD, { unit: 6, cells: 4, style: 'dot', cast: false }), 0, -0.1, zc);
    this.add(seeThrough(half * 2, openH - 2.4), 0, (openH - 2.4) / 2, z0 - 1.2);
    if (last) {
      // The end of World 1: a closed gate.
      this.add(plainBox(half * 2, openH, 1, '#3a2a7a', { emissive: new THREE.Color('#2a1a6a'), emissiveIntensity: 0.5 }), 0, openH / 2, z0 - 3);
      this.collision.addBox(0, z0 - 3, half * 2, 2);
    }
    if (s.n === 1) {
      // "Get wins to unlock new karts!!!" board on the gate face, arrows pointing at the wins pad
      const board = makeBillboard({ width: 36, height: 17, lift: 6, wallMounted: true, lines: [fred('Get wins to', 92), fred('unlock new', 92), fred('karts!!!', 92)], textHeight: 12 });
      board.position.set(half + 34, 0, z0 + 1.3);
      this.root.add(board);
      for (let i = 0; i < 3; i++) {
        const ar = arrow3D(7, 4.5);
        ar.rotation.z = -0.7; // points down-left at the wins pad
        this.add(ar, half + 22 - i * 9, 34 - i * 9, z0 + 3 + i);
      }
    }
    const title = last ? 'World 2' : `Stage ${s.n + 1}`;
    // big title painted on the wall above the opening, plus one inside it
    this.fadeLabels.push(this.add(label([fred(title, 170, '#ffffff', '#1f63ff')], 13), 0, 22, z0 + 2));

    // Pads (raised onto the hilltop when this stage ends on a hill)
    const pads = stagePads(s.n);
    const padBox = (color) => plainBox(13, 0.8, 9, color, { emissive: new THREE.Color(color), emissiveIntensity: 0.45, cast: false });
    if (!last) {
      this.add(padBox('#9b2bff'), pads.skip.x, 0.4, pads.skip.z);
      this.add(
        label(
          [
            fred('Skip Stage', 64, '#4dffa0', '#0c2a18'),
            { text: `Only ⬡ ${GEM_PRODUCTS.skip_stage.displayPrice}`, size: 40, font: FONTS.montserrat, weight: 800, fill: '#ffffff', stroke: '#141833', strokeWidth: 7 },
          ],
          5.2
        ),
        pads.skip.x,
        6,
        pads.skip.z
      );
    }
    this.add(studBox(17, 0.6, 13, '#6b7fbf', { unit: 2.6, cells: 2, style: 'dot', cast: false }), pads.wins.x, 0.3, pads.wins.z);
    this.add(studBox(14.5, 0.6, 10.5, '#8f9fd6', { unit: 2.6, cells: 2, style: 'dot', cast: false }), pads.wins.x, 0.9, pads.wins.z);
    this.add(studBox(12.5, 0.6, 8.5, '#ffe21a', { unit: 2.6, cells: 2, style: 'dot', cast: false, emissive: 0xffe21a, emissiveIntensity: 0.45 }), pads.wins.x, 1.5, pads.wins.z);
    this.add(
      label(
        [
          fred(`+${s.wins} Wins`, 64, '#ffe21a', '#2a2000'),
          { text: 'Return', size: 40, font: FONTS.montserrat, weight: 800, fill: '#ffffff', stroke: '#141833', strokeWidth: 7 },
        ],
        5.2
      ),
      pads.wins.x,
      8,
      pads.wins.z
    );
    const arrow = arrow3D(18, 11);
    this.add(arrow, pads.wins.x, 12, pads.wins.z);
    this.arrows.push(arrow);

    // Coin safe on a glowing yellow ring
    const safe = new THREE.Group();
    const box = studBox(6, 7, 5, '#5f86e6', { unit: 2.6, cells: 2, style: 'dot' });
    box.position.y = 3.5;
    safe.add(box);
    // dark open interior, a shelf, coin stacks, and the door swung open to the right
    const inside = plainBox(4.8, 5.8, 0.3, '#22336e');
    inside.position.set(0, 3.5, 2.4);
    safe.add(inside);
    const shelf = plainBox(4.8, 0.3, 1.6, '#4a6fd8');
    shelf.position.set(0, 3.9, 2.0);
    safe.add(shelf);
    const gold = { emissive: new THREE.Color('#d98a00'), emissiveIntensity: 0.6 };
    for (const [y, w] of [
      [4.3, 3.2],
      [4.65, 2.4],
      [1.3, 3.6],
      [1.65, 2.8],
    ]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.35, 18), new THREE.MeshLambertMaterial({ color: '#ffc21a', ...gold }));
      c.position.set(0, y, 2.0);
      safe.add(c);
    }
    const door = new THREE.Group();
    const leaf = studBox(4.8, 6, 0.6, '#5f86e6', { unit: 2.6, cells: 2, style: 'dot' });
    leaf.position.set(2.4, 0, 0);
    door.add(leaf);
    door.position.set(2.6, 3.5, 2.5);
    door.rotation.y = -1.25;
    safe.add(door);
    safe.position.set(pads.safe.x, 0, pads.safe.z);
    safe.rotation.y = 0.5;
    safe.scale.setScalar(2.2);
    // solid: karts bump into the safe instead of driving through it
    this.collision.addBox(pads.safe.x, pads.safe.z, 6 * 2.2, 5 * 2.2, 0.5);
    this.root.add(safe);
    const ring = new THREE.Mesh(new THREE.RingGeometry(10, 14, 40), new THREE.MeshBasicMaterial({ color: '#ffe23a', transparent: true, opacity: 0.6, side: THREE.DoubleSide, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pads.safe.x, 0.3, pads.safe.z);
    ring.renderOrder = 2;
    this.root.add(ring);
    this.add(
      label(
        [
          { text: 'WATCH AN AD FOR', size: 46, font: FONTS.montserrat, weight: 800, fill: '#ffffff', stroke: '#141833', strokeWidth: 8 },
          { text: `🪙 ${SAFE_COINS}`, size: 56, font: FONTS.montserrat, weight: 900, fill: '#ffd21c', stroke: '#141833', strokeWidth: 9 },
        ],
        6
      ),
      pads.safe.x,
      22,
      pads.safe.z
    );
    arrow.userData.baseY = 12;
  }

  buildCoins() {
    for (const def of STAGE_COINS) {
      const mesh = coinMesh();
      mesh.position.set(def.x, (def.stage === 5 ? 5.4 : 2.6) + this.collision.heightAt(def.x, def.z), def.z);
      this.root.add(mesh);
      this.coins.push({ def, mesh, hiddenUntil: 0 });
    }
  }

  // ---------------------------------------------------------------------------
  update(dt, now, camera) {
    const t = now / 1000;
    if (camera) fadeNear(this.fadeLabels, camera.position);
    for (const sp of this.spinners) sp.pivot.rotation.y = t * sp.speed + sp.phase;
    for (const sl of this.sliders) sl.mesh.position.x = Math.sin(t * sl.speed + sl.phase) * sl.amp;
    for (const sec of this.spikeSections) this.updateSpikeSection(sec, t);
    for (const b of this.beams) {
      const st = this.beamState(b, t);
      b.mesh.position.z = st.z;
      b.mesh.visible = st.live;
      if (b.roll) {
        b.mesh.position.y = this.collision.heightAt(b.x, st.z) + b.roll + st.drop;
        b.mesh.rotation.x = (st.z - b.z0) / b.roll; // rolls toward the entrance
      }
    }
    for (const o of this.orbs) o.mesh.position.set(Math.sin(t * o.speed + o.phase) * o.amp, o.y + Math.sin(t * 3 + o.phase) * 1.2, o.z);
    for (const c of this.coins) {
      c.mesh.visible = now >= c.hiddenUntil;
      c.mesh.rotation.y = t * 2.4;
    }
    for (const a of this.arrows) {
      a.position.y = (a.userData.baseY ?? 12) + Math.abs(Math.sin(t * 2.6)) * 3;
      a.rotation.y = Math.sin(t * 1.3) * 0.5;
    }
    if (this.pitLava) this.pitLava.emissiveIntensity = 0.55 + Math.sin(t * 2.2) * 0.12;
    if (this.lavaMat) this.lavaMat.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.12;
  }

  // Is a kart at (x, z) with ground height y touching something deadly?
  // Logs travel from the Stage 3 end toward the entrance, then reappear at the far end.
  beamZ(b, t) {
    return this.beamState(b, t).z;
  }

  // Rolling logs take turns: one drops from the sky at the Stage 3 end (first 10% of
  // its cycle), rolls down to the entrance (next 40%), then vanishes while the other
  // log takes its turn. Sliding beams just travel z0 -> z1 and loop.
  beamState(b, t) {
    const u = ((t * b.speed + b.phase) % 1 + 1) % 1;
    if (!b.roll) return { z: b.z0 + (b.z1 - b.z0) * u, drop: 0, live: true };
    if (u < 0.1) {
      const k = 1 - u / 0.1;
      return { z: b.z0, drop: k * k * 55, live: true };
    }
    if (u < 0.5) return { z: b.z0 + (b.z1 - b.z0) * ((u - 0.1) / 0.4), drop: 0, live: true };
    return { z: b.z0, drop: 0, live: false };
  }

  hazardAt(x, z, groundY, now, jumpY = 0) {
    const t = now / 1000;
    const R = 4.5;
    for (const f of this.lavaFields) {
      if (z > f.z0 - 1 || z < f.z1 + 1 || jumpY >= 0.6) continue;
      if (!f.plats.some(([x0, x1, z0, z1]) => x > x0 - 3.5 && x < x1 + 3.5 && z > z0 - 3.5 && z < z1 + 3.5)) return 'pit';
    }
    for (const [x0, x1, z0, z1] of this.pits) {
      if (x > x0 + 1.5 && x < x1 - 1.5 && z > z0 + 1.5 && z < z1 - 1.5 && jumpY < 0.6) return 'pit';
    }
    for (const sec of this.spikeSections) {
      if (z > sec.z0 || z < sec.z1) continue;
      if (spikeRise(sec, t) < 0.35) continue;
      for (const [x0, x1] of sec.red) if (x > x0 - 1 && x < x1 + 1) return 'spike';
    }
    for (const b of this.beams) {
      const st = this.beamState(b, t);
      if (!st.live || st.drop > 3) continue;
      const bz = st.z;
      if (Math.abs(x - b.x) < b.hw + 2 && Math.abs(z - bz) < (b.roll || 2) + R * 0.6 && jumpY < b.top - 0.5) return 'beam';
    }
    for (const sp of this.spinners) {
      if (Math.abs(z - sp.z) > sp.len / 2 + R) continue;
      const a = t * sp.speed + sp.phase;
      // bar runs along local X; rotation.y = a -> world direction (cos a, -sin a)
      const dx = Math.cos(a);
      const dz = -Math.sin(a);
      const px = x - sp.x;
      const pz = z - sp.z;
      const along = Math.max(-sp.len / 2, Math.min(sp.len / 2, px * dx + pz * dz));
      if (Math.hypot(px - along * dx, pz - along * dz) < R && Math.hypot(px, pz) > 3) return 'log';
    }
    for (const sl of this.sliders) {
      const sx = Math.sin(t * sl.speed + sl.phase) * sl.amp;
      if (Math.abs(x - sx) < sl.hw + R * 0.6 && Math.abs(z - sl.z) < sl.hd + R * 0.6) return 'wall';
    }
    for (const o of this.orbs) {
      const ox = Math.sin(t * o.speed + o.phase) * o.amp;
      if (Math.hypot(x - ox, z - o.z) < 2.6 + R * 0.7) return 'orb';
    }
    for (const [x0, x1, z0, z1] of this.spikeRects) if (x > x0 && x < x1 && z > z0 && z < z1) return 'spikes';
    if (this.lava && z < this.lava[1] - 1 && z > this.lava[0] + 1 && groundY - (this.lavaBase || 0) < 1.2) return 'lava';
    return null;
  }
}
