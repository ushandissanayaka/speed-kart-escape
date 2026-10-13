// Go-kart modelled on the reference (faces +Z):
//  - dark navy chassis plate running the full length, big navy wheels
//  - low white studded side panels between the wheels
//  - tall white wedge nose rising from the front bumper to the steering column,
//    topped by a glossy studded plank
//  - wide, low navy front bumper with angled corners
//  - dark seat with teal-speckled mesh, silver striped steering column
//  - navy rear frame (top bar, lower tray, struts) between the rear wheels
// Colours come from the kart definition so unlocked karts look different.

import * as THREE from 'three';
import { checkerMaterial, boxUVs, plainBox, plainMaterial } from '../util/textures.js';
import { KARTS } from '../../shared/gameData.js';
import { mergeStatic } from '../util/mergeStatic.js';

export const SEAT = { y: 3.3, z: -1.9 };

const STUD_UNIT = 10.4; // 8 studs of 1.3 units per texture repeat

function bodyColors(body) {
  const c = new THREE.Color(body);
  const shadow = c.clone().lerp(new THREE.Color('#5f86e6'), 0.55);
  return { light: body, dark: body, shadow: `#${shadow.getHexString()}`, highlight: 'rgba(255,255,255,0.9)' };
}

let meshTex = null;
function seatMeshTexture() {
  if (meshTex) return meshTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1530';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(60,170,170,0.55)' : 'rgba(30,90,110,0.6)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
  }
  meshTex = new THREE.CanvasTexture(c);
  meshTex.colorSpace = THREE.SRGBColorSpace;
  meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping;
  return meshTex;
}

let grillTex = null;
function grillTexture() {
  if (grillTex) return grillTex;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#eef1fb';
  g.fillRect(0, 0, 32, 64);
  g.fillStyle = '#1a2240';
  for (let y = 4; y < 64; y += 8) g.fillRect(4, y, 24, 3);
  grillTex = new THREE.CanvasTexture(c);
  grillTex.colorSpace = THREE.SRGBColorSpace;
  return grillTex;
}

