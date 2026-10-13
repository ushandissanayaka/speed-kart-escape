// Game session: OnlineSession talks to the Colyseus server (authoritative);
// OfflineSession runs the same shared reducers locally so the game is always playable.

import { Client } from 'colyseus.js';
import {
  ROOM_NAME,
  WORLD,
  applyAction,
  applyDrive,
  applyTreadmillSecond,
  mergeLeaderboard,
  refreshDaily,
  canUseTreadmill,
  normalizeProfile,
  publicSummary,
  treadmillAt,
  treadmillLockText,
} from '../shared/gameData.js';
import * as legion from '../bloxity/legion.js';

const HTTP = import.meta.env.VITE_SERVER_HTTP || 'http://localhost:2567';
const WS = import.meta.env.VITE_SERVER_WS || 'ws://localhost:2567';
const HOSTED = import.meta.env.VITE_BLOXITY_HOSTED === 'true';

export class Emitter {
  constructor() {
    this.handlers = new Map();
  }
  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }
  emit(type, data) {
    this.handlers.get(type)?.forEach((fn) => fn(data));
  }
}

// --------------------------------------------------------------------------
export class OnlineSession extends Emitter {
  constructor() {
    super();
    this.online = true;
    this.room = null;
    this.closed = false;
    this.identity = null;
    this.joinOptions = null;
  }

  async connect(identity) {
    this.identity = identity;
    let sessionToken = null;
    if (!identity.isGuest) {
      const res = await legion.authenticateWithServer(`${HTTP}/api/legion-auth`);
      sessionToken = res?.sessionToken || null;
      if (!sessionToken) console.warn('[net] Bloxity handshake failed — joining as guest');
    }
    this.joinOptions = { sessionToken, guestName: identity.displayName || identity.username };
    await this.join();
  }

  async endpoint() {
    if (!HOSTED) return WS;
    const { endpoint, cold } = await legion.resolveEndpoint();
    if (cold) this.emit('toast', { text: 'Waking up a server…' });
    return endpoint;
  }

  async join() {
    const client = new Client(await this.endpoint());
    const room = await client.joinOrCreate(ROOM_NAME, this.joinOptions);
    if (this.closed) {
      room.leave();
      return;
    }
    this.room = room;
    legion.updateRoom(room.roomId);

    room.onMessage('profile', (m) => this.emit('profile', { profile: normalizeProfile(m.profile), serverNow: m.serverNow, playtime: m.playtime }));
    room.onMessage('gain', (m) => this.emit('gain', m));
    room.onMessage('event', (m) => this.emit('event', m));
    room.onMessage('toast', (m) => this.emit('toast', m));
    room.onMessage('actionResult', (m) => this.emit('actionResult', m));
    room.onMessage('leaderboards', (m) => this.emit('leaderboards', m));
    room.onMessage('treadmillLocked', (m) => this.emit('treadmillLocked', m));

    const players = room.state.players;
    players.onAdd((p, id) => {
      if (id === room.sessionId) return;
      this.emit('playerAdd', { id, p });
      p.onChange(() => this.emit('playerChange', { id, p }));
    });
    players.onRemove((_p, id) => this.emit('playerRemove', { id }));

    room.onLeave((code) => {
      this.emit('status', { online: false });
      if (this.closed || code === 4001) {
        if (code === 4001) this.emit('toast', { text: 'You joined from another tab' });
        return;
      }
      this.reconnect();
    });
    this.emit('status', { online: true });
  }

  async reconnect() {
    for (let attempt = 0; attempt < 8 && !this.closed; attempt++) {
      await new Promise((r) => setTimeout(r, Math.min(15000, 1000 * 2 ** attempt)));
      try {
        await this.join();
        this.emit('toast', { text: 'Reconnected!' });
        return;
      } catch {
        /* keep trying */
      }
    }
  }

