// Server-authoritative economy: validates movement reports before turning them into
// Speed, runs treadmill ticks, and routes player actions through the shared reducers.

import {
  WORLD,
  applyAction,
  applyDrive,
  applyTreadmillSecond,
  canUseTreadmill,
  kartTopVelocity,
  treadmillAt,
  treadmillLockText,
} from '../shared/gameData.js';

const SLACK = 1.35; // tolerance for network jitter on top of the kart's top velocity

export function clampToBounds(x, z) {
  const b = WORLD.bounds;
  return { x: Math.min(b.maxX, Math.max(b.minX, x)), z: Math.min(b.maxZ, Math.max(b.minZ, z)) };
}

// Returns the distance that counts toward Speed, or 0 if the report looks like a
// teleport, a speed hack, or the player is idling on a treadmill.
// A move counts as a teleport when it is far beyond what the kart could drive.
export function isJump(profile, prev, next, dtMs) {
  if (!prev) return true;
  const dt = Math.min(Math.max(dtMs, 16), 1000) / 1000;
  const maxDist = kartTopVelocity(profile.speed, profile.kart, profile.customSpeed, profile.level) * dt * SLACK + 0.5;
  return Math.hypot(next.x - prev.x, next.z - prev.z) > maxDist * 3;
}

export function validatedDistance(profile, prev, next, dtMs) {
  if (!prev) return 0;
  const dt = Math.min(Math.max(dtMs, 16), 1000) / 1000;
  const dist = Math.hypot(next.x - prev.x, next.z - prev.z);
  const maxDist = kartTopVelocity(profile.speed, profile.kart, profile.customSpeed, profile.level) * dt * SLACK + 0.5;
  if (dist > maxDist * 3) return 0; // teleport / respawn
  return Math.min(dist, maxDist);
}

export function driveGain(profile, distance, now) {
  if (distance <= 0) return { gained: 0, events: [] };
  return applyDrive(profile, distance, now);
}

// Called once per second for each player.
export function treadmillTick(profile, pos, now) {
  const t = treadmillAt(pos.x, pos.z);
  if (!t) return null;
  if (!canUseTreadmill(profile, t)) return { locked: true, treadmill: t, message: treadmillLockText(t) };
  return { treadmill: t, ...applyTreadmillSecond(profile, t, now) };
}

const ALLOWED_ACTIONS = new Set([
  'rebirth',
  'claimChest',
  'claimPlaytime',
  'upgradeBoost',
  'claimQuest',
  'buyKart',
  'equipKart',
  'buyTrail',
  'equipTrail',
  'buyPotion',
  'setCustomSpeed',
]);

// Proximity checks for actions that need the player to be somewhere specific.
function nearChest(pos) {
  const c = WORLD.chest;
  return Math.hypot(pos.x - c.x, pos.z - c.z) <= c.radius + 6;
}

export function runAction(profile, action, pos, now, session) {
  if (!action || !ALLOWED_ACTIONS.has(action.type)) return { ok: false, error: 'Unknown action' };
  if (action.type === 'claimChest' && !nearChest(pos)) return { ok: false, error: 'Drive to the Rewards chest first' };
  return applyAction(profile, action, now, session);
}