// Studded box in the kart body colour.
function studdedBox(w, h, d, colors) {
  const m = new THREE.Mesh(boxUVs(new THREE.BoxGeometry(w, h, d), w, h, d, STUD_UNIT), checkerMaterial(colors));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Side profile (z, y) extruded across x — used for the wedge nose.
function profilePrism(points, width, material, unit = STUD_UNIT) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  // Shape is in the XY plane extruding along +Z: rotate so the profile lies in ZY, extrusion along X.
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / unit, uv.getY(i) / unit);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export class Kart {
  constructor(kartId = 'noob') {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.wheels = [];
    this.frontPivots = [];
    this.build(kartId);
  }

  build(kartId) {
    this.kartId = kartId;
    this.body.clear();
    this.wheels = [];
    this.frontPivots = [];
    const def = KARTS.find((k) => k.id === kartId) || KARTS[0];
    const colors = bodyColors(def.body);
    const T = def.trim;
    const A = def.accent;
    const add = (m, x, y, z) => {
      m.position.set(x, y, z);
      this.body.add(m);
      return m;
    };

    // --- chassis -----------------------------------------------------------
    add(plainBox(6.8, 0.9, 9.8, T), 0, 0.95, -2.1); // long plate, sticks out under the body
    add(plainBox(5.6, 0.4, 3.0, T), 0, 1.6, -2.0); // cockpit floor

    // --- low side panels between the wheels (with the lighter top rail) ---
    for (const sx of [-1, 1]) {
      add(studdedBox(1.0, 1.6, 5.4, colors), sx * 3.0, 2.2, -1.1);
      const rail = add(studdedBox(0.8, 0.5, 5.6, colors), sx * 2.75, 3.25, -1.2);
      rail.material = checkerMaterial(bodyColors(new THREE.Color(def.body).lerp(new THREE.Color('#8aa0e0'), 0.25).getStyle()));
    }

    // --- wedge nose ---------------------------------------------------------
    // Profile: tall at the steering column (z = 1.0), sloping down to the front (z = 7.4).
    const nose = profilePrism(
      [
        [1.0, 1.4],
        [7.4, 1.4],
        [7.4, 2.1],
        [1.0, 4.3],
      ],
      3.6,
      checkerMaterial(colors)
    );
    this.body.add(nose);
    // Glossy studded plank along the sloped top
    const NOSE_TOP = 4.3;
    const slope = Math.atan2(NOSE_TOP - 2.1, 7.4 - 1.0);
    const plankLen = Math.hypot(6.4, NOSE_TOP - 2.1) + 0.3;
    const plank = new THREE.Mesh(
      boxUVs(new THREE.BoxGeometry(3.2, 0.4, plankLen), 3.2, 0.4, plankLen, 12),
      new THREE.MeshLambertMaterial({ map: checkerMaterial(colors).map, emissive: '#ffffff', emissiveIntensity: 0.12 })
    );
    plank.rotation.x = slope;
    add(plank, 0, (NOSE_TOP + 2.1) / 2 + 0.22, (1.0 + 7.4) / 2);
    plank.castShadow = true;

    // --- front bumper: wide low navy wedge with angled corners -------------
    add(plainBox(7.4, 1.2, 1.6, T), 0, 0.95, 8.0);
    add(plainBox(5.0, 0.7, 1.2, T), 0, 1.75, 7.7);
    for (const sx of [-1, 1]) {
      const corner = add(plainBox(2.2, 1.2, 1.4, T), sx * 4.3, 0.95, 7.5);
      corner.rotation.y = sx * 0.55;
    }

    // --- cockpit -----------------------------------------------------------
    const meshMat = new THREE.MeshLambertMaterial({ map: seatMeshTexture() });
    const navyMat = plainMaterial(T);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.4, 3.0), [navyMat, navyMat, meshMat, navyMat, navyMat, navyMat]);
    add(seat, 0, 2.4, -2.3);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 1.4), [navyMat, navyMat, meshMat, navyMat, navyMat, meshMat]);
    add(back, 0, 2.9, -4.3);
    // Silver striped steering column
    const grill = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.9), new THREE.MeshLambertMaterial({ map: grillTexture() }));
    add(grill, 0, 3.3, 0.6);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.18, 8, 18), plainMaterial('#141a33'));
    wheel.rotation.x = -0.9;
    add(wheel, 0, 4.55, 0.35);
    this.steeringWheel = wheel;
    wheel.userData.dynamic = true;
    // Accent stripe along the plank edges
    for (const sx of [-1, 1]) {
      const stripe = plainBox(0.25, 0.25, plankLen - 0.4, A, { emissive: new THREE.Color(A), emissiveIntensity: 0.25 });
      stripe.rotation.x = slope;
      add(stripe, sx * 1.75, (NOSE_TOP + 2.1) / 2 + 0.3, (1.0 + 7.4) / 2);
    }

    // --- rear frame between the rear wheels --------------------------------
    add(plainBox(7.6, 0.6, 0.6, T), 0, 3.3, -6.7); // top bar
    add(plainBox(6.4, 0.6, 2.0, T), 0, 1.2, -6.4); // lower tray
    for (const sx of [-1, 1]) {
      const strut = add(plainBox(0.5, 2.4, 0.5, T), sx * 2.4, 2.25, -6.7);
      strut.rotation.z = sx * 0.35;
    }
    add(plainBox(8.6, 0.5, 0.5, T), 0, 1.85, -5.2); // rear axle

    // --- wheels ------------------------------------------------------------
    const tyreMat = plainMaterial('#0e1734');
    const hubMat = plainMaterial('#1d2a55');
    const mkWheel = (r, w) => {
      const g = new THREE.Group();
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 24), tyreMat);
      tyre.rotation.z = Math.PI / 2;
      tyre.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.04, 16), hubMat);
      hub.rotation.z = Math.PI / 2;
      g.add(tyre, hub);
      return g;
    };
    const place = (x, z, r, w, front) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, r, z);
      pivot.userData.dynamic = true;
      const wh = mkWheel(r, w);
      pivot.add(wh);
      this.body.add(pivot);
      this.wheels.push(wh);
      if (front) this.frontPivots.push(pivot);
    };
    place(-4.25, 4.2, 1.65, 1.7, true);
    place(4.25, 4.2, 1.65, 1.7, true);
    place(-4.6, -5.2, 1.9, 2.3, false);
    place(4.6, -5.2, 1.9, 2.3, false);

    this.body.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    // Bake the fixed bodywork into a few meshes; wheels and steering wheel still animate.
    const pos = this.body.position.clone();
    const rot = this.body.rotation.clone();
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    mergeStatic(this.body);
    this.body.position.copy(pos);
    this.body.rotation.copy(rot);
  }

  update(dt, velocity, steer) {
    for (const w of this.wheels) w.rotation.x += (velocity * dt) / 1.8;
    for (const p of this.frontPivots) p.rotation.y = steer * 0.45;
    this.steeringWheel.rotation.z = -steer * 1.2;
  }
}
