// 3D confetti burst: colourful paper pieces shoot up around the kart, tumble and fall.

import * as THREE from 'three';

const MAX = 600;
const COLORS = ['#ff3b5c', '#ffd21c', '#3dff4a', '#2ec5ff', '#b13bff', '#ff8a2a', '#ffffff', '#ff5ccf'].map((c) => new THREE.Color(c));

export class Confetti {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.9, 1.4),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }),
      MAX
    );
    this.mesh.frustumCulled = false;
    this.mesh.userData.dynamic = true;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.parts = Array.from({ length: MAX }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() }));
    this.dummy = new THREE.Object3D();
    this.alive = 0;
  }

  burst(origin, count = 260, size = 1) {
    this.parts.forEach((pt, i) => {
      if (i >= count) return;
      pt.size = size;
      pt.life = 2.2 + Math.random() * 0.8;
      pt.p.set(origin.x + (Math.random() - 0.5) * 6, origin.y + 3, origin.z + (Math.random() - 0.5) * 6);
      const a = Math.random() * Math.PI * 2;
      const sp = (8 + Math.random() * 18) * Math.sqrt(size);
      pt.v.set(Math.cos(a) * sp, (22 + Math.random() * 22) * Math.sqrt(size), Math.sin(a) * sp);
      pt.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      pt.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      this.mesh.setColorAt(i, COLORS[i % COLORS.length]);
    });
    this.mesh.instanceColor.needsUpdate = true;
    this.alive = MAX;
    this.mesh.visible = true;
  }

  update(dt) {
    if (!this.alive) return;
    this.alive = 0;
    this.parts.forEach((pt, i) => {
      if (pt.life > 0) {
        pt.life -= dt;
        pt.v.y -= 30 * dt;
        pt.v.multiplyScalar(1 - 1.2 * dt); // air drag: flutters down
        pt.p.addScaledVector(pt.v, dt);
        pt.r.x += pt.w.x * dt;
        pt.r.y += pt.w.y * dt;
        pt.r.z += pt.w.z * dt;
        this.alive++;
      }
      this.dummy.position.copy(pt.p);
      this.dummy.rotation.copy(pt.r);
      this.dummy.scale.setScalar(pt.life > 0 ? Math.min(1, pt.life * 2) * (pt.size || 1) : 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!this.alive) this.mesh.visible = false;
  }
}
