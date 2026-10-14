// Kart effects:
//  - ExhaustFire: two exhaust pipes at the back with flickering flames and sparks
//    that grow with speed (the "fire coming out of the kart" while racing).
//  - WindStreaks: white streaks rushing past the kart while it is in the air, so a
//    jump feels like cutting through the wind.

import * as THREE from 'three';

const flameOuter = new THREE.MeshBasicMaterial({ color: '#ff6a00', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const flameInner = new THREE.MeshBasicMaterial({ color: '#fff27a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffb02e', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

// Flame look per kart: colours and how far the flame shoots out at full speed.
// Junior Kart: red fire that reaches further; Pro Kart: blue fire that reaches further.
export const FLAME_STYLES = {
  default: { outer: '#ff6a00', inner: '#fff27a', spark: '#ffb02e', reach: 1 },
  junior: { outer: '#ff0a0a', inner: '#ff5a2a', spark: '#ff2a1a', reach: 1.8 },
  pro: { outer: '#1a6bff', inner: '#9fe4ff', spark: '#3ab8ff', reach: 1.8 },
};
const pipeMat = new THREE.MeshLambertMaterial({ color: '#3a3f55', emissive: '#111320', emissiveIntensity: 0.3 });

const SPARKS = 24;

export class ExhaustFire {
  // parent: kart body group (local +Z is forward)
  constructor(parent) {
    this.root = new THREE.Group();
    this.root.userData.dynamic = true;
    parent.add(this.root);
    // own materials so each kart can have its own flame colour
    this.outerMat = flameOuter.clone();
    this.innerMat = flameInner.clone();
    this.sparkMat = sparkMat.clone();
    this.reach = 1;
    this.flames = [];
    for (const x of [-2.2, 2.2]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 2.2, 12), pipeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(x, 2.3, -7.6);
      this.root.add(pipe);
      // cones point backward (-Z): geometry tip is +Y, rotate so +Y -> -Z
      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1, 12, 1, true), this.outerMat);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1, 10, 1, true), this.innerMat);
      for (const c of [outer, inner]) {
        c.geometry.translate(0, 0.5, 0);
        c.rotation.x = -Math.PI / 2;
        c.position.set(x, 2.3, -8.7);
        c.renderOrder = 8;
        this.root.add(c);
      }
      this.flames.push({ outer, inner });
    }
    // sparks (world-space so they trail behind)
    this.sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), this.sparkMat, SPARKS);
    this.sparks.frustumCulled = false;
    this.sparkData = Array.from({ length: SPARKS }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }));
    this.next = 0;
    this.acc = 0;
    this.dummy = new THREE.Object3D();
    this.tmp = new THREE.Vector3();
    this.t = 0;
  }

  setStyle(kartId) {
    const st = FLAME_STYLES[kartId] || FLAME_STYLES.default;
    this.outerMat.color.set(st.outer);
    this.innerMat.color.set(st.inner);
    this.sparkMat.color.set(st.spark);
    this.reach = st.reach;
  }

  attachSparks(scene) {
    scene.add(this.sparks);
  }

  update(dt, speed01) {
    this.t += dt;
    const on = speed01 > 0.08;
    for (const [i, f] of this.flames.entries()) {
      const flick = 0.75 + Math.sin(this.t * 38 + i * 2) * 0.15 + Math.random() * 0.2;
      const len = on ? (1.2 + speed01 * 4.5 * this.reach) * flick : 0.001;
      const w = 1 + speed01 * 0.4 * this.reach;
      f.outer.scale.set(w, len, w);
      f.inner.scale.set(1, len * 0.65, 1);
      f.outer.visible = f.inner.visible = on;
    }
    // emit sparks from the pipes
    if (on) {
      this.acc += dt * 30 * speed01;
      while (this.acc >= 1) {
        this.acc -= 1;
        const s = this.sparkData[this.next];
        const pipe = this.flames[this.next % 2].outer;
        pipe.getWorldPosition(this.tmp);
        s.p.copy(this.tmp);
        s.v.set((Math.random() - 0.5) * 6, 2 + Math.random() * 5, (Math.random() - 0.5) * 6);
        s.life = 0.45 + Math.random() * 0.3;
        this.next = (this.next + 1) % SPARKS;
      }
    }
    this.sparkData.forEach((s, i) => {
      if (s.life > 0) {
        s.life -= dt;
        s.v.y -= 12 * dt;
        s.p.addScaledVector(s.v, dt);
      }
      this.dummy.position.copy(s.p);
      this.dummy.scale.setScalar(s.life > 0 ? s.life * 2 : 0);
      this.dummy.updateMatrix();
      this.sparks.setMatrixAt(i, this.dummy.matrix);
    });
    this.sparks.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.sparks.parent?.remove(this.sparks);
  }
}

const streakMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });

export class WindStreaks {
  // parent: racer root (local +Z is forward)
  constructor(parent) {
    this.root = new THREE.Group();
    this.root.userData.dynamic = true;
    parent.add(this.root);
    this.mat = streakMat.clone();
    this.lines = Array.from({ length: 14 }, (_, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 7), this.mat);
      m.rotation.x = Math.PI / 2; // lie along Z
      const a = (i / 14) * Math.PI * 2;
      m.userData = { x: Math.cos(a) * (6 + (i % 3) * 1.5), y: 4 + Math.sin(a) * 4.5, z: Math.random() * 30 - 15, sp: 50 + Math.random() * 30 };
      m.renderOrder = 8;
      this.root.add(m);
      return m;
    });
    this.alpha = 0;
  }

  update(dt, airborne) {
    this.alpha += ((airborne ? 0.7 : 0) - this.alpha) * Math.min(1, dt * (airborne ? 12 : 6));
    this.mat.opacity = this.alpha;
    this.root.visible = this.alpha > 0.02;
    if (!this.root.visible) return;
    for (const l of this.lines) {
      const u = l.userData;
      u.z -= u.sp * dt; // stream backward past the kart
      if (u.z < -18) u.z = 14 + Math.random() * 6;
      l.position.set(u.x, u.y, u.z);
    }
  }
}
