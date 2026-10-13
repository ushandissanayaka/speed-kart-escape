// Display screens showing the Legion platform logo:
//  - makeVideoScreen: black screen on a light studded frame with two legs (beside the
//    Stage 1 corridor)
//  - makeWallScreens: the row of three wall-mounted units between the treadmills and
//    the leaderboards — dark navy screen on top, light-blue panel underneath.

import * as THREE from 'three';
import { studBox, plainBox } from '../util/textures.js';

const LOGO_URL = './legion-logo.png';
let logoTex = null;

// Shared texture of the Legion lion logo (transparent PNG).
function legionLogo() {
  if (!logoTex) {
    logoTex = new THREE.TextureLoader().load(LOGO_URL);
    logoTex.colorSpace = THREE.SRGBColorSpace;
    logoTex.anisotropy = 8;
  }
  return logoTex;
}

function logoPlane(size, opacity = 0.92) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: legionLogo(), transparent: true, opacity, depthWrite: false, toneMapped: false })
  );
  m.renderOrder = 4;
  return m;
}

export function makeVideoScreen() {
  const root = new THREE.Group();
  const frame = studBox(22, 13, 1.2, '#d8dcef', { unit: 2.6, cells: 2, style: 'dot' });
  frame.position.y = 11;
  root.add(frame);
  const screen = plainBox(20.4, 11.4, 0.3, '#05070d');
  screen.position.set(0, 11, 0.7);
  root.add(screen);
  const logo = logoPlane(5.2);
  logo.position.set(0, 11, 0.9);
  root.add(logo);
  for (const sx of [-1, 1]) {
    const post = studBox(1.4, 11, 1.4, '#d8dcef', { unit: 2.6, cells: 2, style: 'dot' });
    post.position.set(sx * 11.6, 5.5, -0.2);
    root.add(post);
  }
  return root;
}

// `count` units side by side, each `w` wide, built facing +Z (rotate to face the plaza).
export function makeWallScreens(count = 3, w = 20) {
  const root = new THREE.Group();
  const lowerH = 13;
  const screenH = 11;
  const gap = 1.2;
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * (w + gap);
    // Lower light-blue panel: pale frame, two side strips, frosted centre
    const lower = studBox(w, lowerH, 2, '#cfe2ff', { unit: 2.6, cells: 2, style: 'dot', contrast: 0.5, emissive: 0x9cc0f0, emissiveIntensity: 0.45 });
    lower.position.set(x, lowerH / 2, 0);
    root.add(lower);
    for (const sx of [-1, 1]) {
      const strip = plainBox(w * 0.13, lowerH - 2.4, 0.3, '#e8f1ff', { emissive: new THREE.Color('#c8dcff'), emissiveIntensity: 0.5 });
      strip.position.set(x + sx * w * 0.36, lowerH / 2, 1.1);
      root.add(strip);
    }
    const centre = plainBox(w * 0.52, lowerH - 2.4, 0.3, '#8fb8f0', { emissive: new THREE.Color('#6a9ae8'), emissiveIntensity: 0.55 });
    centre.position.set(x, lowerH / 2, 1.1);
    root.add(centre);
    // Thin ledge between panel and screen
    const ledge = plainBox(w + 0.6, 0.6, 2.6, '#9fc3f5', { emissive: new THREE.Color('#7aa8ee'), emissiveIntensity: 0.4 });
    ledge.position.set(x, lowerH + 0.3, 0.2);
    root.add(ledge);
    // Dark navy screen with a light rim on top
    const rim = plainBox(w + 0.4, screenH + 0.4, 1.6, '#7aa8ee', { emissive: new THREE.Color('#5a8ee0'), emissiveIntensity: 0.45 });
    rim.position.set(x, lowerH + 0.6 + screenH / 2, 0);
    root.add(rim);
    const screen = plainBox(w - 0.2, screenH - 0.2, 0.4, '#061230', { emissive: new THREE.Color('#030a20'), emissiveIntensity: 0.6 });
    screen.position.set(x, lowerH + 0.6 + screenH / 2, 0.75);
    root.add(screen);
    const logo = logoPlane(4.6);
    logo.position.set(x, lowerH + 0.6 + screenH / 2, 1.0);
    root.add(logo);
    // Light post between units
    if (i < count - 1) {
      const post = plainBox(gap, lowerH + screenH + 1.6, 2.4, '#b8d4ff', { emissive: new THREE.Color('#9cc0f0'), emissiveIntensity: 0.45 });
      post.position.set(x + (w + gap) / 2, (lowerH + screenH + 1.6) / 2, 0);
      root.add(post);
    }
  }
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return root;
}
