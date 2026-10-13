// Builds the starting place exactly as laid out in the reference video:
//  north  — corridor to the Stage 1 gate (merchant timer above), signs on the grass
//  west   — "To get new karts…" sign, trees; merchant stall + yellow pad at the NW corner
//  east   — SPEED / WINS / REBIRTHS leaderboards on a raised platform, World 2 arch
//  south  — treadmill row under "AFK Farm!" and "With treadmills…" boards, REWARDS chest
//  centre — spawn tile with the navy burst emblem

import * as THREE from 'three';
import { Sky } from '../entities/Sky.js';
import { buildArena } from '../entities/Arena.js';
import { buildScenery, buildSpawnPad } from '../entities/Scenery.js';
import { makeBillboard } from '../entities/Billboard.js';
import { Treadmill, BELT_Y } from '../entities/Treadmill.js';
import { Leaderboard } from '../entities/Leaderboard.js';
import { RewardChest, CHEST_SIZE } from '../entities/RewardChest.js';
import { MerchantStall } from '../entities/MerchantStall.js';
import { WorldGate, GATE } from '../entities/WorldGate.js';
import { StageGate } from '../entities/StageGate.js';
import { StageCourse } from '../entities/StageCourse.js';
import { makeVideoScreen, makeWallScreens } from '../entities/VideoScreen.js';
import { Collision } from '../systems/Collision.js';
import { mergeStatic } from '../util/mergeStatic.js';
import { studBox } from '../util/textures.js';
import { STYLE, textSprite, FONTS } from '../util/text.js';
import { TREADMILLS, TREADMILL_BACK_Z, WORLD } from '../../shared/gameData.js';

export class StartingPlace {
  constructor(scene) {
    this.scene = scene;
    this.collision = new Collision();
    this.collision.setBounds(WORLD.bounds);

    this.setupLighting();
    this.sky = new Sky();
    scene.add(this.sky.mesh);

    buildArena(scene, this.collision);
    buildScenery(scene, this.collision);
    buildSpawnPad(scene, WORLD.spawn.x, WORLD.spawn.z, this.collision);
    this.buildSigns();
    this.buildTreadmills();
    this.buildLeaderboards();

    // Face the chest toward the spawn so the lock side greets players.
    const chestRy = Math.atan2(WORLD.spawn.x - WORLD.chest.x, WORLD.spawn.z - WORLD.chest.z);
    this.chest = new RewardChest(WORLD.chest.x, WORLD.chest.z, chestRy);
    this.chest.addTo(scene);
    this.collision.addBox(WORLD.chest.x, WORLD.chest.z, CHEST_SIZE.w + 3, CHEST_SIZE.d + 3, chestRy);

    this.merchant = new MerchantStall(WORLD.merchantPad.x, -67, WORLD.merchantPad.x, WORLD.merchantPad.z);
    scene.add(this.merchant.root);
    this.collision.addBox(WORLD.merchantPad.x, -67, 42, 20);

    const yellow = studBox(WORLD.yellowPad.w, 0.3, WORLD.yellowPad.d, '#fae46b', { unit: 2.6, cells: 1, cast: false });
    yellow.position.set(WORLD.yellowPad.x, 0.15, WORLD.yellowPad.z);
    scene.add(yellow);

    const wg = WORLD.world2Gate;
    this.worldGate = new WorldGate(wg.x, wg.z, -0.3);
    scene.add(this.worldGate.root);
    const c = Math.cos(-0.3);
    const s = Math.sin(-0.3);
    for (const sx of [-1, 1]) this.collision.addCircle(wg.x + sx * GATE.pillarX * c, wg.z - sx * GATE.pillarX * s, 3.4);

    this.stageGate = new StageGate(this.collision);
    scene.add(this.stageGate.root);

    const screen = makeVideoScreen();
    screen.position.set(-58, 0.8, -100);
    screen.rotation.y = 0.55;
    scene.add(screen);
    this.collision.addBox(-58, -100, 24, 2, 0.55);

    // Three Legion screens on the back wall between the treadmills and the leaderboards.
    const wallScreens = makeWallScreens(3, 20);
    wallScreens.position.set(118, 0.45, 56);
    wallScreens.rotation.y = Math.PI;
    scene.add(wallScreens);

    // The six stages behind the Stage 1 gate.
    this.course = new StageCourse(scene, this.collision);

    // Bake everything that never moves into a few big meshes (hundreds of draw calls -> dozens).
    const m = mergeStatic(scene);
    console.info(`[perf] merged ${m.before} static meshes into ${m.after}`);
  }

