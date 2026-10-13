// Market stall with a cyan/white striped awning — "Merchant / Buy Potions" — plus the
// glowing blue pad in front that opens the potion shop.

import * as THREE from 'three';
import { studBox, plainBox } from '../util/textures.js';
import { textSprite, FONTS } from '../util/text.js';

const WOOD = '#7a5446';
const WOOD_DARK = '#5a3c34';

function awningTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#ffffff' : '#4fe6f0';
    g.fillRect(i * 32, 0, 32, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class MerchantStall {
  constructor(x, z, padX, padZ) {
    this.root = new THREE.Group();
    const stall = new THREE.Group();
    stall.position.set(x, 0, z);

    // Posts
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const h = sz < 0 ? 12 : 10;
        const p = studBox(1.2, h, 1.2, WOOD_DARK, { unit: 2, cells: 2, style: 'dot' });
        p.position.set(sx * 9, h / 2, sz * 4);
        stall.add(p);
      }
    }
    // Counter
    const counter = studBox(19, 4.2, 4, WOOD, { unit: 2.6, cells: 2, style: 'dot' });
    counter.position.set(0, 2.1, 4.2);
    stall.add(counter);
    const counterTop = studBox(20, 0.8, 5, WOOD_DARK, { unit: 2.6, cells: 2, style: 'dot' });
    counterTop.position.set(0, 4.6, 4.2);
    stall.add(counterTop);
    // Back wall
    const back = studBox(18, 9, 0.8, WOOD, { unit: 2.6, cells: 2, style: 'dot' });
    back.position.set(0, 4.5, -4);
    stall.add(back);
    // Potions on the counter
    const potionColors = ['#ff3d7a', '#3ec7ff', '#9b3bff', '#42ec7c'];
    potionColors.forEach((col, i) => {
      const b = plainBox(1.1, 1.6, 1.1, col, { emissive: new THREE.Color(col), emissiveIntensity: 0.35 });
      b.position.set(-5 + i * 3.3, 5.8, 4.2);
      const neck = plainBox(0.5, 0.6, 0.5, '#e8e8f0');
      neck.position.set(-5 + i * 3.3, 6.9, 4.2);
      stall.add(b, neck);
    });
    // Striped awning, sloping toward the front
    const aw = new THREE.Mesh(new THREE.BoxGeometry(21, 0.5, 11), [
      plainBox(1, 1, 1, '#4fe6f0').material,
      plainBox(1, 1, 1, '#4fe6f0').material,
      new THREE.MeshLambertMaterial({ map: awningTexture() }),
      plainBox(1, 1, 1, '#ffffff').material,
      new THREE.MeshLambertMaterial({ map: awningTexture() }),
      plainBox(1, 1, 1, '#4fe6f0').material,
    ]);
    aw.position.set(0, 11.2, 0.3);
    aw.rotation.x = 0.2;
    aw.castShadow = true;
    stall.add(aw);
    // Scalloped valance
    for (let i = 0; i < 8; i++) {
      const v = plainBox(2.4, 1.3, 0.3, i % 2 ? '#ffffff' : '#4fe6f0');
      v.position.set(-8.6 + i * 2.45, 9.6, 5.9);
      stall.add(v);
    }
    this.root.add(stall);

    // Glowing pad
    this.pad = new THREE.Group();
    this.pad.position.set(padX, 0, padZ);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(7.5, 7.5, 0.35, 48),
      new THREE.MeshLambertMaterial({ color: '#7d8ffb', emissive: '#3b5bff', emissiveIntensity: 0.35, transparent: true, opacity: 0.85 })
    );
    disc.position.y = 0.2;
    this.pad.add(disc);
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(7.5, 0.45, 12, 64),
      new THREE.MeshBasicMaterial({ color: '#2e7bff', toneMapped: false, transparent: true, opacity: 0.95 })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.45;
    this.pad.add(this.ring);
    this.glow = new THREE.Mesh(
      new THREE.CylinderGeometry(7.6, 7.6, 2.2, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: '#4d8dff', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
    );
    this.glow.position.y = 1.2;
    this.pad.add(this.glow);
    this.root.add(this.pad);

    // Labels
    const title = textSprite([{ text: 'Merchant', size: 120, font: FONTS.fredoka, fill: ['#5ff0ff', '#1a8cff'], stroke: '#0b1a4a', strokeWidth: 16 }], 6);
    title.position.set(x, 24, z);
    const sub = textSprite([{ text: 'Buy Potions', size: 80, font: FONTS.montserrat, weight: 800, fill: '#ffffff', stroke: '#141833', strokeWidth: 12 }], 3.2);
    sub.position.set(x, 16.5, z + 2);
    this.root.add(title, sub);
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    this.glow.material.opacity = 0.16 + Math.sin(this.t * 3) * 0.06;
  }
}
