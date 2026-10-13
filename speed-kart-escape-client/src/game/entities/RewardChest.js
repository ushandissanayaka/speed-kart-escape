// Big studded treasure chest — "REWARDS / Collect Free Rewards" — modelled on the
// reference: dark plum-brown studded body, a lid that overhangs the front and rises
// in steps, yellow studded trim on every edge, a centre band, a stepped lock plate
// with a black T keyhole, and small yellow spikes on the top corners.

import * as THREE from 'three';
import { studBox } from '../util/textures.js';
import { mergeStatic } from '../util/mergeStatic.js';
import { textSprite, updateTextObject, FONTS } from '../util/text.js';
import { TUNING, chestReady, formatClock } from '../../shared/gameData.js';

const BODY = '#574a66';
const LID = '#6c566a';
const TRIM = '#f2e21c';
const KEYHOLE = '#050a30';

// Chest size (world units)
export const CHEST_SIZE = { w: 26, d: 18 };
const W = CHEST_SIZE.w;
const D = CHEST_SIZE.d;
const BASE_Y = 1.2; // top of the yellow base plank
const BODY_H = 8;
const LID_H = 6;
const OVER = 0.9; // lid overhang at the front
const T = 1.4; // trim thickness

const SUB_STYLE = (text) => [{ text, size: 64, font: FONTS.montserrat, weight: 800, fill: '#ffffff', stroke: '#141833', strokeWidth: 11 }];

export class RewardChest {
  constructor(x, z, ry) {
    this.root = new THREE.Group();
    this.root.position.set(x, 0, z);
    this.root.rotation.y = ry;
    const chest = new THREE.Group();
    const brown = (w, h, d, color) => studBox(w, h, d, color, { unit: 2.6, cells: 2, style: 'dot', contrast: 0.9, emissive: 0x3a2c40, emissiveIntensity: 0.35 });
    const gold = (w, h, d) => studBox(w, h, d, TRIM, { unit: 2.6, cells: 2, style: 'dot', emissive: 0xf2e21c, emissiveIntensity: 0.14 });
    const put = (m, px, py, pz) => {
      m.position.set(px, py, pz);
      chest.add(m);
      return m;
    };

    const bodyTop = BASE_Y + BODY_H;
    const lidTop = bodyTop + LID_H;
    const lidFront = D / 2 + OVER;

    // Base plank
    put(gold(W + 3, BASE_Y, D + 3), 0, BASE_Y / 2, 0);

    // Body and lid
    put(brown(W, BODY_H, D, BODY), 0, BASE_Y + BODY_H / 2, 0);
    put(brown(W + 0.4, LID_H, D + OVER * 2, LID), 0, bodyTop + LID_H / 2, 0);
    // Stepped lid top (rises toward the middle, as seen from the side)
    const steps = [
      [D - 3, 1.8],
      [D - 9, 1.6],
    ];
    let sy = lidTop;
    for (const [d, h] of steps) {
      put(brown(W - 0.2, h, d, LID), 0, sy + h / 2, 0);
      // yellow caps on the step ends + front/back top edges
      for (const sx of [-1, 1]) put(gold(T, h + 0.1, d + 0.2), sx * (W / 2 - T / 2 + 0.1), sy + h / 2, 0);
      for (const sz of [-1, 1]) put(gold(W + 0.2, T * 0.7, T * 0.7), 0, sy + h - 0.2, sz * (d / 2));
      sy += h;
    }
    this.topY = sy;

    // Vertical corner posts (body + lid)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        put(gold(T, BODY_H, T), sx * (W / 2 - T / 2 + 0.2), BASE_Y + BODY_H / 2, sz * (D / 2 - T / 2 + 0.2));
        put(gold(T, LID_H, T), sx * (W / 2 - T / 2 + 0.4), bodyTop + LID_H / 2, sz * (lidFront - T / 2 + 0.2));
      }
    }
    // Horizontal bands: body bottom, body/lid seam, lid top — around all four sides
    const ring = (y, halfD, h = T) => {
      for (const sz of [-1, 1]) put(gold(W + 0.8, h, T), 0, y, sz * (halfD - T / 2 + 0.25));
      for (const sx of [-1, 1]) put(gold(T, h, halfD * 2 + 0.5), sx * (W / 2 - T / 2 + 0.3), y, 0);
    };
    ring(BASE_Y + T / 2, D / 2);
    ring(bodyTop - T / 2 + 0.2, D / 2);
    ring(lidTop - T / 2, lidFront);

    // Centre band down the front and back
    for (const sz of [-1, 1]) {
      put(gold(T, BODY_H, T * 0.8), 0, BASE_Y + BODY_H / 2, sz * (D / 2 + 0.2));
      put(gold(T, LID_H, T * 0.8), 0, bodyTop + LID_H / 2, sz * (lidFront + 0.2));
    }

    // Stepped lock plate with a T keyhole, sitting on the seam
    const fz = lidFront + 0.55;
    put(gold(6.4, 3.0, 1.0), 0, bodyTop + 0.9, fz);
    put(gold(3.8, 1.5, 1.0), 0, bodyTop + 3.1, fz);
    const key = (w, h, px, py) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), new THREE.MeshBasicMaterial({ color: KEYHOLE }));
      return put(m, px, py, fz + 0.52);
    };
    key(1.7, 0.7, 0, bodyTop + 1.7);
    key(0.7, 1.6, 0, bodyTop + 0.9);

    // Small spikes on the top corners
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        put(gold(T, 1.4, T), sx * (W / 2 - T / 2 + 0.4), lidTop + 0.7, sz * (lidFront - T / 2 + 0.2));
        put(gold(T * 0.6, 0.9, T * 0.6), sx * (W / 2 - T / 2 + 0.4), lidTop + 1.85, sz * (lidFront - T / 2 + 0.2));
      }
    }

    this.chest = chest;
    chest.userData.dynamic = true; // bobs up and down
    mergeStatic(chest); // ~70 boxes -> a few meshes
    this.root.add(chest);

    // Labels live in world space so they always face the camera upright
    this.labelGroup = new THREE.Group();
    this.labelGroup.position.set(x, 0, z);
    this.title = textSprite(
      [{ text: 'REWARDS', size: 140, font: FONTS.montserrat, weight: 900, fill: ['#e6ff3a', '#5cff2a', '#22d61a'], stroke: '#0c2a10', strokeWidth: 22 }],
      7.2
    );
    this.title.position.y = this.topY + 11;
    this.subtitle = textSprite(SUB_STYLE('Collect Free Rewards'), 2.9);
    this.subtitle.position.y = this.topY + 6.6;
    this.labelGroup.add(this.title, this.subtitle);
    this.lastText = '';
    this.t = 0;
  }

  addTo(scene) {
    scene.add(this.root, this.labelGroup);
  }

  update(dt, profile, now) {
    this.t += dt;
    const ready = profile ? chestReady(profile, now) : true;
    this.chest.position.y = ready ? Math.abs(Math.sin(this.t * 2)) * 0.5 : 0;
    const text = ready ? 'Collect Free Rewards' : `Ready in ${formatClock(TUNING.chestCooldownMs - (now - profile.lastChestAt))}`;
    if (text !== this.lastText) {
      this.lastText = text;
      updateTextObject(this.subtitle, SUB_STYLE(text), 2.9);
    }
  }
}
