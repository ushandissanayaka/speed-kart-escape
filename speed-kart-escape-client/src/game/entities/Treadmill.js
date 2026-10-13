// Treadmills, modelled on the reference recording:
//  - dark navy belt with lengthwise stripes that scroll toward the back
//  - long studded side rails that run past the front of the belt and step down
//  - an arch at the back (two posts + two-tier beam) carrying a dark screen
//  - x25 glows neon cyan and pulses; the giant x100 changes colour every ~0.5 s
// Built with the arch at local -Z, then rotated 180° so the arch is against the
// south wall and karts drive on from the plaza.

import * as THREE from 'three';
import { studBox, plainBox } from '../util/textures.js';
import { textSprite, FONTS } from '../util/text.js';
import { TREADMILL_BACK_Z, canUseTreadmill, treadmillLockText } from '../../shared/gameData.js';

export const BELT_Y = 1.0;

const STYLES = {
  grey: { rail: '#a9b2d8', rail2: '#c6cdea', arch: '#a9b2d8', top: '#97a1cc', label: '#ffffff', glow: 0 },
  yellow: { rail: '#ffe21a', rail2: '#eef77e', arch: '#e4f27e', top: '#ffe21a', label: '#ffd21c', glow: 0.32, blink: true },
  red: { rail: '#ff1f3f', rail2: '#ff4f6e', arch: '#ff2f5a', top: '#ff1f3f', label: '#ff2a3a', glow: 0.3, blink: true },
  neon: { rail: '#14c8ff', rail2: '#8af0ff', arch: '#18b4ff', top: '#1aa0ff', label: '#3ec7ff', glow: 1 },
  rainbow: { rail: '#ff2a2a', rail2: '#ff6a6a', arch: '#ff2a2a', top: '#ff2a2a', label: '#ff3fd2', glow: 0.35 },
};

// Colours the x100 treadmill flicks between (sampled from the recording).
const RAINBOW = ['#ff2a1f', '#f2f4ff', '#2ee6c8', '#ffe01a', '#1a6bff', '#a13bff', '#2ec84a', '#ff8a3a', '#e01ad8', '#9ff0e0', '#b4f21a', '#1a2bff'];

