// Floor, grass, curbs and the huge stepped blue walls that enclose the starting place.

import * as THREE from 'three';
import { studBox, checkerBox } from '../util/textures.js';

export const COLORS = {
  floor: '#b0b8e2',
  floorEdge: '#5b67a3',
  grass: '#45f283',
  wall: '#6b8de0',
  wallPanel: '#a3c0f7',
  wallTop: '#86a3e6',
  platform: '#b9c3ec',
  treadPlatform: '#8b95c4',
};

// Two-tone checker floors from the reference: 4x4-stud squares, 1.4 units per stud.
export const FLOOR_CHECKER = { light: '#c3c8ee', dark: '#a3acdc', shadow: '#6f88d2' };
export const GRASS_CHECKER = { light: '#57f590', dark: '#3fe57a', shadow: '#22b85a', highlight: 'rgba(220,255,230,0.55)' };
const CHECKER_UNIT = 11.2; // one texture repeat = 2x2 checker squares = 8 studs

const GRASS_Y = 0.8;
const WALL_UNIT = 6;

export function buildArena(scene, collision) {
  const group = new THREE.Group();
  group.name = 'Arena';

  const floorSlab = (minX, maxX, minZ, maxZ, y, color, opts = {}) => {
    const w = maxX - minX;
    const d = maxZ - minZ;
    const h = opts.thickness ?? 2;
    const m = opts.checkerColors
      ? checkerBox(w, h, d, opts.checkerColors, { unit: CHECKER_UNIT })
      : studBox(w, h, d, color, { unit: opts.unit ?? 5.2, cells: 4, checker: opts.checker ?? 0, cast: false, contrast: opts.contrast ?? 1 });
    m.position.set((minX + maxX) / 2, y - h / 2, (minZ + maxZ) / 2);
    group.add(m);
    return m;
  };

  // Plaza + corridor floor (y = 0)
  floorSlab(-160, 160, -55, 58, 0, COLORS.floor, { checkerColors: FLOOR_CHECKER });
  floorSlab(-30, 30, -125, -55, 0, COLORS.floor, { checkerColors: FLOOR_CHECKER });

  // Grass blocks (raised)
  const grass = [
    [-195, -160, -125, 58],
    [160, 195, -125, 58],
    [-160, -30, -125, -55],
    [30, 160, -125, -55],
  ];
  for (const [a, b, c, d] of grass) {
    floorSlab(a, b, c, d, GRASS_Y, COLORS.grass, { checkerColors: GRASS_CHECKER, thickness: 3 });
    collision.addHeight(a, b, c, d, GRASS_Y);
  }

  // Dark curb where floor meets grass
  const curb = (x, z, w, d) => {
    const m = studBox(w, 1.1, d, COLORS.floorEdge, { unit: 4, cells: 2, cast: false });
    m.position.set(x, 0.55, z);
    group.add(m);
  };
  curb(-95, -55.6, 130, 1.4);
  curb(95, -55.6, 130, 1.4);
  curb(-160.6, 1.5, 1.4, 113);
  curb(160.6, 1.5, 1.4, 113);
  curb(-30.6, -90, 1.4, 70);
  curb(30.6, -90, 1.4, 70);

  // Leaderboard platform (east) and treadmill platform (south)
  const lb = floorSlab(144, 159, -46, 46, 1.2, COLORS.platform, { unit: 5.2, checker: 0, thickness: 1.2 });
  lb.castShadow = false;
  collision.addHeight(144, 159, -46, 46, 1.2);
  floorSlab(-78, 78, 13, 57, 0.45, COLORS.treadPlatform, { unit: 5.2, checker: 0, thickness: 0.45 });
  collision.addHeight(-78, 78, 13, 57, 0.45);

  // Walls -------------------------------------------------------------------
  // Tier 1 hugs the grass, tier 2 sits further back and higher, like the reference.
  const wall = (x, z, w, d, h, color = COLORS.wall) => {
    const m = studBox(w, h, d, color, { unit: WALL_UNIT, cells: 4, style: 'dot', cast: false, contrast: 0.9 });
    m.position.set(x, h / 2, z);
    group.add(m);
    return m;
  };

  // Tier 1 (inner) walls
  wall(-200, -33, 10, 190, 52); // west
  wall(200, -33, 10, 190, 52); // east
  wall(0, 63, 410, 10, 52); // south
  wall(-117, -130, 170, 10, 52); // north-west of gate
  wall(117, -130, 170, 10, 52); // north-east of gate

  // Tier 2 (outer, taller)
  wall(-235, -40, 30, 300, 88, '#7896e2');
  wall(235, -40, 30, 300, 88, '#7896e2');
  wall(0, 95, 500, 30, 88, '#7896e2');
  // North outer wall has a gap where the Stage 1 area sits behind the gate.
  wall(-205, -205, 90, 40, 88, '#7896e2');
  wall(205, -205, 90, 40, 88, '#7896e2');

  // Large raised panels on the inner faces (the light-blue "screens" in the reference).
  const panels = new THREE.Group();
  const panel = (x, y, z, w, h, ry) => {
    const m = studBox(w, h, 2, COLORS.wallPanel, { unit: WALL_UNIT, cells: 4, style: 'dot', cast: false, contrast: 0.9 });
    m.position.set(x, y, z);
    m.rotation.y = ry;
    panels.add(m);
  };
  const rowOf = (count, start, step, fn) => {
    for (let i = 0; i < count; i++) fn(start + i * step, i);
  };
  // Tier-2 panels peek above tier 1
  rowOf(13, -210, 35, (x, i) => panel(x, 64 + (i % 2) * 5, 79, 30, 30 + (i % 3) * 4, Math.PI));
  rowOf(13, -210, 35, (x, i) => Math.abs(x) > 165 && panel(x, 64 + ((i + 1) % 2) * 5, -184, 30, 30 + (i % 3) * 4, 0));
  rowOf(8, -165, 38, (z, i) => panel(-219, 64 + (i % 2) * 5, z, 32, 30 + (i % 3) * 4, Math.PI / 2));
  rowOf(8, -165, 38, (z, i) => panel(219, 64 + ((i + 1) % 2) * 5, z, 32, 30 + (i % 3) * 4, -Math.PI / 2));
  // Tier-1 panels
  // (skipped where the Legion wall screens sit, x 80-160)
  rowOf(10, -180, 40, (x) => (x < 80 || x > 160) && panel(x, 34, 57, 32, 26, Math.PI));
  rowOf(5, -108, 36, (z) => panel(-194, 28, z, 30, 30, Math.PI / 2));
  rowOf(5, -108, 36, (z) => panel(194, 28, z, 30, 30, -Math.PI / 2));
  group.add(panels);

  // Darker horizontal bands along the tops (the blue rims visible from above)
  const rim = (x, z, w, d, y) => {
    const m = studBox(w, 2, d, COLORS.wallTop, { unit: WALL_UNIT, cells: 4, style: 'dot', cast: false });
    m.position.set(x, y, z);
    group.add(m);
  };
  rim(-200, -33, 12, 192, 53);
  rim(200, -33, 12, 192, 53);
  rim(0, 63, 412, 12, 53);
  rim(-117, -130, 172, 12, 53);
  rim(117, -130, 172, 12, 53);

  scene.add(group);

  // Collision for walls north of the plaza (the stage corridor is open).
  collision.addBox(-117, -139, 174, 22);
  collision.addBox(117, -139, 174, 22);
  return group;
}
