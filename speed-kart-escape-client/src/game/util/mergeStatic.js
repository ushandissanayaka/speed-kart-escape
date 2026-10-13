// Performance: bakes every static mesh in a scene into one mesh per material, turning
// hundreds of draw calls into a few dozen. Meshes stay correct when their material
// animates (colour, emissive, texture offset) because merged meshes keep the same
// material object. Anything that moves or swaps geometry must be marked
// `userData.dynamic = true` (on itself or an ancestor) so it is left alone.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function isDynamic(o, root) {
  for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic) return true;
  return false;
}

function prepare(geo, matrix) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.clearGroups();
  g.applyMatrix4(matrix);
  return g;
}

// Works on any group: geometry is baked relative to `root`, so a moving group (a kart,
// the bobbing chest) can be merged internally and still move as one piece.
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const rel = new THREE.Matrix4();
  const buckets = new Map(); // key -> { material, cast, receive, geos: [] }
  const victims = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    if (Array.isArray(o.material) || o.renderOrder !== 0 || !o.frustumCulled) return;
    if (isDynamic(o, root)) return;
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}|${o.receiveShadow ? 1 : 0}`;
    if (!buckets.has(key)) buckets.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] });
    buckets.get(key).geos.push(prepare(o.geometry, rel.multiplyMatrices(toRoot, o.matrixWorld)));
    victims.push(o);
  });

  for (const o of victims) o.parent.remove(o);

  const merged = new THREE.Group();
  merged.name = 'MergedStatic';
  for (const b of buckets.values()) {
    const geo = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (!geo) continue;
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.matrixAutoUpdate = false;
    merged.add(mesh);
  }
  root.add(merged);
  return { before: victims.length, after: merged.children.length };
}
