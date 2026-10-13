import { Room } from '@colyseus/core';
import { StartingPlaceState, PlayerState } from './schema.js';
import { readSession } from '../auth/legionAuth.js';
import { getRecord, scheduleSave, computeLeaderboards } from '../game/profiles.js';
import { clampToBounds, driveGain, isJump, runAction, treadmillTick, validatedDistance } from '../game/economy.js';
import { WORLD, allowedTeleport, applyStageAction, newProfile, newRun, publicSummary, refreshDaily, trackStage } from '../shared/gameData.js';

const LEADERBOARD_INTERVAL_MS = 15_000;
const MAX_AVATAR_JSON = 4000;

// legionId -> { room, client } so webhook purchases can reach an online player.
const online = new Map();

export function notifyProfileChanged(legionId, toast) {
  const entry = online.get(legionId);
  if (entry) entry.room.pushProfile(entry.client, toast);
}

export function onlineLegionRecords() {
  const out = [];
  for (const [legionId, { client }] of online) out.push({ legionId, profile: client.userData.record.profile });
  return out;
}

const cleanName = (s) => String(s || '').replace(/[^\w .-]/g, '').trim().slice(0, 20) || 'Guest';

export class StartingPlaceRoom extends Room {
  maxClients = 24;

  onCreate() {
    this.setState(new StartingPlaceState());
    this.setPatchRate(50);

    this.onMessage('move', (client, m) => this.handleMove(client, m));
    this.onMessage('action', (client, m) => this.handleAction(client, m));
    this.onMessage('avatar', (client, m) => this.handleAvatar(client, m));
    this.onMessage('stage', (client, m) => this.handleStage(client, m));
    this.onMessage('sync', (client) => this.pushProfile(client));

    this.clock.setInterval(() => this.tickSecond(), 1000);
    this.clock.setInterval(() => this.broadcastLeaderboards(), LEADERBOARD_INTERVAL_MS);
  }

  onAuth(client, options) {
    const session = readSession(options?.sessionToken);
    if (session) return { legionId: session.legionId, name: session.displayName || session.username, isGuest: false };
    return { legionId: null, name: cleanName(options?.guestName), isGuest: true };
  }

  onJoin(client, options, auth) {
    // Kick an older connection of the same account so a profile is only driven from one place.
    if (auth.legionId && online.has(auth.legionId)) {
      const prev = online.get(auth.legionId);
      prev.client.leave(4001, 'Joined from another tab');
    }

    const record = auth.isGuest ? { name: auth.name, avatar: null, profile: newProfile() } : getRecord(auth.legionId, auth.name);
    client.userData = { auth, record, pos: null, lastMoveAt: 0, dirty: false, playtime: { start: Date.now(), claimed: new Set() }, run: newRun() };
    refreshDaily(record.profile);
    if (auth.legionId) online.set(auth.legionId, { room: this, client });

    const ps = new PlayerState();
    ps.name = auth.name;
    ps.isGuest = auth.isGuest;
    ps.x = WORLD.spawn.x;
    ps.z = WORLD.spawn.z;
    ps.ry = WORLD.spawn.ry;
    ps.kart = record.profile.kart;
    ps.trail = record.profile.trail;
    ps.speed = record.profile.speed;
    this.state.players.set(client.sessionId, ps);

    this.pushProfile(client);
    client.send('leaderboards', this.leaderboards());
  }

  onLeave(client) {
    const ud = client.userData;
    this.state.players.delete(client.sessionId);
    if (ud?.auth.legionId) {
      if (online.get(ud.auth.legionId)?.client === client) online.delete(ud.auth.legionId);
      scheduleSave();
    }
  }

  // --- messages -----------------------------------------------------------

