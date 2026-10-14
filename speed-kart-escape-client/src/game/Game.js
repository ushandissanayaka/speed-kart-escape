// Engine bootstrap: renderer, main loop, local kart, remote players, zone interactions.
// The React HUD talks to the game only through `game.events` and the public methods.

import * as THREE from 'three';
import { StartingPlace } from './scenes/StartingPlace.js';
import { Racer } from './entities/Racer.js';
import { Confetti } from './entities/Confetti.js';
import { KartController } from './systems/KartController.js';
import { CameraRig } from './systems/CameraRig.js';
import { Input } from './systems/Input.js';
import { setMaxAnisotropy } from './util/textures.js';
import { loadFonts } from './util/text.js';
import { renderKartThumbs } from './util/kartThumbs.js';
import { sfx } from './audio/Sfx.js';
import { Emitter, openSession } from '../net/Session.js';
import * as legion from '../bloxity/legion.js';
import {
  STAGE_COIN_COOLDOWN_MS,
  TREADMILLS,
  TUNING,
  WORLD,
  activeEvent,
  chestReady,
  formatClock,
  kartSpeedFor,
  merchantStatus,
  newProfile,
  stageAt,
  stageDef,
  stageHW,
  stagePads,
  stageRespawn,
} from '../shared/gameData.js';

const DEATH_WAIT_MS = 5000;
const SHIELD_MS = 3000;

const MOVE_SEND_MS = 100;

export class Game {
  constructor(container) {
    this.container = container;
    this.events = new Emitter();
    this.profile = newProfile();
    this.playtime = { start: Date.now(), claimed: new Set() };
    this.stage = 0;
    this.dead = null;
    this.shieldUntil = 0;
    this.eventId = undefined;
    this.merchantHere = undefined;
    this.serverOffset = 0;
    this.remotes = new Map();
    this.zones = {};
    this.running = false;
    this.lastSend = 0;
    this.clock = new THREE.Clock();
  }

  now() {
    return Date.now() + this.serverOffset;
  }

  // Reports loading progress to Bloxity's loading screen and to our own.
  step(text, progress) {
    legion.loadingStep(text);
    this.events.emit('loading', { text, progress });
  }

  async start() {
    legion.initLegion();
    this.step('Loading fonts…', 0.08);
    await loadFonts();

    this.step('Building the starting place…', 0.25);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';
    setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, this.container.clientWidth / this.container.clientHeight, 0.5, 6000);
    this.world = new StartingPlace(this.scene);
    this.input = new Input();
    this.rig = new CameraRig(this.camera, renderer.domElement);
    this.rig.bounds = { minX: -193, maxX: 193, minZ: -5640, maxZ: 54.5 };
    this.controller = new KartController(this.world.collision);
    this.confetti = new Confetti(this.scene);

    // Local player
    this.step('Signing in…', 0.6);
    await legion.waitForUser();
    const identity = legion.currentIdentity();
    this.identity = identity;
    // Logging in or out mid-game switches profiles: restart cleanly.
    this.offUser = legion.onUserChanged((user) => {
      if (!!user === identity.isGuest && this.running) window.location.reload();
    });
    this.player = new Racer(this.scene, { kart: 'noob' });
    this.respawn();

    this.step('Loading your avatar…', 0.7);
    await this.player.loadAvatar(legion.getAvatarData()).catch(() => {});

    try {
      this.kartThumbs = renderKartThumbs();
    } catch {
      this.kartThumbs = {};
    }

    this.step('Connecting…', 0.85);
    this.session = await openSession(identity);
    this.bindSession();
    this.session.setAvatar(JSON.stringify(legion.getAvatarData()));
    this.offAvatar = legion.onAvatarChanged(() => {
      const data = legion.getAvatarData();
      this.player.loadAvatar(data);
      this.session.setAvatar(JSON.stringify(data));
    });
    this.offPlayerEvents = legion.onPlayerEvent((event, data) => {
      if (event === 'respawn_request') this.respawn();
      if (event === 'pointer_lock_changed') this.input.enabled = !data;
    });

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.onVisibility = () => (document.hidden ? legion.gameplayEnd() : legion.gameplayStart());
    document.addEventListener('visibilitychange', this.onVisibility);

