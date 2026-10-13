// Studded sign boards with white outlined lettering ("Be the best kart pilot !", etc.).

import * as THREE from 'three';
import { studBox } from '../util/textures.js';
import { textPlane } from '../util/text.js';

const FACE = '#86aef2';
const FRAME = '#5573c4';
const POST = '#6b7fbf';

// opts: { width, height, lift (bottom edge height), tilt (lean back, radians), posts, lines, textHeight, frameless }
export function makeBillboard({ width, height, lift = 4, tilt = 0.12, posts = true, lines, textHeight, textOffsetY = 0, wallMounted = false }) {
  const root = new THREE.Group();
  const board = new THREE.Group();

  const frame = studBox(width + 2, height + 2, 1.6, FRAME, { unit: 4, cells: 4, style: 'dot' });
  board.add(frame);
  const face = studBox(width, height, 0.6, FACE, { unit: 3, cells: 4, style: 'dot', contrast: 0.8 });
  face.position.z = 0.75;
  board.add(face);

  if (lines) {
    const text = textPlane(lines, textHeight ?? height * 0.7);
    text.position.set(0, textOffsetY, 1.12);
    board.add(text);
  }

  board.position.y = lift + height / 2 + 1;
  board.rotation.x = wallMounted ? 0 : -tilt;
  root.add(board);

  if (posts && !wallMounted) {
    const ph = lift + height * 0.6;
    for (const sx of [-1, 1]) {
      const p = studBox(1.8, ph, 1.8, POST, { unit: 2, cells: 2, style: 'dot' });
      p.position.set(sx * width * 0.32, ph / 2, -0.9 - Math.sin(tilt) * height * 0.3);
      root.add(p);
    }
  }
  return root;
}