  sendMove(x, z, ry, v) {
    this.room?.connection?.isOpen && this.room.send('move', { x, z, ry, v });
  }
  action(a) {
    this.room?.send('action', a);
  }
  setAvatar(json) {
    this.room?.send('avatar', { json });
  }
  sync() {
    this.room?.send('sync');
  }
  close() {
    this.closed = true;
    this.room?.leave();
    legion.updateRoom('');
  }
}

// --------------------------------------------------------------------------
const STORAGE_KEY = 'ske_offline_profile_v1';

export class OfflineSession extends Emitter {
  constructor() {
    super();
    this.online = false;
    this.pos = { x: WORLD.spawn.x, z: WORLD.spawn.z };
    this.prev = null;
    this.timer = null;
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      saved = null;
    }
    this.profile = normalizeProfile(saved);
    refreshDaily(this.profile);
    this.playtime = { start: Date.now(), claimed: new Set() };
  }

  async connect(identity) {
    this.identity = identity;
    this.timer = setInterval(() => this.tickSecond(), 1000);
    queueMicrotask(() => {
      this.emit('status', { online: false });
      this.pushProfile();
      this.pushLeaderboards();
    });
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    } catch {
      /* storage unavailable */
    }
  }

  pushProfile() {
    this.emit('profile', { profile: this.profile, serverNow: Date.now(), playtime: { start: this.playtime.start, claimed: [...this.playtime.claimed] } });
    this.save();
  }

  pushLeaderboards() {
    const me = { name: this.identity?.displayName || 'You', value: 0, avatar: null };
    const s = publicSummary(this.profile);
    const row = (k) => (s[k] > 0 ? [{ ...me, value: s[k] }] : []);
    this.emit('leaderboards', { speed: mergeLeaderboard('speed', row('speed')), wins: mergeLeaderboard('wins', row('wins')), rebirths: mergeLeaderboard('rebirths', row('rebirths')) });
  }

  sendMove(x, z) {
    const next = { x, z };
    if (this.prev) {
      const dist = Math.min(Math.hypot(x - this.prev.x, z - this.prev.z), 30);
      const { gained, events } = applyDrive(this.profile, dist, Date.now());
      if (gained > 0) {
        this.emit('gain', { amount: gained, source: 'drive' });
        events.forEach((e) => this.emit('event', e));
        this.dirty = true;
      }
    }
    this.prev = next;
    this.pos = next;
  }

  tickSecond() {
    const t = treadmillAt(this.pos.x, this.pos.z);
    if (t) {
      if (!canUseTreadmill(this.profile, t)) this.emit('treadmillLocked', { id: t.id, message: treadmillLockText(t) });
      else {
        const { gained, events } = applyTreadmillSecond(this.profile, t, Date.now());
        this.emit('gain', { amount: gained, source: 'treadmill', id: t.id });
        events.forEach((e) => this.emit('event', e));
        this.dirty = true;
      }
    }
    if (this.dirty) {
      this.dirty = false;
      this.pushProfile();
      this.pushLeaderboards();
    }
  }

  action(a) {
    if (a.type === 'claimChest') {
      const c = WORLD.chest;
      if (Math.hypot(this.pos.x - c.x, this.pos.z - c.z) > c.radius + 6) {
        this.emit('actionResult', { type: a.type, ok: false, error: 'Drive to the Rewards chest first' });
        return;
      }
    }
    const res = applyAction(this.profile, a, Date.now(), this.playtime);
    this.emit('actionResult', { type: a.type, ...res });
    if (res.ok) {
      this.pushProfile();
      this.pushLeaderboards();
    }
  }

  setAvatar() {}
  sync() {
    this.pushProfile();
  }
  close() {
    clearInterval(this.timer);
    this.save();
  }
}

// Try the server first; fall back to offline play if it is unreachable.
export async function openSession(identity) {
  const online = new OnlineSession();
  try {
    await Promise.race([online.connect(identity), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), HOSTED ? 60000 : 6000))]);
    return online;
  } catch (err) {
    console.warn('[net] server unavailable, playing offline:', err?.message || err);
    online.close();
    const offline = new OfflineSession();
    await offline.connect(identity);
    return offline;
  }
}