function beltTexture(stripes) {
  const c = document.createElement('canvas');
  c.width = 32 * stripes;
  c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 ? '#1c2a5e' : '#101a40';
    g.fillRect(i * 32, 0, 32, 64);
  }
  // faint cross seams so the scroll is visible
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillRect(0, 0, c.width, 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function labelLines(def, st) {
  const size = def.mult === 1 ? 92 : 110;
  if (def.style === 'rainbow') {
    return [
      {
        size: 150,
        font: FONTS.fredoka,
        stroke: '#141833',
        strokeWidth: 20,
        spans: [
          { text: 'x100 ', fill: ['#f4ff57', '#a8ff2e'] },
          { text: 'Speed', fill: ['#ff7ae8', '#c62aff'] },
        ],
      },
    ];
  }
  return [{ text: def.label, size, font: FONTS.fredoka, fill: st.label, stroke: '#141833', strokeWidth: size * 0.15 }];
}

export class Treadmill {
  constructor(def) {
    this.def = def;
    const st = STYLES[def.style] || STYLES.grey;
    this.style = st;
    const { w, d } = def;
    const giant = def.style === 'rainbow';
    const rail = giant ? 3 : 2.3;
    const beltW = w - rail * 2;
    this.root = new THREE.Group();
    this.root.position.set(def.x, 0, TREADMILL_BACK_Z - d / 2);
    // Model is built with the arch at local -Z; turn it so the arch backs onto the south wall.
    this.root.rotation.y = Math.PI;
    this.tinted = [];
    this.blinking = []; // red / yellow: lights flash on and off // meshes recoloured by the x100 animation
    this.glowing = []; // meshes whose glow pulses (x25)
    const emissive = (c) => (st.glow ? new THREE.Color(c).getHex() : 0x000000);
    // Animated treadmills get one private material per colour (shared by all their
    // parts, so they still merge into few draw calls); the rest use cached materials.
    const animated = giant || st.glow > 0.5 || st.blink;
    const ownMats = new Map();
    const block = (bw, bh, bd, color, extra = {}) => {
      const m = studBox(bw, bh, bd, color, { unit: 2.6, cells: 2, style: 'dot', emissive: emissive(color), emissiveIntensity: st.glow * 0.6, ...extra });
      if (animated) {
        const key = m.material.uuid;
        if (!ownMats.has(key)) ownMats.set(key, m.material.clone());
        m.material = ownMats.get(key);
      }
      return m;
    };
    const add = (m, x, y, z, tint = true) => {
      m.position.set(x, y, z);
      this.root.add(m);
      if (tint && st.blink) this.blinking.push(m);
      if (tint && (giant || st.glow > 0.5)) {
        if (giant) this.tinted.push(m);
        else this.glowing.push(m);
      }
      return m;
    };

    // --- base deck + belt ---------------------------------------------------
    add(block(w, 0.6, d, giant ? st.rail : '#2a3366'), 0, 0.3, 0, giant);
    if (giant) {
      // The x100 surface is coloured studs rather than a dark belt.
      add(block(beltW, 0.3, d - 2, st.rail2), 0, BELT_Y - 0.15, 0.5);
      // bright lip along the front edge
      add(plainBox(beltW, 0.25, 0.8, '#bff6ff', { emissive: new THREE.Color('#9ff0ff'), emissiveIntensity: 1 }), 0, BELT_Y + 0.05, d / 2 - 1, false);
    } else {
      this.beltTex = beltTexture(8);
      this.beltTex.repeat.set(1, d / 8);
      const belt = new THREE.Mesh(new THREE.PlaneGeometry(beltW, d - 1.5), new THREE.MeshLambertMaterial({ map: this.beltTex }));
      belt.rotation.x = -Math.PI / 2;
      add(belt, 0, BELT_Y, 0.4, false);
      belt.receiveShadow = true;
    }

    // --- side rails: two tones, longer than the belt, stepping down at the front
    const railH = giant ? 2.2 : 1.6;
    for (const sx of [-1, 1]) {
      const rx = sx * (w / 2 - rail / 2);
      add(block(rail, railH, d + 2, st.rail), rx, railH / 2 + 0.3, 1);
      add(block(rail * 0.5, railH + 0.01, d + 2.02, st.rail2), rx - sx * rail * 0.25, railH / 2 + 0.31, 1);
      add(block(rail, railH * 0.6, 2.4, st.rail), rx, (railH * 0.6) / 2 + 0.3, d / 2 + 3.2);
    }

    // --- arch at the back ----------------------------------------------------
    const backZ = -d / 2 + 1.4;
    const postH = giant ? 20 : 12;
    const post = giant ? 3.4 : 2.2;
    for (const sx of [-1, 1]) add(block(post, postH, post, st.arch), sx * (w / 2 - post / 2), 0.6 + postH / 2, backZ);
    if (giant) {
      // stepped gable: three beams, each narrower and higher
      const tiers = [
        [w, 3],
        [w * 0.72, 3],
        [w * 0.44, 3],
      ];
      let y = 0.6 + postH;
      for (const [tw, th] of tiers) {
        add(block(tw, th, post, st.top), 0, y + th / 2, backZ);
        y += th;
      }
      this.topY = y;
    } else {
      const beamY = 0.6 + postH;
      add(block(w + 0.6, 1.6, post + 0.4, st.top), 0, beamY + 0.8, backZ);
      add(block(w * 0.62, 1.2, post, st.arch), 0, beamY + 2.2, backZ);
      // screen: coloured frame with a dark navy panel
      add(block(w * 0.58, 3.4, 1.6, st.top), 0, beamY + 4.4, backZ);
      add(plainBox(w * 0.5, 2.6, 0.3, '#0d1a46', { emissive: new THREE.Color('#0a1640'), emissiveIntensity: 0.6 }), 0, beamY + 4.4, backZ + 0.85, false);
      this.topY = beamY + 6.2;
    }

    // x25 neon: soft additive halo around each glowing part
    if (st.glow >= 1) {
      this.halos = [];
      const haloMat = new THREE.MeshBasicMaterial({ color: '#33d6ff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      for (const m of this.glowing) {
        m.geometry.computeBoundingBox();
        const s = new THREE.Vector3();
        m.geometry.boundingBox.getSize(s);
        const h = new THREE.Mesh(new THREE.BoxGeometry(s.x + 0.9, s.y + 0.9, s.z + 0.9), haloMat);
        h.position.copy(m.position);
        this.root.add(h);
        this.halos.push(h);
      }
      this.haloMat = haloMat;
    }

    // --- floating label -------------------------------------------------------
    this.label = textSprite(labelLines(def, st), giant ? 7.5 : def.mult === 1 ? 4.6 : 5.6);
    // Float the label forward over the belt so it never cuts into the back wall.
    this.label.position.set(0, this.topY + (giant ? 9 : 7), backZ + (giant ? 14 : 11));
    this.root.add(this.label);

    this.lockLabel = null;
    this.locked = null;
    this.t = Math.random() * 10;
    this.colorTimer = 0;
    this.colorIndex = 0;
  }

  // Solid parts: the two rails (karts drive in between) and the arch posts.
  collisionBoxes() {
    const { x, w, d, style } = this.def;
    const rail = style === 'rainbow' ? 3 : 2.3;
    const cz = TREADMILL_BACK_Z - d / 2;
    return [
      { x: x - (w / 2 - rail / 2), z: cz - 1, w: rail, d: d + 2 },
      { x: x + (w / 2 - rail / 2), z: cz - 1, w: rail, d: d + 2 },
    ];
  }

  refreshLock(profile) {
    const locked = profile ? !canUseTreadmill(profile, this.def) : !!this.def.requires;
    if (locked === this.locked) return;
    this.locked = locked;
    if (locked && !this.lockLabel) {
      this.lockLabel = textSprite(
        [{ text: `🔒 ${treadmillLockText(this.def)}`, size: 64, font: FONTS.fredoka, fill: '#ffffff', stroke: '#141833', strokeWidth: 11 }],
        3.4
      );
      this.lockLabel.position.set(0, this.label.position.y - (this.def.style === 'rainbow' ? 5.6 : 4.6), this.label.position.z);
      this.root.add(this.lockLabel);
    }
    if (this.lockLabel) this.lockLabel.visible = locked;
  }

  update(dt) {
    this.t += dt;
    // Belt stripes run away from the arch, toward the open front.
    if (this.beltTex) this.beltTex.offset.y -= dt * 0.6;

    // Red / yellow: lights fade slowly on and off, at the same pace as the x25 glow.
    if (this.blinking.length) {
      const w = 0.5 + 0.5 * Math.sin(this.t * 3.2);
      for (const m of this.blinking) m.material.emissiveIntensity = 0.1 + 1.0 * w;
    }

    // x25: neon pulse.
    if (this.glowing.length) {
      const w = 0.5 + 0.5 * Math.sin(this.t * 3.2);
      for (const m of this.glowing) m.material.emissiveIntensity = 0.7 + 0.6 * w;
      if (this.haloMat) this.haloMat.opacity = 0.12 + 0.2 * w;
    }

    // x100: jump to a new random colour every ~0.5 s, like the reference.
    if (this.tinted.length) {
      this.colorTimer -= dt;
      if (this.colorTimer <= 0) {
        this.colorTimer = 0.5;
        let next = this.colorIndex;
        while (next === this.colorIndex) next = Math.floor(Math.random() * RAINBOW.length);
        this.colorIndex = next;
        const base = new THREE.Color(RAINBOW[next]);
        const light = base.clone().lerp(new THREE.Color('#ffffff'), 0.25);
        [...new Set(this.tinted.map((m) => m.material))].forEach((mat, i) => {
          const c = i % 2 ? light : base;
          mat.color.copy(c);
          mat.emissive.copy(c);
          mat.emissiveIntensity = 0.3;
        });
      }
    }
  }
}
