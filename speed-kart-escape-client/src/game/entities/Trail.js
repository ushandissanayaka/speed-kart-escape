// Glowing cube trail behind a moving kart (cosmetic bought in the Trails menu).

import * as THREE from 'three';
import { TRAILS } from '../../shared/gameData.js';

const MAX = 90;

export class Trail {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }),
      MAX
    );
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    scene.add(this.mesh);
    this.parts = Array.from({ length: MAX }, () => ({ life: 0, pos: new THREE.Vector3(), size: 1 }));
    this.next = 0;
    this.acc = 0;
    this.colors = [];
    this.alive = 0;
    this.dummy = new THREE.Object3D();
    this.tmpColor = new THREE.Color();
  }

  setTrail(id) {
    this.colors = (TRAILS.find((t) => t.id === id)?.colors || []).map((c) => new THREE.Color(c));
  }

  update(dt, emitterPos, speed) {
    // Nothing equipped and nothing still fading out: skip the per-particle work.
    if (!this.colors.length && !this.alive) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    if (this.colors.length && Math.abs(speed) > 6) {
      this.acc += dt * Math.min(60, Math.abs(speed) * 0.9);
      while (this.acc >= 1) {
        this.acc -= 1;
        const p = this.parts[this.next];
        p.life = 1;
        p.size = 0.8 + Math.random() * 0.7;
        p.pos.set(emitterPos.x + (Math.random() - 0.5) * 4, emitterPos.y + Math.random() * 1.5, emitterPos.z + (Math.random() - 0.5) * 4);
        this.mesh.setColorAt(this.next, this.colors[this.next % this.colors.length]);
        this.next = (this.next + 1) % MAX;
      }
    }
    this.alive = 0;
    for (let i = 0; i < MAX; i++) {
      const p = this.parts[i];
      if (p.life > 0) {
        p.life -= dt * 1.4;
        this.alive++;
      }
      const s = Math.max(0, p.life) * p.size;
      this.dummy.position.copy(p.pos);
      this.dummy.position.y += (1 - p.life) * 1.2;
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
