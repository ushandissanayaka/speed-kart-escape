// A kart with a seated Bloxity avatar. Used for the local player and remote players.

import * as THREE from 'three';
import { Kart, SEAT } from './Kart.js';
import { BloxityAvatar } from './BloxityAvatar.js';
import { Trail } from './Trail.js';
import { ExhaustFire, WindStreaks } from './KartFx.js';
import { textSprite, FONTS } from '../util/text.js';

export class Racer {
  constructor(scene, { name = '', showName = false, kart = 'noob', trail = 'none' } = {}) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.kart = new Kart(kart);
    this.root.add(this.kart.root);
    this.avatar = new BloxityAvatar();
    this.avatar.root.position.set(0, SEAT.y, SEAT.z);
    this.kart.root.add(this.avatar.root);
    this.exhaust = new ExhaustFire(this.kart.root);
    this.exhaust.attachSparks(scene);
    this.wind = new WindStreaks(this.root);
    this.trail = new Trail(scene);
    this.trail.setTrail(trail);
    this.trailId = trail;
    this.nameTag = null;
    if (showName && name) this.setName(name);
    this.tilt = 0;
    this.bounce = 0;
    this.emitter = new THREE.Vector3();
    scene.add(this.root);
  }

  setName(name) {
    if (this.nameTag) this.root.remove(this.nameTag);
    this.nameTag = textSprite([{ text: name, size: 56, font: FONTS.fredoka, fill: '#ffffff', stroke: '#141833', strokeWidth: 9 }], 1.9);
    this.nameTag.position.set(0, 10.2, SEAT.z);
    this.root.add(this.nameTag);
  }

  // Blue bubble shown for a few seconds after respawning (like the reference).
  setShield(on) {
    if (on && !this.shield) {
      this.shield = new THREE.Mesh(
        new THREE.SphereGeometry(9, 28, 20),
        new THREE.MeshBasicMaterial({ color: '#5fc8ff', transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false })
      );
      this.shield.position.y = 4;
      this.shield.renderOrder = 7;
      this.root.add(this.shield);
    }
    if (this.shield) {
      this.shield.visible = on;
      if (on) this.shield.material.opacity = 0.22 + Math.sin(performance.now() / 120) * 0.08;
    }
  }

  setKart(id) {
    if (id && id !== this.kart.kartId) this.kart.build(id);
  }

  setTrail(id) {
    if (id !== this.trailId) {
      this.trailId = id;
      this.trail.setTrail(id);
    }
  }

  loadAvatar(avatarData) {
    return this.avatar.load(avatarData || {});
  }

  // velocity: forward units/s; steer: -1..1; accel: forward acceleration for body pitch
  animate(dt, velocity, steer, accel = 0, topSpeed = 60, airborne = false) {
    const speed01 = Math.min(1, Math.abs(velocity) / topSpeed);
    this.kart.update(dt, velocity, steer);
    this.avatar.update(dt, steer, speed01);
    // Body lean into corners and squat on acceleration
    const targetTilt = -steer * speed01 * 0.08;
    this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 6);
    this.kart.body.rotation.z = this.tilt;
    this.kart.body.rotation.x += (-accel * 0.0025 - this.kart.body.rotation.x) * Math.min(1, dt * 5);
    this.bounce += dt * (8 + speed01 * 20);
    this.kart.body.position.y = speed01 > 0.05 ? Math.sin(this.bounce) * 0.06 * speed01 : 0;

    // Trail emitter behind the rear wheels
    this.emitter.set(0, 1.2, -7.5).applyMatrix4(this.root.matrixWorld);
    this.trail.update(dt, this.emitter, velocity);
    this.exhaust.update(dt, Math.min(1, Math.max(0, velocity) / Math.max(topSpeed, 1)));
    this.wind.update(dt, airborne);
  }

  dispose() {
    this.scene.remove(this.root);
    this.trail.dispose();
    this.exhaust.dispose();
  }
}