    // Warm up behind the loading screen: compile every shader and upload every
    // texture now, including things that are hidden or off-screen (later stages,
    // signs, confetti, effects). Otherwise the browser prepares them the first time
    // they appear, which froze the game for a moment (e.g. on entering Stage 1).
    const restore = [];
    this.scene.traverse((o) => {
      if (!o.visible) {
        restore.push([o, 'visible', false]);
        o.visible = true;
      }
      if (o.frustumCulled) {
        restore.push([o, 'frustumCulled', true]);
        o.frustumCulled = false;
      }
    });
    renderer.compile(this.scene, this.camera);
    renderer.render(this.scene, this.camera);
    for (const [o, key, value] of restore) o[key] = value;
    legion.loadingEnd();
    legion.gameplayStart();
    this.running = true;
    if (import.meta.env.DEV) window.__game = this;
    this.events.emit('ready', { online: this.session.online, identity });
    renderer.setAnimationLoop(() => this.frame());
  }

  bindSession() {
    const s = this.session;
    s.on('profile', ({ profile, serverNow, playtime }) => {
      this.profile = profile;
      if (playtime) this.playtime = { start: playtime.start, claimed: new Set(playtime.claimed) };
      if (serverNow) this.serverOffset = serverNow - Date.now();
      this.player.setKart(profile.kart);
      this.player.setTrail(profile.trail);
      this.events.emit('profile', profile);
    });
    s.on('gain', (g) => {
      sfx.pop();
      const p = this.screenPoint(this.player.root.position, 8);
      this.events.emit('gain', { ...g, x: p.x, y: p.y });
    });
    s.on('event', (e) => {
      if (e.type === 'levelUp') {
        sfx.levelUp();
        this.events.emit('levelPopup', { level: e.level, from: kartSpeedFor(e.level - 1), to: kartSpeedFor(e.level) });
      }
    });
    s.on('toast', (t) => this.events.emit('toast', t));
    s.on('stageResult', (r) => this.onStageResult(r));
    s.on('actionResult', (r) => {
      if (r.ok) {
        if (r.toast) {
          sfx.reward();
          this.events.emit('toast', { text: r.toast, kind: 'good' });
        }
      } else if (r.error) {
        sfx.error();
        this.events.emit('toast', { text: r.error, kind: 'bad' });
      }
    });
    s.on('leaderboards', (d) => this.world.setLeaderboards(d));
    s.on('treadmillLocked', (m) => {
      this.zoneToast(`lock-${m.id}`, m.message);
      // Pass-locked treadmills open the Gems purchase prompt, like the reference.
      const def = TREADMILLS.find((t) => t.id === m.id);
      const key = `buy-${m.id}`;
      if (def?.requires?.sku && !this.purchasing && (this.zones[key] || 0) < performance.now()) {
        this.zones[key] = performance.now() + 15000;
        this.purchasing = true;
        this.purchase(def.requires.sku).finally(() => (this.purchasing = false));
      }
    });
    s.on('status', (st) => this.events.emit('status', st));
    s.on('playerAdd', ({ id, p }) => this.addRemote(id, p));
    s.on('playerChange', ({ id, p }) => this.updateRemote(id, p));
    s.on('playerRemove', ({ id }) => this.removeRemote(id));
  }

  // --- remote players ------------------------------------------------------

  addRemote(id, p) {
    if (this.remotes.has(id)) return;
    const racer = new Racer(this.scene, { name: p.name, showName: true, kart: p.kart, trail: p.trail });
    racer.root.position.set(p.x, 0, p.z);
    racer.root.rotation.y = p.ry;
    const r = { racer, x: p.x, z: p.z, ry: p.ry, v: p.v, avatarJson: '' };
    this.remotes.set(id, r);
    this.updateRemote(id, p);
  }

  updateRemote(id, p) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.x = p.x;
    r.z = p.z;
    r.ry = p.ry;
    r.v = p.v;
    r.racer.setKart(p.kart);
    r.racer.setTrail(p.trail);
    if (p.avatar && p.avatar !== r.avatarJson) {
      r.avatarJson = p.avatar;
      try {
        const a = JSON.parse(p.avatar);
        // Another player's private skin URL may not be reachable; rebuild from ids.
        r.racer.loadAvatar({ equipped: a.equipped, proportions: a.proportions });
      } catch {
        /* ignore */
      }
    }
  }

  removeRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.racer.dispose();
    this.remotes.delete(id);
  }

  // --- public API for the HUD ---------------------------------------------

  action(a) {
    sfx.click();
    this.session?.action(a);
  }

  // Opens the Legion-style purchase popup; resolves with the purchase result.
  purchase(sku) {
    sfx.click();
    return new Promise((resolve) => this.events.emit('purchasePrompt', { sku, resolve }));
  }

  // Called by the popup's Buy button: hands the purchase to the Bloxity SDK.
  async confirmPurchase(sku) {
    const res = await legion.requestPurchase(sku, this.identity?._id);
    if (res?.success) {
      this.events.emit('toast', { text: 'Purchase complete!', kind: 'good' });
      this.session?.sync();
    } else if (res?.error && res.error !== 'User cancelled') {
      this.events.emit('toast', { text: res.error, kind: 'bad' });
    }
    return res;
  }

  // Thumbstick, screen space (x right, y down), -1..1
  setJump(on) {
    this.input.jumpPressed = on;
  }

  setStick(x, y, active) {
    this.input.setStick(x, y, active);
  }

  orbitCamera(dx, dy) {
    this.rig.orbit(dx, dy);
  }

  zoomCamera(factor) {
    this.rig.zoom(factor);
  }

  respawn() {
    this.dead = null;
    this.events.emit('deathEnd');
    this.teleport(WORLD.spawn);
    this.stage = 0;
  }

  teleport({ x, z, ry = Math.PI }) {
    this.controller.place(x, z, ry);
    this.player.root.position.set(x, this.controller.y, z);
    this.player.root.rotation.y = ry;
    this.rig.snap(this.player.root.position, ry);
    this.session?.sendMove(x, z, ry, 0);
    this.lastSend = performance.now();
  }

  // --- stages --------------------------------------------------------------

  die(cause) {
    if (this.dead) return;
    sfx.dead();
    // Dying in any stage sends you all the way back to the starting place.
    const toSpawn = true;
    this.dead = { until: performance.now() + DEATH_WAIT_MS, stage: Math.max(1, this.stage), cause, toSpawn };
    if (cause === 'pit') this.fall = { y: 0, v: 0 }; // drop down into the lava
    this.controller.v = 0;
    this.events.emit('death', { ms: DEATH_WAIT_MS, until: this.dead.until, toSpawn });
  }

  // Countdown ended (or "Respawn now"): back to the start of the current stage.
  finishDeath() {
    if (!this.dead) return;
    const n = this.dead.stage;
    const toSpawn = this.dead.toSpawn;
    this.dead = null;
    this.events.emit('deathEnd');
    if (toSpawn) {
      this.respawn();
      return;
    }
    this.teleport(stageRespawn(n));
    this.shieldUntil = performance.now() + SHIELD_MS;
  }

  // Paid revive: keep going from where you are, protected by the shield.
  async reviveHere() {
    if (!this.dead) return;
    const res = await this.purchase('revive');
    if (res?.success && this.dead) {
      this.dead = null;
      this.events.emit('deathEnd');
      this.shieldUntil = performance.now() + SHIELD_MS * 1.5;
    }
  }

  stageAction(a) {
    this.session?.stage(a);
  }

  async onStageResult(r) {
    if (r.type === 'collectCoin') {
      if (r.ok && r.coins) {
        const p = this.screenPoint(this.player.root.position, 8);
        this.events.emit('gain', { amount: r.coins, kind: 'coin', x: p.x, y: p.y });
      }
      return;
    }
    if (r.type === 'useSkip' && r.error === 'NEED_SKIP') {
      const res = await this.purchase('skip_stage');
      if (res?.success) setTimeout(() => this.stageAction({ type: 'useSkip', stage: this.stage }), 400);
      return;
    }
    if (!r.ok) {
      if (r.error) this.events.emit('toast', { text: r.error, kind: 'bad' });
      return;
    }
    if (r.teleport === 'spawn') (this.bigFinish ? sfx.victory() : sfx.trophy());
    else sfx.reward();
    if (r.toast) this.events.emit('toast', { text: r.toast, kind: 'good' });
    if (r.teleport === 'spawn') {
      // Trophy + confetti burst, then back to the starting place.
      const final = this.bigFinish;
      this.bigFinish = false;
      this.events.emit('win', { text: r.toast, final });
      if (final) {
        // the final stage: wave after wave of big confetti
        for (const ms of [0, 400, 800, 1200, 1700, 2300, 3000]) setTimeout(() => this.confetti?.burst(this.player.root.position, 600, 2.2), ms);
      } else this.confetti?.burst(this.player.root.position, 260);
      this.controller.v = 0;
      this.celebrating = true;
      setTimeout(() => {
        this.celebrating = false;
        this.respawn();
      }, final ? 5200 : 2400);
    } else if (r.teleport) {
      this.teleport(r.teleport);
      this.shieldUntil = performance.now() + SHIELD_MS;
    }
  }

  updateStages(now) {
    const c = this.controller;
    const s = stageAt(c.z);
    if (s > this.stage) this.events.emit('stage', { name: `Stage ${s}` });
    if (s !== this.stage) this.stage = s;

    // Final stage: crossing the finish line wins it (big confetti, then back to the start)
    const def = s > 0 ? stageDef(s) : null;
    if (def?.finishD && !this.dead && !this.celebrating && !this.finishSent && c.z <= def.startZ - def.finishD) {
      this.finishSent = true;
      this.bigFinish = true;
      this.stageAction({ type: 'stageWin', stage: s });
      setTimeout(() => (this.finishSent = false), 3000);
    }

    // Hazards (skipped while dead or shielded)
    const shielded = performance.now() < (this.shieldUntil || 0);
    this.player.setShield(shielded);
    if (this.dead) {
      if (performance.now() >= this.dead.until) this.finishDeath();
    } else if (s > 0 && !shielded) {
      const hit = this.world.course.hazardAt(c.x, c.z, this.world.collision.heightAt(c.x, c.z), now, c.jumpY);
      if (hit) this.die(hit);
    }

    // Coins
    for (const coin of this.world.course.coins) {
      if (now < coin.hiddenUntil || coin.def.stage !== s) continue;
      if (Math.hypot(c.x - coin.def.x, c.z - coin.def.z) < 8.5) {
        coin.hiddenUntil = now + STAGE_COIN_COOLDOWN_MS;
        sfx.coin();
        this.stageAction({ type: 'collectCoin', id: coin.def.id });
      }
    }

    // Pads in front of the gate at the end of this stage
    if (s > 0 && !this.dead) {
      const pads = stagePads(s);
      const inPad = (pt) => Math.hypot(c.x - pt.x, c.z - pt.z) <= pt.r;
      this.enterZone(`wins-${s}`, inPad(pads.wins), () => this.stageAction({ type: 'stageWin', stage: s }));
      this.enterZone(`skip-${s}`, inPad(pads.skip), () => this.stageAction({ type: 'useSkip', stage: s }));
      this.enterZone(`safe-${s}`, inPad(pads.safe), () => this.stageAction({ type: 'openSafe', stage: s }));
    }

    // Keep the camera inside the narrow stage walls
    const b = this.rig.bounds;
    const hw = c.z < -130 ? stageHW(Math.max(1, s)) + 2 : 193;
    b.minX = -hw;
    b.maxX = hw;
  }

  // Global events + merchant arrival notices
  updateNotices(now) {
    const e = activeEvent(now);
    const id = e?.id || null;
    if (id !== this.eventId) {
      if (id) this.events.emit('notice', { kind: id, title: e.title, desc: e.desc });
      this.eventId = id;
    }
    const m = merchantStatus(now);
    if (m.present && this.merchantHere === false) {
      this.events.emit('notice', { kind: 'merchant', title: 'THE MERCHANT HAS ARRIVED', desc: `Leaves in ${formatClock(m.msLeft)}` });
    }
    this.merchantHere = m.present;
  }

  // Ground slope under a kart at (x, z) facing ry: pitch along the heading, roll
  // across it. Sudden steps (road edges, cliffs) are ignored, only real slopes count.
  groundTilt(x, z, ry) {
    const col = this.world.collision;
    const L = 3.5;
    const W = 2.6;
    const hx = Math.sin(ry);
    const hz = Math.cos(ry);
    const df = col.heightAt(x + hx * L, z + hz * L) - col.heightAt(x - hx * L, z - hz * L);
    const ds = col.heightAt(x + hz * W, z - hx * W) - col.heightAt(x - hz * W, z + hx * W);
    const lim = 0.55; // ~31 degrees
    const pitch = Math.abs(df) > 2 * L * 0.9 ? 0 : Math.max(-lim, Math.min(lim, Math.atan2(df, 2 * L)));
    const roll = Math.abs(ds) > 2 * W * 0.9 ? 0 : Math.max(-lim, Math.min(lim, Math.atan2(ds, 2 * W)));
    return { pitch, roll };
  }

  // --- loop ----------------------------------------------------------------

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = this.now();
    const p = this.profile;

    this.controller.setStats(p.speed, p.kart, p.customSpeed, p.level);
    const input = this.dead || this.celebrating ? { x: 0, y: 0 } : this.input.read();
    this.controller.update(dt, input, this.rig.forward(), input.jump);
    const c = this.controller;
    if (this.fall) {
      if (this.dead) {
        this.fall.v += 70 * dt;
        this.fall.y = Math.min(32, this.fall.y + this.fall.v * dt);
      } else this.fall = null;
    }
    this.player.root.position.set(c.x, c.y + c.jumpY - (this.fall?.y || 0), c.z);
    // Lean the kart with the ground: nose up/down along hills, tilt across side slopes
    const tilt = this.groundTilt(c.x, c.z, c.ry);
    const tk = Math.min(1, dt * 10);
    this.tiltP = (this.tiltP || 0) + (tilt.pitch - (this.tiltP || 0)) * tk;
    this.tiltR = (this.tiltR || 0) + (tilt.roll - (this.tiltR || 0)) * tk;
    this.player.root.rotation.set(-this.tiltP, c.ry, this.tiltR, 'YXZ');
    this.player.root.updateMatrixWorld();
    // The sun's shadow area follows the player, so shadows show in every stage
    // (same shadow map size; snapped to half units so the shadows don't shimmer).
    const sun = this.world.sun;
    if (sun) {
      const sx = Math.round(c.x * 2) / 2;
      const sz = Math.round(c.z * 2) / 2;
      sun.target.position.set(sx, c.y, sz - 30);
      sun.position.set(sx - 120, c.y + 260, sz + 140); // same angle as before
      sun.target.updateMatrixWorld();
    }
    this.player.animate(dt, c.v, c.steer, c.accel, c.topSpeed, c.jumpY > 0.4);

    for (const r of this.remotes.values()) {
      const root = r.racer.root;
      const k = Math.min(1, dt * 10);
      const prevX = root.position.x;
      const prevZ = root.position.z;
      root.position.x += (r.x - root.position.x) * k;
      root.position.z += (r.z - root.position.z) * k;
      root.position.y += (this.world.collision.heightAt(root.position.x, root.position.z) - root.position.y) * k;
      let d = r.ry - root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      root.rotation.y += d * k;
      const rt = this.groundTilt(root.position.x, root.position.z, root.rotation.y);
      root.rotation.order = 'YXZ';
      root.rotation.x += (-rt.pitch - root.rotation.x) * k;
      root.rotation.z += (rt.roll - root.rotation.z) * k;
      root.updateMatrixWorld();
      const moved = Math.hypot(root.position.x - prevX, root.position.z - prevZ) / Math.max(dt, 1e-3);
      r.racer.animate(dt, Math.sign(r.v || 1) * moved, Math.max(-1, Math.min(1, d * 3)), 0, 60);
    }

    this.rig.update(dt, this.player.root.position, c.v);
    this.world.update(dt, this.camera, p, now);
    this.confetti.update(dt);
    this.handleZones(now);
    this.updateStages(now);
    this.updateNotices(now);
    sfx.updateEngine(Math.min(1, Math.abs(c.v) / Math.max(c.topSpeed, 1)), c.driving);

    if (performance.now() - this.lastSend > MOVE_SEND_MS) {
      this.lastSend = performance.now();
      this.session?.sendMove(c.x, c.z, c.ry, c.v);
    }

    this.renderer.render(this.scene, this.camera);
  }

  handleZones(now) {
    const { x, z } = this.controller;
    const inCircle = (zc, pad = 0) => Math.hypot(x - zc.x, z - zc.z) <= zc.radius + pad;

    // Rewards chest — auto-collect when ready
    this.enterZone('chest', inCircle(WORLD.chest, 6), () => {
      if (chestReady(this.profile, now)) this.action({ type: 'claimChest' });
      else this.events.emit('toast', { text: `Rewards ready in ${formatClock(TUNING.chestCooldownMs - (now - this.profile.lastChestAt))}` });
    });
    // Merchant pad — opens the potion shop
    this.enterZone('merchant', inCircle(WORLD.merchantPad), () => this.events.emit('openPanel', 'merchant'));
    // Gold shop pad — opens the Coins & Wins packs
    const yp = WORLD.yellowPad;
    this.enterZone('shopPad', Math.abs(x - yp.x) < yp.w / 2 + 1 && Math.abs(z - yp.z) < yp.d / 2 + 1, () => {
      sfx.reward();
      this.events.emit('openPanel', 'currency');
    });
    // World 2 arch
    this.enterZone('world2', inCircle(WORLD.world2Gate, 2), () => {
      const msg =
        this.profile.rebirths >= TUNING.world2Rebirths ? 'World 2 is coming soon!' : `World 2 requires ${TUNING.world2Rebirths} Rebirths`;
      this.events.emit('toast', { text: msg });
    });
  }

  enterZone(key, inside, onEnter) {
    const was = this.zones[key];
    this.zones[key] = inside;
    if (inside && !was) onEnter();
  }

  zoneToast(key, text) {
    const t = performance.now();
    if ((this.zones[`toast-${key}`] || 0) > t) return;
    this.zones[`toast-${key}`] = t + 4000;
    this.events.emit('toast', { text });
  }

  screenPoint(pos, lift = 0) {
    const v = new THREE.Vector3(pos.x, pos.y + lift, pos.z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.container.clientWidth, y: (-v.y * 0.5 + 0.5) * this.container.clientHeight };
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    this.running = false;
    this.renderer?.setAnimationLoop(null);
    this.session?.close();
    this.input?.dispose();
    this.rig?.dispose();
    this.offAvatar?.();
    this.offPlayerEvents?.();
    this.offUser?.();
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    legion.gameplayEnd();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