  handleMove(client, m) {
    const ud = client.userData;
    const ps = this.state.players.get(client.sessionId);
    if (!ud || !ps || typeof m !== 'object') return;
    const x = Number(m.x);
    const z = Number(m.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const now = Date.now();
    const next = clampToBounds(x, z);
    const jumped = isJump(ud.record.profile, ud.pos, next, now - ud.lastMoveAt);
    // Teleports are only legal to the spawn or a reached stage start; anything else
    // (a cheat or a very long lag spike) forfeits the current stage run.
    if (jumped && ud.pos && !allowedTeleport(ud.run, next)) ud.run = newRun();
    const dist = validatedDistance(ud.record.profile, ud.pos, next, now - ud.lastMoveAt);
    ud.pos = next;
    ud.lastMoveAt = now;
    trackStage(ud.run, next, now, jumped);

    ps.x = next.x;
    ps.z = next.z;
    ps.ry = Number.isFinite(Number(m.ry)) ? Number(m.ry) : ps.ry;
    ps.v = Number.isFinite(Number(m.v)) ? Math.max(-200, Math.min(200, Number(m.v))) : 0;

    const { gained, events } = driveGain(ud.record.profile, dist, now);
    if (gained > 0) {
      client.send('gain', { amount: gained, source: 'drive' });
      for (const e of events) client.send('event', e);
      ud.dirty = true;
    }
  }

  handleAction(client, action) {
    const ud = client.userData;
    if (!ud) return;
    const pos = ud.pos || { x: WORLD.spawn.x, z: WORLD.spawn.z };
    const result = runAction(ud.record.profile, action, pos, Date.now(), ud.playtime);
    client.send('actionResult', { type: action?.type, ...result });
    if (result.ok) {
      const ps = this.state.players.get(client.sessionId);
      if (ps) {
        ps.kart = ud.record.profile.kart;
        ps.trail = ud.record.profile.trail;
      }
      this.pushProfile(client);
    }
  }

  handleStage(client, action) {
    const ud = client.userData;
    if (!ud?.pos) return;
    const result = applyStageAction(ud.record.profile, ud.run, action, ud.pos, Date.now());
    client.send('stageResult', { type: action?.type, id: action?.id, ...result });
    if (result.ok) this.pushProfile(client);
  }

  handleAvatar(client, m) {
    const ps = this.state.players.get(client.sessionId);
    if (!ps || typeof m?.json !== 'string' || m.json.length > MAX_AVATAR_JSON) return;
    try {
      const parsed = JSON.parse(m.json);
      ps.avatar = JSON.stringify(parsed);
      if (client.userData.auth.legionId) client.userData.record.avatar = parsed.pfp || null;
    } catch {
      /* ignore malformed avatar payloads */
    }
  }

  // --- ticks --------------------------------------------------------------

  tickSecond() {
    const now = Date.now();
    for (const client of this.clients) {
      const ud = client.userData;
      if (!ud?.pos) continue;
      const res = treadmillTick(ud.record.profile, ud.pos, now);
      if (res?.locked) {
        client.send('treadmillLocked', { id: res.treadmill.id, message: res.message });
      } else if (res?.gained) {
        client.send('gain', { amount: res.gained, source: 'treadmill', id: res.treadmill.id });
        for (const e of res.events) client.send('event', e);
        ud.dirty = true;
      }
      if (ud.dirty) this.pushProfile(client);
    }
  }

  pushProfile(client, toast) {
    const ud = client.userData;
    if (!ud) return;
    ud.dirty = false;
    const p = ud.record.profile;
    const ps = this.state.players.get(client.sessionId);
    if (ps) ps.speed = p.speed;
    const { transactions, ...visible } = p;
    client.send('profile', { profile: visible, serverNow: Date.now(), playtime: { start: ud.playtime.start, claimed: [...ud.playtime.claimed] } });
    if (toast) client.send('toast', { text: toast });
    if (ud.auth.legionId) scheduleSave();
  }

  leaderboards() {
    const guests = [];
    for (const c of this.clients) {
      const ud = c.userData;
      if (ud?.auth.isGuest) guests.push({ name: ud.auth.name, avatar: null, ...publicSummary(ud.record.profile) });
    }
    return computeLeaderboards(guests);
  }

  broadcastLeaderboards() {
    this.broadcast('leaderboards', this.leaderboards());
  }
}
