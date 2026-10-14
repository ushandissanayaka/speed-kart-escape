// The Bloxity base character (player.glb) with the player's skin and accessories,
// posed sitting in a kart. Falls back to a blocky stand-in if the CDN is unreachable.
//
// player.glb facts: 6.4 units tall, faces +Z, hips at y = 2.4, 22-bone rig rooted at Rig1.

import * as THREE from 'three';
import { SLOT_ATTACH, isReal, loadAccessory, loadBaseBody, loadPixelTexture, skinTextureUrl } from '../../bloxity/avatarAssets.js';

const HIP_Y = 2.4;

export class BloxityAvatar {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'BloxityAvatar';
    this.body = null;
    this.bones = {};
    this.accessories = [];
    this.restInverse = new Map();
    this.token = 0;
    this.steer = 0;
    this.t = Math.random() * 10;
  }

  // avatar: { equipped, proportions, skinUrl }
  async load(avatar = {}) {
    const token = ++this.token;
    let body;
    try {
      body = await loadBaseBody();
    } catch (err) {
      console.warn('[avatar] player.glb unavailable, using stand-in', err);
      body = buildStandIn();
    }
    if (token !== this.token) return;

    if (this.body) this.root.remove(this.body);
    this.body = body;
    this.bones = {};
    body.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        if (o.material) {
          o.material = o.material.clone();
          o.material.roughness = 0.75;
          o.material.metalness = 0;
        }
      }
    });
    // Hips sit on the kart seat: shift the model so y = 0 is the hip line.
    body.position.y = -HIP_Y;
    this.root.add(body);
    this.captureRest();
    this.applyProportions(avatar.proportions || {});
    this.poseSeated();
    await Promise.all([this.applySkin(avatar, token), this.applyAccessories(avatar.equipped || {}, token)]);
  }

  captureRest() {
    this.body.updateMatrixWorld(true);
    const rootInv = new THREE.Matrix4().copy(this.body.matrixWorld).invert();
    this.bindQ = {};
    for (const [name, bone] of Object.entries(this.bones)) {
      const m = new THREE.Matrix4().multiplyMatrices(rootInv, bone.matrixWorld);
      this.restInverse.set(name, m.invert());
      this.bindQ[name] = bone.quaternion.clone(); // bind pose, for emotes
    }
  }

  async applySkin(avatar, token) {
    const eq = avatar.equipped || {};
    const hasCustom = avatar.skinUrl || ['skinId', 'shirtId', 'pantsId', 'faceId'].some((k) => isReal(eq[k]));
    if (!hasCustom) return; // default texture baked into player.glb
    const url = avatar.skinUrl || skinTextureUrl(eq);
    try {
      const tex = await loadPixelTexture(url);
      if (token !== this.token) return;
      this.body.traverse((o) => {
        if (o.isMesh && o.material?.map) {
          o.material.map = tex;
          o.material.needsUpdate = true;
        }
      });
    } catch (err) {
      console.warn('[avatar] skin texture failed', url, err);
    }
  }

  async applyAccessories(equipped, token) {
    for (const a of this.accessories) a.parent?.remove(a);
    this.accessories = [];
    const jobs = SLOT_ATTACH.filter((s) => isReal(equipped[s.key])).map(async (slot) => {
      try {
        const mesh = await loadAccessory(slot.folder, equipped[slot.key]);
        if (token !== this.token) return;
        const bone = this.bones[slot.bone];
        if (!bone) return;
        if (slot.origin) {
          // Newer accessories: local = restInverse(bone) x translate(origin)
          const ri = this.restInverse.get(slot.bone);
          mesh.matrixAutoUpdate = false;
          mesh.matrix.multiplyMatrices(ri, new THREE.Matrix4().makeTranslation(...slot.origin));
        } else {
          mesh.position.set(...slot.local);
        }
        bone.add(mesh);
        this.accessories.push(mesh);
      } catch (err) {
        console.warn('[avatar] accessory failed', slot.key, err);
      }
    });
    await Promise.all(jobs);
  }

  applyProportions(p) {
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 1));
    const height = clamp(p.height, 0.5, 1.6);
    const head = clamp(p.headScale, 0.3, 2.6);
    this.body.scale.setScalar(height);
    this.body.position.y = -HIP_Y * height;
    if (this.bones.Neck1) this.bones.Neck1.scale.setScalar(head);
  }

  poseSeated() {
    const b = this.bones;
    // Legs straight forward (negative X on the offset bones lifts a limb toward +Z).
    if (b.LegL_Offset) b.LegL_Offset.rotation.set(-Math.PI / 2 + 0.05, 0, 0.06);
    if (b.LegR_Offset) b.LegR_Offset.rotation.set(-Math.PI / 2 + 0.05, 0, -0.06);
    this.setArms(0);
  }

  setArms(steer) {
    const b = this.bones;
    const reach = -1.05;
    if (b.ArmL_Offset) b.ArmL_Offset.rotation.set(reach - steer * 0.25, 0, 0.18);
    if (b.ArmR_Offset) b.ArmR_Offset.rotation.set(reach + steer * 0.25, 0, -0.18);
  }

  update(dt, steer = 0, speed01 = 0) {
    this.t += dt;
    this.steer += (steer - this.steer) * Math.min(1, dt * 8);
    if (!this.body) return;
    this.setArms(this.steer);
    const b = this.bones;
    if (b.Neck_Offset) b.Neck_Offset.rotation.z = -this.steer * 0.12;
    if (b.Spine1) b.Spine1.rotation.x = -0.08 * speed01 + Math.sin(this.t * 9) * 0.01 * speed01;
    this.applyEmote(dt);
  }

  // --- Boxity emotes --------------------------------------------------------
  // clip = { len, loop, tracks: { boneName: [[timeSec, xDeg, yDeg, zDeg], ...] } }.
  // Values are degree deltas over the bind pose (euler XYZ, right-multiplied onto
  // the bone's bind quaternion), smoothstep between keys, blended in over ~0.1 s.
  playEmote(clip) {
    if (!clip?.tracks || !this.body || !this.bindQ) return;
    this.stopEmote();
    this.emote = { clip, t: 0 };
  }

  stopEmote() {
    const e = this.emote;
    if (!e) return;
    this.emote = null;
    for (const name of Object.keys(e.clip.tracks || {})) {
      const bone = this.bones[name];
      const bind = this.bindQ?.[name];
      if (bone && bind) bone.quaternion.copy(bind);
    }
    this.poseSeated();
  }

  applyEmote(dt) {
    const e = this.emote;
    if (!e) return;
    try {
      e.t += dt;
      const len = Math.max(0.01, Number(e.clip.len) || 1);
      if (!e.clip.loop && e.t > len) return this.stopEmote();
      const time = e.clip.loop ? e.t % len : Math.min(e.t, len);
      const w = Math.min(1, e.t / 0.1);
      for (const [name, keys] of Object.entries(e.clip.tracks)) {
        const bone = this.bones[name];
        const bind = this.bindQ[name];
        if (!bone || !bind || !Array.isArray(keys) || !keys.length) continue; // unknown bone: ignore
        let k;
        if (time <= keys[0][0]) k = keys[0];
        else if (time >= keys[keys.length - 1][0]) k = keys[keys.length - 1];
        else {
          let i = 0;
          while (i < keys.length - 2 && keys[i + 1][0] < time) i++;
          const a = keys[i];
          const c = keys[i + 1];
          let s = (time - a[0]) / Math.max(1e-6, c[0] - a[0]);
          s = s * s * (3 - 2 * s);
          k = [time, a[1] + (c[1] - a[1]) * s, a[2] + (c[2] - a[2]) * s, a[3] + (c[3] - a[3]) * s];
        }
        _euler.set(k[1] * DEG, k[2] * DEG, k[3] * DEG, 'XYZ');
        _q.setFromEuler(_euler);
        _target.copy(bind).multiply(_q);
        bone.quaternion.slerp(_target, w);
      }
    } catch {
      this.emote = null; // never throw from an emote
    }
  }
}

const DEG = Math.PI / 180;
const _euler = new THREE.Euler();
const _q = new THREE.Quaternion();
const _target = new THREE.Quaternion();

// Blocky stand-in with the same proportions as player.glb (only used offline).
function buildStandIn() {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const part = (w, h, d, c, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  part(2.8, 2.4, 1.6, 0x8bc34a, 0, 3.6, 0);
  part(1.6, 1.6, 1.6, 0xe39a62, 0, 5.6, 0);
  // Legs and arms are built already in the seated / steering pose.
  part(1.35, 1.6, 2.4, 0x7a5c44, -0.7, 2.4, 1.2);
  part(1.35, 1.6, 2.4, 0x7a5c44, 0.7, 2.4, 1.2);
  const armL = part(1.2, 1.2, 2.4, 0xe39a62, 2.0, 4.0, 1.1);
  const armR = part(1.2, 1.2, 2.4, 0xe39a62, -2.0, 4.0, 1.1);
  armL.rotation.x = armR.rotation.x = 0.4;
  g.name = 'character';
  return g;
}