  setupLighting() {
    const scene = this.scene;
    scene.background = new THREE.Color('#3f8ff0');
    scene.fog = new THREE.Fog('#a8c8ff', 320, 1100);

    const hemi = new THREE.HemisphereLight('#d9e6ff', '#6a78b8', 1.55);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight('#fff7ea', 2.1);
    sun.position.set(-120, 260, 140);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -250;
    sc.right = 250;
    sc.top = 190;
    sc.bottom = -190;
    sc.near = 10;
    sc.far = 700;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.6;
    sun.shadow.radius = 3;
    sun.target.position.set(0, 0, -30);
    scene.add(sun, sun.target);
    this.sun = sun;
  }

  buildSigns() {
    const scene = this.scene;
    const add = (obj, x, y, z, ry, collide) => {
      obj.position.set(x, y, z);
      obj.rotation.y = ry;
      scene.add(obj);
      if (collide) this.collision.addBox(x, z, collide[0], collide[1], ry);
    };
    const S = STYLE.sign;

    add(
      makeBillboard({
        width: 58,
        height: 25,
        lift: 3,
        lines: [S('Purchase Wins', 112, { stroke: '#3d3f52' }), S('And Coins!', 112, { stroke: '#3d3f52' })],
        textHeight: 18.5,
      }),
      -118, 0.8, -64, 0.1, [46, 3]
    );
    add(
      makeBillboard({
        width: 44,
        height: 19,
        lift: 3,
        lines: [S('Be the best', 120, { italic: true }), S('kart pilot !', 120, { italic: true })],
        textHeight: 14,
      }),
      64, 0.8, -104, -0.16, [32, 3]
    );
    add(
      makeBillboard({
        width: 40,
        height: 16,
        lift: 3,
        lines: [S('To get new karts you', 96, { italic: true }), S('need to earn wins.', 96, { italic: true })],
        textHeight: 10.5,
      }),
      -184, 0.8, -8, Math.PI / 2, [3, 30]
    );
    // South wall boards above the treadmills (face north)
    add(
      makeBillboard({
        width: 36,
        height: 17,
        lift: 34,
        wallMounted: true,
        lines: [S('With treadmills you', 92), S('can gain more and', 92), S('more speed.', 92)],
        textHeight: 13,
      }),
      30, 0, 55.4, Math.PI
    );
    add(
      makeBillboard({
        width: 44,
        height: 17,
        lift: 35,
        wallMounted: true,
        lines: [S('AFK Farm!', 150, { italic: true })],
        textHeight: 9,
      }),
      -28, 0, 55.4, Math.PI
    );

    const tm = textSprite(
      [
        { text: 'TREADMILLS', size: 110, font: FONTS.montserrat, weight: 900, fill: '#ffffff', stroke: '#141833', strokeWidth: 16 },
        { text: 'Automatically Increase your Speed!', size: 54, font: FONTS.montserrat, weight: 800, fill: '#ffe23d', stroke: '#141833', strokeWidth: 10 },
      ],
      6.2
    );
    tm.position.set(-20, 46, 30);
    scene.add(tm);
  }

  buildTreadmills() {
    this.treadmills = TREADMILLS.map((def) => {
      const t = new Treadmill(def);
      this.scene.add(t.root);
      for (const b of t.collisionBoxes()) this.collision.addBox(b.x, b.z, b.w, b.d);
      const hw = def.w / 2 - (def.style === 'rainbow' ? 3 : 2.3);
      this.collision.addHeight(def.x - hw, def.x + hw, TREADMILL_BACK_Z - def.d, TREADMILL_BACK_Z, BELT_Y);
      return t;
    });
  }

  buildLeaderboards() {
    this.leaderboards = {};
    [
      ['speed', -30],
      ['wins', 0],
      ['rebirths', 30],
    ].forEach(([stat, z]) => {
      const lb = new Leaderboard(stat);
      lb.root.position.set(153, 1.2, z);
      lb.root.rotation.y = -Math.PI / 2;
      this.scene.add(lb.root);
      this.collision.addBox(153, z, 9, 27);
      this.leaderboards[stat] = lb;
    });
  }

  setLeaderboards(data) {
    for (const [stat, lb] of Object.entries(this.leaderboards)) lb.setRows(data?.[stat] || []);
  }

  update(dt, camera, profile, now) {
    this.sky.update(dt, camera.position);
    for (const t of this.treadmills) {
      t.update(dt);
      t.refreshLock(profile);
    }
    this.chest.update(dt, profile, now);
    this.merchant.update(dt);
    this.worldGate.update(dt);
    this.stageGate.update(dt, now, camera);
    this.course.update(dt, now, camera);
  }
}
