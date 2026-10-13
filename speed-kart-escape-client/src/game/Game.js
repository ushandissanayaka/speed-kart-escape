// Engine bootstrap: renderer, main loop, local kart, remote players, zone interactions.
// The React HUD talks to the game only through `game.events` and the public methods.

import * as THREE from 'three';
import { StartingPlace } from './scenes/StartingPlace.js';
import { Racer } from './entities/Racer.js';
import { KartController } from './systems/KartController.js';
import { CameraRig } from './systems/CameraRig.js';
import { Input } from './systems/Input.js';
import { setMaxAnisotropy } from './util/textures.js';
import { loadFonts } from './util/text.js';
import { renderKartThumbs } from './util/kartThumbs.js';
import { sfx } from './audio/Sfx.js';
import { Emitter, openSession } from '../net/Session.js';
import * as legion from '../bloxity/legion.js';
import { TREADMILLS, TUNING, WORLD, chestReady, formatClock, newProfile } from '../shared/gameData.js';

const MOVE_SEND_MS = 100;

export class Game {
  constructor(container) {
    this.container = container;
    this.events = new Emitter();
    this.profile = newProfile();
    this.playtime = { start: Date.now(), claimed: new Set() };
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

  async start() {
    legion.initLegion();
    legion.loadingStep('Loading fonts…');
    await loadFonts();

    legion.loadingStep('Building the starting place…');
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
    this.rig.bounds = { minX: -193, maxX: 193, minZ: -240, maxZ: 54.5 };
    this.controller = new KartController(this.world.collision);

    // Local player
    legion.loadingStep('Signing in…');
    await legion.waitForUser();
    const identity = legion.currentIdentity();
    this.identity = identity;
    // Logging in or out mid-game switches profiles: restart cleanly.
    this.offUser = legion.onUserChanged((user) => {
      if (!!user === identity.isGuest && this.running) window.location.reload();
    });
    this.player = new Racer(this.scene, { kart: 'noob' });
    this.respawn();

    legion.loadingStep('Loading your avatar…');
    await this.player.loadAvatar(legion.getAvatarData()).catch(() => {});

    try {
      this.kartThumbs = renderKartThumbs();
    } catch {
      this.kartThumbs = {};
    }

    legion.loadingStep('Connecting…');
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

    // Warm up: render once so shaders compile before the loading screen drops.
    renderer.compile(this.scene, this.camera);
    renderer.render(this.scene, this.camera);
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
        this.events.emit('toast', { text: `Level Up! You are now Level ${e.level}`, kind: 'level' });
      }
    });
    s.on('toast', (t) => this.events.emit('toast', t));
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

  async purchase(sku) {
    sfx.click();
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
    const s = WORLD.spawn;
    this.controller.place(s.x, s.z, s.ry);
    this.player.root.position.set(s.x, this.controller.y, s.z);
    this.player.root.rotation.y = s.ry;
    this.rig.snap(this.player.root.position, s.ry);
  }

  // --- loop ----------------------------------------------------------------

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = this.now();
    const p = this.profile;

    this.controller.setStats(p.speed, p.kart, p.customSpeed);
    const input = this.input.read();
    this.controller.update(dt, input, this.rig.forward());
    const c = this.controller;
    this.player.root.position.set(c.x, c.y, c.z);
    this.player.root.rotation.y = c.ry;
    this.player.root.updateMatrixWorld();
    this.player.animate(dt, c.v, c.steer, c.accel, c.topSpeed);

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
      root.updateMatrixWorld();
      const moved = Math.hypot(root.position.x - prevX, root.position.z - prevZ) / Math.max(dt, 1e-3);
      r.racer.animate(dt, Math.sign(r.v || 1) * moved, Math.max(-1, Math.min(1, d * 3)), 0, 60);
    }

    this.rig.update(dt, this.player.root.position, c.v);
    this.world.update(dt, this.camera, p, now);
    this.handleZones(now);
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
    // World 2 arch
    this.enterZone('world2', inCircle(WORLD.world2Gate, 2), () => {
      const msg =
        this.profile.rebirths >= TUNING.world2Rebirths ? 'World 2 is coming soon!' : `World 2 requires ${TUNING.world2Rebirths} Rebirths`;
      this.events.emit('toast', { text: msg });
    });
    // Stage 1 gate
    const st = WORLD.stageTrigger;
    const inStage = x >= st.minX && x <= st.maxX && z >= st.minZ && z <= st.maxZ;
    this.enterZone('stage', inStage, () => {
      this.events.emit('stage', { name: 'Stage 1' });
      this.events.emit('toast', { text: 'Stage 1 is coming soon — keep training your Speed!' });
      setTimeout(() => this.respawn(), 1400);
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
