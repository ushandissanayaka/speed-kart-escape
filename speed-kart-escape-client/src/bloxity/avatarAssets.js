// Bloxity avatar CDN helpers (see docs.bloxity.io — "Show the player's avatar").

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export const CDN = 'https://static.bloxity.io/avatars';
export const API = 'https://api.bloxity.io';

export const isReal = (id) => id != null && id !== '' && id !== '-1' && id !== 'undefined' && id !== 'null';

const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();
const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('anonymous');

let basePromise = null;

// Loads player.glb once; every avatar is a SkeletonUtils clone of it.
export function loadBaseBody() {
  if (!basePromise) {
    basePromise = gltfLoader.loadAsync(`${CDN}/player.glb`).then((gltf) => {
      const root = gltf.scene.getObjectByName('character') || gltf.scene;
      return root;
    });
  }
  return basePromise.then((root) => SkeletonUtils.clone(root));
}

const texCache = new Map();
export function loadPixelTexture(url) {
  if (!texCache.has(url)) {
    texCache.set(
      url,
      texLoader.loadAsync(url).then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.flipY = false; // glTF UV convention
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestMipmapLinearFilter;
        return t;
      })
    );
  }
  return texCache.get(url);
}

// Skin texture for another player, built from their equipped ids.
export function skinTextureUrl(equipped = {}) {
  let name = `s${isReal(equipped.skinId) ? equipped.skinId : 0}`;
  if (isReal(equipped.pantsId)) name += `_pn${equipped.pantsId}`;
  if (isReal(equipped.shirtId)) name += `_sh${equipped.shirtId}`;
  if (isReal(equipped.faceId)) name += `_fc${equipped.faceId}`;
  return `${API}/v1/avatar/skin-texture/${name}.png`;
}

const objCache = new Map();
export async function loadAccessory(folder, id) {
  const key = `${folder}/${id}`;
  if (!objCache.has(key)) {
    objCache.set(
      key,
      Promise.all([
        objLoader.loadAsync(`${CDN}/items/${folder}/${id}.obj`),
        loadPixelTexture(`${CDN}/textures/${folder}/${id}.png`).catch(() => null),
      ])
    );
  }
  const [obj, tex] = await objCache.get(key);
  const clone = obj.clone(true);
  clone.traverse((o) => {
    if (o.isMesh) {
      const t = tex ? tex.clone() : null;
      if (t) {
        t.flipY = true; // OBJ UVs use the standard image orientation
        t.needsUpdate = true;
      }
      o.material = new THREE.MeshLambertMaterial({ map: t, color: t ? 0xffffff : 0x888888 });
      o.castShadow = true;
    }
  });
  return clone;
}

// Custom body parts (head / torso / arms / legs): skinned meshes on the same rig as
// player.glb. Each replaces one of the default body meshes.
export const PART_SLOTS = [
  { key: 'headId', replace: 'default_head', url: (id) => `${CDN}/parts/head/${id}.glb` },
  { key: 'torsoId', replace: 'default_torso', url: (id) => `${CDN}/parts/torso/${id}.glb` },
  { key: 'armLId', replace: 'default_arm_L', url: (id) => `${CDN}/parts/arms/${id}_L.glb` },
  { key: 'armRId', replace: 'default_arm_R', url: (id) => `${CDN}/parts/arms/${id}_R.glb` },
  { key: 'legLId', replace: 'default_leg_L', url: (id) => `${CDN}/parts/legs/${id}_L.glb` },
  { key: 'legRId', replace: 'default_leg_R', url: (id) => `${CDN}/parts/legs/${id}_R.glb` },
];

const partCache = new Map();
// Returns the part's SkinnedMesh (a fresh clone each call).
export async function loadPart(url) {
  if (!partCache.has(url)) partCache.set(url, gltfLoader.loadAsync(url).then((g) => g.scene));
  const scene = SkeletonUtils.clone(await partCache.get(url));
  let mesh = null;
  scene.traverse((o) => {
    if (!mesh && o.isSkinnedMesh) mesh = o;
  });
  return mesh;
}

// Attachments described in the docs. Hat, hair and mask share the hats folder and Neck1.
// Hand and shoes are worn as a pair: the mesh on the left leaf bone plus a copy
// mirrored across x on the right one.
export const SLOT_ATTACH = [
  { key: 'hatId', folder: 'hats', bone: 'Neck1', local: [0, 0.8, 0] },
  { key: 'hairId', folder: 'hats', bone: 'Neck1', local: [0, 0.8, 0] },
  { key: 'maskId', folder: 'hats', bone: 'Neck1', local: [0, 0.8, 0] },
  { key: 'backId', folder: 'back', bone: 'Spine2', local: [0, 0, 0] },
  { key: 'neckId', folder: 'neck', bone: 'Spine2', origin: [0, 4.8, 0] },
  { key: 'chestId', folder: 'chest', bone: 'Spine2', origin: [0, 3.6, 0] },
  { key: 'waistId', folder: 'waist', bone: 'Spine1', origin: [0, 2.4, 0] },
  { key: 'handId', folder: 'hand', pair: ['ArmL2_leaf', 'ArmR2_leaf'] },
  { key: 'shoesId', folder: 'shoes', pair: ['LegL2_leaf', 'LegR2_leaf'] },
];
