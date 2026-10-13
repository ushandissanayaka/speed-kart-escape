// Renders each kart model to a transparent PNG for the Karts popup (tilted 3/4 view,
// like the reference cards).

import * as THREE from 'three';
import { Kart } from '../entities/Kart.js';
import { KARTS } from '../../shared/gameData.js';

export function renderKartThumbs(size = 256) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#5a6aa8', 2.2));
  const sun = new THREE.DirectionalLight('#ffffff', 1.6);
  sun.position.set(-8, 14, 10);
  scene.add(sun);
  // Looking down at the kart with its nose pointing up-right, like the reference cards.
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  camera.position.set(-3.5, 25.5, 15);
  camera.lookAt(1.5, 1.5, -2.5);

  const out = {};
  for (const def of KARTS) {
    const kart = new Kart(def.id);
    kart.root.rotation.set(0, 2.45, 0);
    scene.add(kart.root);
    renderer.render(scene, camera);
    out[def.id] = renderer.domElement.toDataURL('image/png');
    scene.remove(kart.root);
  }
  renderer.dispose();
  renderer.forceContextLoss?.();
  return out;
}
