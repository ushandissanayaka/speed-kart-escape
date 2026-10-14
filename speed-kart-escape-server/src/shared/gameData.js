// Shared game rules for Speed Kart Escape.
// This file is mirrored byte-for-byte in speed-kart-escape-server/src/shared/gameData.js.
// The server runs these reducers authoritatively; the client runs them only in offline mode.

export const GAME_SLUG = 'speed-kart-escape';
export const ROOM_NAME = 'starting_place';
export const PROFILE_VERSION = 2;

// ---------------------------------------------------------------------------
// World layout (world units; the Bloxity base avatar is 6.4 units tall).
// North is -Z. The camera spawns looking north toward the Stage 1 gate.
// ---------------------------------------------------------------------------
export const WORLD = {
  plaza: { minX: -160, maxX: 160, minZ: -55, maxZ: 55 },
  corridor: { minX: -30, maxX: 30, minZ: -125, maxZ: -55 },
  spawn: { x: 0, z: 8, ry: Math.PI }, // ry = PI faces the kart north (-Z)
  bounds: { minX: -192, maxX: 192, minZ: -3180, maxZ: 55 },
  stageGate: { x: 0, z: -128, width: 60 },
  stageTrigger: { minX: -28, maxX: 28, minZ: -175, maxZ: -150 },
  world2Gate: { x: 96, z: -68, radius: 7 },
  chest: { x: -138, z: 34, radius: 18 },
  merchantPad: { x: -62, z: -44, radius: 8 },
  yellowPad: { x: -96, z: -44, w: 24, d: 14 },
};

// Treadmills sit along the south wall, sized so a kart drives onto the belt.
// Order west -> east matches the reference: x10 red, x5 yellow, x1, x1, x25 neon cyan,
// and the giant colour-changing x100. `w` = total width (rails included), `d` = length.
// The back end (arch) is at the south wall; karts drive on from the north.
export const TREADMILL_BACK_Z = 56;
export const TREADMILLS = [
  { id: 'red10', label: 'x10 Speed', mult: 10, x: -99, w: 22, d: 34, style: 'red', requires: { pass: 'superTreadmill', sku: 'super_treadmill' } },
  { id: 'yellow5', label: 'x5 Speed', mult: 5, x: -69, w: 22, d: 34, style: 'yellow', requires: { wins: 5 } },
  { id: 'grey1a', label: 'x1 Speed', mult: 1, x: -39, w: 22, d: 34, style: 'grey', requires: null },
  { id: 'grey1b', label: 'x1 Speed', mult: 1, x: -9, w: 22, d: 34, style: 'grey', requires: null },
  { id: 'cyan25', label: 'x25 Speed', mult: 25, x: 21, w: 22, d: 34, style: 'neon', requires: { wins: 100 } },
  { id: 'rainbow100', label: 'x100 Speed', mult: 100, x: 60, w: 40, d: 40, style: 'rainbow', requires: { pass: 'mythicalTreadmill', sku: 'mythical_treadmill' } },
];
export const treadmillCenterZ = (t) => TREADMILL_BACK_Z - t.d / 2;
const RAIL = (t) => (t.style === 'rainbow' ? 3 : 2.3);

// The usable belt between the rails.
export function treadmillAt(x, z) {
  for (const t of TREADMILLS) {
    const hw = t.w / 2 - RAIL(t);
    if (Math.abs(x - t.x) <= hw && z >= TREADMILL_BACK_Z - t.d && z <= TREADMILL_BACK_Z - 3) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Karts, trails, boosts, potions, quests, playtime (values from the reference video)
// ---------------------------------------------------------------------------
// Karts cost Wins. `speed` multiplies all Speed earned, `coins` all Coins earned.
// `card` is the background of its card in the Karts popup.
export const KARTS = [
  { id: 'noob', name: 'Noob Kart', speed: 1, coins: 1, cost: 0, body: '#eef0fd', trim: '#13214f', accent: '#c9d1ff', card: 'grey', topSpeedBonus: 0 },
  { id: 'junior', name: 'Junior Kart', speed: 2, coins: 2, cost: 3, body: '#ff2a3a', trim: '#1a1d2e', accent: '#ffffff', card: 'grey', topSpeedBonus: 0.05 },
  { id: 'pro', name: 'Pro Kart', speed: 4, coins: 3, cost: 25, body: '#ff6a1f', trim: '#1a1d2e', accent: '#e8eaf6', card: 'green', topSpeedBonus: 0.1 },
  { id: 'water', name: 'Water Kart', speed: 20, coins: 4, cost: 100, body: '#2a9bff', trim: '#0f1f4a', accent: '#9fe8ff', card: 'green', topSpeedBonus: 0.2 },
  { id: 'crocodile', name: 'Crocodile Kart', speed: 50, coins: 5, cost: 500, body: '#2fd84a', trim: '#122016', accent: '#a8ff7a', card: 'cyan', topSpeedBonus: 0.3 },
  { id: 'ice', name: 'Ice Kart', speed: 150, coins: 6, cost: 3500, body: '#8ff0ff', trim: '#10204a', accent: '#ffffff', card: 'cyan', topSpeedBonus: 0.4 },
];

// Trails: buy with Coins or Gems; the equipped trail multiplies Speed earned.
export const TRAILS = [
  { id: 'none', name: 'No Trail', boost: 1, coins: 0, gems: 0, colors: [], card: ['#9aa3c4', '#6c76a8'] },
  { id: 'purple', name: 'Purple Trail', boost: 1.5, coins: 500, gems: 9, colors: ['#b13bff', '#e08bff', '#ffffff'], card: ['#c23bff', '#7a12d8'] },
  { id: 'green', name: 'Green Trail', boost: 3, coins: 1000, gems: 19, colors: ['#3dff4a', '#a8ff7a', '#ffffff'], card: ['#8af23a', '#2fc21a'] },
  { id: 'blue', name: 'Blue Trail', boost: 5, coins: 10000, gems: 29, colors: ['#1fc6ff', '#8fe8ff', '#ffffff'], card: ['#3fe0ff', '#0a9ad8'] },
  { id: 'yellow', name: 'Yellow Trail', boost: 10, coins: 50000, gems: 59, colors: ['#ffd21c', '#fff176', '#ffffff'], card: ['#ffe24a', '#f2a000'] },
  { id: 'fire', name: 'Fire Trail', boost: 15, coins: 250000, gems: 109, colors: ['#ff3d00', '#ffb300', '#fff176'], card: ['#ff8a2a', '#e8321a'] },
  { id: 'ice', name: 'Ice Trail', boost: 25, coins: 1000000, gems: 199, colors: ['#9ff4ff', '#3ec7ff', '#ffffff'], card: ['#5ff0ff', '#1aa8e8'] },
];

// Boosts popup: upgradable multipliers bought with Coins (or Gems). +0.1 per level.
export const BOOSTS = [
  { id: 'speed', name: 'SPEED', desc: 'All Speed you earn', baseCost: 150, gems: 19 },
  { id: 'coins', name: 'COINS', desc: 'Every coin you collect', baseCost: 100, gems: 19 },
  { id: 'wins', name: 'WINS', desc: 'Every stage you beat', baseCost: 50, gems: 19 },
];
export const boostMult = (level) => Math.round((1 + 0.1 * (level || 0)) * 10) / 10;
export const boostCost = (boost, level) => Math.round(boost.baseCost * Math.pow(1.6, level || 0));

export const POTIONS = [
  { id: 'speed2x', name: 'Speed Potion', desc: 'x2 Speed gain for 5 minutes', cost: 60, durationMs: 5 * 60_000 },
  { id: 'coins2x', name: 'Coin Potion', desc: 'x2 Coins for 5 minutes', cost: 40, durationMs: 5 * 60_000 },
  { id: 'xp2x', name: 'XP Potion', desc: 'x2 Level XP for 5 minutes', cost: 30, durationMs: 5 * 60_000 },
];

// Daily quests, reset at 00:00 UTC. `counter` is read from profile.counters and
// measured from the value it had when the day started.
export const QUESTS = [
  { id: 'levels_w1', name: 'Gain 5 Levels in World 1', tier: 'EASY', sub: 'WORLD 1', counter: 'levelsGained', target: 5, reward: { speed: 10_000 }, rewardText: '+10K SPEED', color: 'green' },
  { id: 'coins_w2', name: 'Collect 250 Coins in World 2', tier: 'MEDIUM', sub: 'WORLD 2', counter: 'coinsWorld2', target: 250, reward: { coins: 2_500 }, rewardText: '+2.5K COINS', color: 'orange' },
  { id: 'beat_w2', name: 'Beat World 2', tier: 'HARD', sub: 'FINISH THE LAST STAGE', counter: 'world2Beaten', target: 1, reward: { wins: 15_000 }, rewardText: '+15K WINS', color: 'pink' },
];
export const dayKey = (now) => new Date(now).toISOString().slice(0, 10);
export function msUntilDailyReset(now) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
}

// Playtime rewards unlock during one session; leaving the game resets them.
export const PLAYTIME_REWARDS = [
  { label: '2x Speed Boost', at: 60_000, grant: { boost: 2, durationMs: 5 * 60_000 }, color: 'cyan', icon: 'orb' },
  { label: 'x1,500 Coins', at: 3 * 60_000, grant: { coins: 1500 }, color: 'yellow', icon: 'coin' },
  { label: 'x10,000 Speed', at: 5 * 60_000, grant: { speed: 10_000 }, color: 'green', icon: 'shoe' },
  { label: '5x Speed Boost', at: 10 * 60_000, grant: { boost: 5, durationMs: 5 * 60_000 }, color: 'cyan', icon: 'orbs' },
  { label: 'x3,000 Wins', at: 25 * 60_000, grant: { wins: 3000 }, color: 'yellow', icon: 'trophy' },
  { label: '10x Speed Boost', at: 55 * 60_000, grant: { boost: 10, durationMs: 5 * 60_000 }, color: 'green', icon: 'potions' },
];

// Gem products. Prices live in the Bloxity IAP catalog — `displayPrice` is only the
// label the HUD shows and must be kept in sync with that catalog.
export const GEM_PRODUCTS = {
  speed_100k: { name: '+100K Speed', grant: { speed: 100_000 }, displayPrice: 25 },
  speed_1m: { name: '+1M Speed', grant: { speed: 1_000_000 }, displayPrice: 99 },
  speed_10m: { name: '+10M Speed', grant: { speed: 10_000_000 }, displayPrice: 399 },
  pass_x2_wins: { name: 'x2 Wins', grant: { pass: 'x2Wins' }, displayPrice: 149 },
  pass_x2_speed: { name: 'x2 Speed', grant: { pass: 'x2Speed' }, displayPrice: 4 },
  mythical_treadmill: { name: 'Mythical Treadmill', grant: { pass: 'mythicalTreadmill' }, displayPrice: 1400 },
  super_treadmill: { name: 'Super Treadmill', grant: { pass: 'superTreadmill' }, displayPrice: 49 },
  coins_500: { name: '500 COINS', grant: { coins: 500 }, displayPrice: 9 },
  coins_2500: { name: '2.5K COINS', grant: { coins: 2_500 }, displayPrice: 30 },
  coins_10k: { name: '10K COINS', grant: { coins: 10_000 }, displayPrice: 140 },
  coins_50k: { name: '50K COINS', grant: { coins: 50_000 }, displayPrice: 499 },
  wins_500: { name: '500 WINS', grant: { wins: 500 }, displayPrice: 14 },
  wins_5k: { name: '5K WINS', grant: { wins: 5_000 }, displayPrice: 139 },
  wins_25k: { name: '25K WINS', grant: { wins: 25_000 }, displayPrice: 690 },
  wins_100k: { name: '100K WINS', grant: { wins: 100_000 }, displayPrice: 2700 },
  skip_rebirth: { name: 'Skip Rebirth', grant: { rebirth: true }, displayPrice: 49 },
  away_10x: { name: 'Claim 10x Away Rewards', grant: { away10x: true }, displayPrice: 49 },
  skip_stage: { name: 'Skip Stage', grant: { skipStage: 1 }, displayPrice: 29 },
  revive: { name: 'Teleport Back', grant: {}, displayPrice: 9 },
  boost_speed: { name: 'Speed Boost +0.1', grant: { boostLevel: 'speed' }, displayPrice: 19 },
  boost_coins: { name: 'Coins Boost +0.1', grant: { boostLevel: 'coins' }, displayPrice: 19 },
  boost_wins: { name: 'Wins Boost +0.1', grant: { boostLevel: 'wins' }, displayPrice: 19 },
};
for (const t of TRAILS) {
  if (t.gems) GEM_PRODUCTS[`trail_${t.id}`] = { name: t.name, grant: { trail: t.id }, displayPrice: t.gems };
}

// ---------------------------------------------------------------------------
// Stages (from the reference recordings). The course runs north (-Z) from the
// Stage 1 gate. Each stage is followed by a gate; in front of every gate sit a
// purple "Skip Stage" pad (left), a yellow "+N Wins / Return" pad (right) and a
// 250-coin safe. Taking the wins pad ends the run and returns you to the spawn.
// ---------------------------------------------------------------------------
export const COURSE = {
  startZ: -152, // back face of the Stage 1 gate
  gateDepth: 24,
  halfWidth: 60, // drivable half width inside every stage
};
export const STAGES = [
  { n: 1, len: 280, theme: 'grass', wins: 1, coins: 3, coinSpots: [[-24, 75], [26, 150], [-10, 235]], hw: 150 }, // one huge open room
  { n: 2, len: 420, theme: 'grass', wins: 2, coins: 3, coinSpots: [[75, 72], [8, 180], [-80, 292]], hw: 150, rampH: 22 }, // hill road + rolling logs
  { n: 3, len: 480, theme: 'spikes', wins: 8, coins: 5, coinSpots: [[100, 60], [-80, 147], [-60, 220], [75, 292], [10, 445]], hw: 150, wallH: 130, baseY: 22 }, // pop-up spike field
  { n: 4, len: 490, theme: 'pits', wins: 20, coins: 5, coinSpots: [[-62, 75], [70, 132], [50, 194], [-75, 260], [-28, 392]], hw: 120, wallH: 130, baseY: 22 }, // brick floor crossed by full-width lava pits
  { n: 5, len: 560, theme: 'lava', wins: 50, coins: 5, coinSpots: [[-14, 100], [-127, 125], [70, 165], [112, 290], [-60, 380]], hw: 140, wallH: 130, baseY: 22 }, // jump block to block over lava
  { n: 6, len: 540, theme: 'corridor', wins: 100, coins: 5, coinSpots: [[41, 140], [-41, 220], [0, 260], [41, 380], [-15, 505]], hw: 52, baseY: 22 }, // red blocks slide along the road, hide in the side bays
];
// startZ = just past the gate into the stage; endZ = front face of the next gate.
(() => {
  let z = COURSE.startZ;
  for (const s of STAGES) {
    s.startZ = z;
    s.endZ = z - s.len;
    z = s.endZ - COURSE.gateDepth;
  }
  COURSE.endZ = z;
})();
export const stageDef = (n) => STAGES[n - 1] || null;
export const stageHW = (n) => stageDef(n)?.hw ?? COURSE.halfWidth;

// Which stage a z position belongs to (the gate after a stage counts as part of it).
export function stageAt(z) {
  if (z > COURSE.startZ) return 0;
  for (const s of STAGES) if (z <= s.startZ && z > s.endZ - COURSE.gateDepth) return s.n;
  return STAGES.length;
}

// Pads in front of the gate at the end of stage n.
export function stagePads(n) {
  const s = stageDef(n);
  const z = s.endZ + 14;
  return {
    skip: { x: -24, z, r: 7 }, // skips stage n + 1
    wins: { x: 24, z, r: 7 },
    safe: { x: -48, z: z + 4, r: 15 },
  };
}
export const stageRespawn = (n) => ({ x: 0, z: stageDef(n).startZ - 14, ry: Math.PI });
export const stageMinTimeMs = (n) => (stageDef(n).len / 190) * 1000;

// Coins: 9 per stage in a weaving line, same for every player (server validates).
export const STAGE_COIN_VALUE = 50;
export const STAGE_COIN_COOLDOWN_MS = 45_000;
export const SAFE_COINS = 250;
export const SAFE_COOLDOWN_MS = 10 * 60_000;
export const STAGE_COINS = STAGES.flatMap((s) =>
  Array.from({ length: s.coins ?? 9 }, (_, k, n = s.coins ?? 9) => ({
    id: `s${s.n}c${k}`,
    stage: s.n,
    x: s.coinSpots ? s.coinSpots[k][0] : Math.round(Math.sin(k * 1.7 + s.n) * (s.coinAmp ?? 34)),
    z: s.coinSpots ? s.startZ - s.coinSpots[k][1] : n > 1 ? s.startZ - 70 - (k * (s.len - 140)) / (n - 1) : s.startZ - s.len / 2,
  }))
);
export const coinById = (id) => STAGE_COINS.find((c) => c.id === id) || null;

// Global timed events, identical on every server: 2x Coins, then 2x Speed.
export const EVENT_CYCLE_MS = 20 * 60_000;
export const EVENTS = [
  { id: 'coins', start: 0, dur: 5 * 60_000, label: '2x COINS', title: 'DOUBLE COINS', desc: 'All Coins earned are doubled' },
  { id: 'speed', start: 10 * 60_000, dur: 5 * 60_000, label: '2x SPEED', title: 'DOUBLE SPEED', desc: 'All Speed earned is doubled' },
];
export function activeEvent(now) {
  const t = now % EVENT_CYCLE_MS;
  const e = EVENTS.find((x) => t >= x.start && t < x.start + x.dur);
  return e ? { ...e, msLeft: e.start + e.dur - t } : null;
}

// Kart speed grows with level (Level 5 -> 20, Level 10 -> 30, Level 25 -> 60) and is
// also the Custom Speed maximum, like the reference.
export const kartSpeedFor = (level) => 10 + 2 * level;

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------
export const TUNING = {
  driveStepDistance: 14, // units driven per +1 base speed
  baseMaxLevel: 25, // max level grows by 25 with every rebirth (MAX 25 -> MAX 50)
  chestCooldownMs: 15 * 60_000,
  merchantCycleMs: 6 * 60_000, // away for 5 min, then here for 1 min
  merchantStayMs: 60_000,
  world2Rebirths: 5,
};

export const xpForLevel = (level) => 46 + 5 * level; // Level 5 -> 71 (matches reference)
export const maxLevelFor = (rebirths) => TUNING.baseMaxLevel * (1 + (rebirths || 0));
export const maxLevel = (p) => maxLevelFor(p.rebirths);
export const rebirthMultiplier = (rebirths) => 1 + rebirths * 0.5;
export const rebirthCoins = (rebirths) => 250 * (rebirths + 1);
export const canRebirth = (p) => p.level >= maxLevel(p);

const kartOf = (id) => KARTS.find((k) => k.id === id) || KARTS[0];
const trailOf = (id) => TRAILS.find((t) => t.id === id) || TRAILS[0];

// Kart velocity in units/second from the Speed stat. Speed grows without bound,
// so velocity grows logarithmically and is capped.
export function kartTopVelocity(speed, kartId = 'noob', customSpeed = 0, level = 1) {
  // New players start slow (~19 units/s); level and Speed make the kart faster.
  let v = 6 + 1.1 * kartSpeedFor(level) + 4 * Math.log10(1 + Math.max(0, speed));
  v *= 1 + kartOf(kartId).topSpeedBonus;
  v = Math.min(v, 175);
  if (customSpeed > 0) v = Math.min(v, 6 + 1.1 * customSpeed);
  return v;
}

export function merchantStatus(now) {
  const t = now % TUNING.merchantCycleMs;
  const awayMs = TUNING.merchantCycleMs - TUNING.merchantStayMs;
  if (t < awayMs) return { present: false, msLeft: awayMs - t };
  return { present: true, msLeft: TUNING.merchantCycleMs - t };
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export function newProfile(now = Date.now()) {
  return {
    v: PROFILE_VERSION,
    speed: 0,
    wins: 0,
    coins: 0,
    rebirths: 0,
    level: 1,
    xp: 0,
    driveCarry: 0,
    customSpeed: 0,
    ownedKarts: ['noob'],
    kart: 'noob',
    ownedTrails: ['none'],
    trail: 'none',
    boosts: { speed: 0, coins: 0, wins: 0 },
    passes: {},
    potions: {},
    speedBoost: { mult: 1, until: 0 },
    counters: { speedGained: 0, treadmillSeconds: 0, chestsClaimed: 0, levelsGained: 0, coinsWorld2: 0, world2Beaten: 0, stagesBeaten: 0, world1Beaten: 0 },
    daily: { day: dayKey(now), base: {}, claimed: [] },
    lastChestAt: 0,
    lastSeen: now,
    away: null, // pending { ms, speed, wins }
    skips: 0,
    transactions: [],
    createdAt: now,
  };
}

export function normalizeProfile(p, now = Date.now()) {
  const base = newProfile(now);
  if (!p || typeof p !== 'object') return base;
  const out = { ...base, ...p };
  out.counters = { ...base.counters, ...(p.counters || {}) };
  out.passes = { ...(p.passes || {}) };
  out.potions = { ...(p.potions || {}) };
  out.boosts = { ...base.boosts, ...(p.boosts || {}) };
  out.speedBoost = { ...base.speedBoost, ...(p.speedBoost || {}) };
  out.daily = p.daily && p.daily.day ? { day: p.daily.day, base: { ...p.daily.base }, claimed: [...(p.daily.claimed || [])] } : base.daily;
  const karts = (Array.isArray(p.ownedKarts) ? p.ownedKarts : []).map((k) => (k === 'starter' ? 'noob' : k)).filter((k) => KARTS.some((x) => x.id === k));
  out.ownedKarts = [...new Set(['noob', ...karts])];
  if (!out.ownedKarts.includes(out.kart)) out.kart = 'noob';
  const trails = (Array.isArray(p.ownedTrails) ? p.ownedTrails : []).filter((t) => TRAILS.some((x) => x.id === t));
  out.ownedTrails = [...new Set(['none', ...trails])];
  if (!out.ownedTrails.includes(out.trail)) out.trail = 'none';
  out.transactions = Array.isArray(p.transactions) ? p.transactions.slice(-200) : [];
  return out;
}

const potionActive = (p, id, now) => (p.potions[id] || 0) > now;
export const activeSpeedBoost = (p, now) => (p.speedBoost.until > now ? p.speedBoost.mult : 1);

export function speedMultiplier(p, now = Date.now()) {
  let m = rebirthMultiplier(p.rebirths);
  m *= kartOf(p.kart).speed;
  m *= trailOf(p.trail).boost;
  m *= boostMult(p.boosts.speed);
  if (p.passes.x2Speed) m *= 2;
  if (potionActive(p, 'speed2x', now)) m *= 2;
  m *= activeSpeedBoost(p, now);
  if (activeEvent(now)?.id === 'speed') m *= 2;
  return m;
}

export function coinMultiplier(p, now = Date.now()) {
  const event = activeEvent(now)?.id === 'coins' ? 2 : 1;
  return kartOf(p.kart).coins * boostMult(p.boosts.coins) * (potionActive(p, 'coins2x', now) ? 2 : 1) * event;
}

function grantCoins(p, amount, now) {
  p.coins += Math.round(amount * coinMultiplier(p, now));
}

function grantWins(p, amount) {
  p.wins += Math.round(amount * (p.passes.x2Wins ? 2 : 1) * boostMult(p.boosts.wins));
}

// Adds speed and the matching level XP. Returns events for popups.
export function addSpeed(p, amount, now = Date.now(), { countsForQuests = true } = {}) {
  const events = [];
  if (amount <= 0) return events;
  p.speed += amount;
  if (countsForQuests) p.counters.speedGained += amount;
  const cap = maxLevel(p);
  if (p.level < cap) {
    const xpMult = potionActive(p, 'xp2x', now) ? 2 : 1;
    // XP grows slowly relative to raw speed so levels stay meaningful at high speeds.
    p.xp += Math.max(1, Math.round(Math.log2(1 + amount) * xpMult));
    while (p.level < cap && p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level += 1;
      p.counters.levelsGained += 1;
      grantCoins(p, 25 * p.level, now);
      events.push({ type: 'levelUp', level: p.level });
    }
    if (p.level >= cap) p.xp = 0;
  }
  return events;
}

// Driving: distance in world units since the last report.
export function applyDrive(p, distance, now = Date.now()) {
  p.driveCarry += distance;
  let gained = 0;
  const events = [];
  while (p.driveCarry >= TUNING.driveStepDistance) {
    p.driveCarry -= TUNING.driveStepDistance;
    const amt = Math.max(1, Math.round(speedMultiplier(p, now)));
    gained += amt;
    events.push(...addSpeed(p, amt, now));
  }
  return { gained, events };
}

export function canUseTreadmill(p, t) {
  if (!t.requires) return true;
  if (t.requires.wins != null) return p.wins >= t.requires.wins;
  if (t.requires.pass) return !!p.passes[t.requires.pass];
  return false;
}

export function treadmillLockText(t) {
  if (!t.requires) return '';
  if (t.requires.wins != null) return `Requires ${t.requires.wins} Wins`;
  return t.requires.pass === 'superTreadmill' ? 'Super Treadmill' : 'Mythical Treadmill';
}

// One second on a treadmill.
export function applyTreadmillSecond(p, t, now = Date.now()) {
  if (!canUseTreadmill(p, t)) return { gained: 0, events: [] };
  const amt = Math.max(1, Math.round(t.mult * speedMultiplier(p, now)));
  p.counters.treadmillSeconds += 1;
  return { gained: amt, events: addSpeed(p, amt, now) };
}

export function chestReady(p, now = Date.now()) {
  return now - (p.lastChestAt || 0) >= TUNING.chestCooldownMs;
}

// --- daily quests ----------------------------------------------------------
export function refreshDaily(p, now = Date.now()) {
  const day = dayKey(now);
  if (p.daily.day === day) return false;
  p.daily = { day, base: {}, claimed: [] };
  for (const q of QUESTS) p.daily.base[q.counter] = p.counters[q.counter] || 0;
  return true;
}

export function questProgress(p, quest) {
  const start = p.daily.base[quest.counter] ?? 0;
  const value = Math.max(0, (p.counters[quest.counter] || 0) - start);
  const claimed = p.daily.claimed.includes(quest.id);
  return { target: quest.target, value: Math.min(value, quest.target), done: value >= quest.target, claimed };
}

// --- away (offline) rewards -----------------------------------------------
// Earned while the player was away: up to 8 hours, at least 1 minute away.
export const AWAY_MAX_MS = 8 * 3_600_000;
export const AWAY_MIN_MS = 60_000;
// `lastSeen` is the last time the reward was claimed, so it builds up again from
// then and the popup shows every time the game is opened (after 1+ minute).
export function computeAway(p, now = Date.now()) {
  const gone = now - (p.lastSeen || now);
  p.away = null;
  if (gone >= AWAY_MIN_MS) {
    const ms = Math.min(gone, AWAY_MAX_MS);
    const min = ms / 60_000;
    p.away = {
      ms,
      speed: Math.round(min * 25 * speedMultiplier(p, now)),
      wins: Math.round(min * 0.25 * (1 + p.rebirths) * boostMult(p.boosts.wins)),
    };
  }
  if (!p.lastSeen) p.lastSeen = now;
  return p.away;
}

// --- playtime --------------------------------------------------------------
// session: { start, claimed: Set<index> } — lives only while the player is connected.
export function playtimeState(session, now) {
  const elapsed = now - session.start;
  return PLAYTIME_REWARDS.map((r, i) => ({ ...r, index: i, ready: elapsed >= r.at, claimed: session.claimed.has(i), msLeft: Math.max(0, r.at - elapsed) }));
}
export const playtimeClaimable = (session, now) => playtimeState(session, now).some((r) => r.ready && !r.claimed);

function giveSpeedBoost(p, mult, durationMs, now) {
  const cur = p.speedBoost.until > now ? p.speedBoost : { mult: 1, until: now };
  p.speedBoost = { mult: Math.max(cur.mult, mult), until: Math.max(cur.until, now) + durationMs };
}

function doRebirth(p) {
  p.coins += rebirthCoins(p.rebirths);
  p.rebirths += 1;
  p.level = 1;
  p.xp = 0;
}

// Grants from a Gems purchase. Idempotent per transactionId.
export function applyGemProduct(p, sku, transactionId, now = Date.now()) {
  const prod = GEM_PRODUCTS[sku];
  if (!prod) return { ok: false, error: 'Unknown product' };
  if (transactionId && p.transactions.includes(transactionId)) return { ok: true, duplicate: true };
  const g = prod.grant;
  if (g.speed) addSpeed(p, g.speed, now, { countsForQuests: false });
  if (g.coins) p.coins += g.coins;
  if (g.wins) p.wins += g.wins;
  if (g.away10x && p.away) {
    addSpeed(p, p.away.speed * 10, now, { countsForQuests: false });
    p.wins += p.away.wins * 10;
    p.away = null;
    p.lastSeen = now;
  }
  if (g.skipStage) p.skips = (p.skips || 0) + g.skipStage;
  if (g.pass) p.passes[g.pass] = true;
  if (g.rebirth) doRebirth(p);
  if (g.boostLevel) p.boosts[g.boostLevel] = (p.boosts[g.boostLevel] || 0) + 1;
  if (g.trail && !p.ownedTrails.includes(g.trail)) {
    p.ownedTrails.push(g.trail);
    p.trail = g.trail;
  }
  if (transactionId) {
    p.transactions.push(transactionId);
    if (p.transactions.length > 200) p.transactions = p.transactions.slice(-200);
  }
  return { ok: true, toast: `${prod.name} unlocked!` };
}

// Player-initiated actions. Mutates `p`. `session` is { start, claimed:Set } for
// playtime rewards. Returns { ok, error?, toast? }.
export function applyAction(p, action, now = Date.now(), session = null) {
  const fail = (error) => ({ ok: false, error });
  refreshDaily(p, now);
  switch (action?.type) {
    case 'rebirth': {
      if (!canRebirth(p)) return fail(`Reach Level ${maxLevel(p)} to rebirth`);
      doRebirth(p);
      return { ok: true, toast: `Rebirth ${p.rebirths}! Speed is now x${rebirthMultiplier(p.rebirths)}` };
    }
    case 'claimChest': {
      if (!chestReady(p, now)) return fail('Rewards are not ready yet');
      p.lastChestAt = now;
      p.counters.chestsClaimed += 1;
      grantCoins(p, 50 * (1 + p.rebirths), now);
      grantWins(p, 1);
      return { ok: true, toast: 'Collected Coins and a Win!' };
    }
    case 'claimPlaytime': {
      if (!session) return fail('Playtime unavailable');
      const i = Number(action.index);
      const r = PLAYTIME_REWARDS[i];
      if (!r) return fail('Unknown reward');
      if (session.claimed.has(i)) return fail('Already claimed');
      if (now - session.start < r.at) return fail('Keep playing to unlock this reward');
      session.claimed.add(i);
      const g = r.grant;
      if (g.coins) p.coins += g.coins;
      if (g.wins) p.wins += g.wins;
      if (g.speed) addSpeed(p, g.speed, now, { countsForQuests: false });
      if (g.boost) giveSpeedBoost(p, g.boost, g.durationMs, now);
      return { ok: true, toast: `Claimed ${r.label}!` };
    }
    case 'claimAway': {
      if (!p.away) return fail('Nothing to claim');
      addSpeed(p, p.away.speed, now, { countsForQuests: false });
      p.wins += p.away.wins;
      p.away = null;
      p.lastSeen = now;
      return { ok: true, toast: 'Welcome back!' };
    }
    case 'claimQuest': {
      const q = QUESTS.find((x) => x.id === action.id);
      if (!q) return fail('Unknown quest');
      const prog = questProgress(p, q);
      if (prog.claimed) return fail('Already claimed today');
      if (!prog.done) return fail('Quest not finished yet');
      p.daily.claimed.push(q.id);
      if (q.reward.coins) p.coins += q.reward.coins;
      if (q.reward.wins) p.wins += q.reward.wins;
      if (q.reward.speed) addSpeed(p, q.reward.speed, now, { countsForQuests: false });
      return { ok: true, toast: `Quest complete: ${q.rewardText}!` };
    }
    case 'buyKart': {
      const k = KARTS.find((x) => x.id === action.id);
      if (!k) return fail('Unknown kart');
      if (p.ownedKarts.includes(k.id)) return fail('Already owned');
      if (p.wins < k.cost) return fail(`You need ${formatNumber(k.cost)} Wins`);
      p.wins -= k.cost;
      p.ownedKarts.push(k.id);
      p.kart = k.id;
      return { ok: true, toast: `${k.name} unlocked!` };
    }
    case 'equipKart': {
      if (!p.ownedKarts.includes(action.id)) return fail('Kart not owned');
      p.kart = action.id;
      return { ok: true };
    }
    case 'buyTrail': {
      const t = TRAILS.find((x) => x.id === action.id);
      if (!t) return fail('Unknown trail');
      if (p.ownedTrails.includes(t.id)) return fail('Already owned');
      if (p.coins < t.coins) return fail('Not enough Coins');
      p.coins -= t.coins;
      p.ownedTrails.push(t.id);
      p.trail = t.id;
      return { ok: true, toast: `${t.name} equipped!` };
    }
    case 'equipTrail': {
      if (!p.ownedTrails.includes(action.id)) return fail('Trail not owned');
      p.trail = action.id;
      return { ok: true };
    }
    case 'upgradeBoost': {
      const b = BOOSTS.find((x) => x.id === action.id);
      if (!b) return fail('Unknown boost');
      const cost = boostCost(b, p.boosts[b.id]);
      if (p.coins < cost) return fail('Not enough Coins');
      p.coins -= cost;
      p.boosts[b.id] = (p.boosts[b.id] || 0) + 1;
      return { ok: true, toast: `${b.name} is now x${boostMult(p.boosts[b.id]).toFixed(1)}` };
    }
    case 'buyPotion': {
      const po = POTIONS.find((x) => x.id === action.id);
      if (!po) return fail('Unknown potion');
      const m = merchantStatus(now);
      const cost = m.present ? Math.ceil(po.cost / 2) : po.cost;
      if (p.coins < cost) return fail('Not enough Coins');
      p.coins -= cost;
      p.potions[po.id] = Math.max(p.potions[po.id] || 0, now) + po.durationMs;
      return { ok: true, toast: `${po.name} active!` };
    }
    case 'setCustomSpeed': {
      const v = Math.round(Number(action.value));
      const max = kartSpeedFor(p.level);
      if (!Number.isFinite(v) || v < 0 || v > max) return fail(`Pick 0 - ${max}`);
      p.customSpeed = v;
      return { ok: true };
    }
    default:
      return fail('Unknown action');
  }
}

// ---------------------------------------------------------------------------
// Stage run actions. `run` is per-connection state the server keeps:
// { maxStage, enteredAt: {n: ms}, coinAt: {id: ms}, safeAt: {n: ms} } and `pos`
// is the player's last validated position.
// ---------------------------------------------------------------------------
export const newRun = () => ({ maxStage: 0, enteredAt: {}, coinAt: {}, safeAt: {} });
const near = (pos, pt, r) => pos && Math.hypot(pos.x - pt.x, pos.z - pt.z) <= r;

// Called on every accepted movement. `jumped` = the move was a teleport.
export function trackStage(run, pos, now, jumped) {
  const s = stageAt(pos.z);
  if (s === run.maxStage + 1 && !jumped) {
    run.maxStage = s;
    run.enteredAt[s] = now;
  }
  if (s === 0 && jumped) run.maxStage = 0; // back at the spawn
  return s;
}

// Teleports the client may make: spawn, or the start of a stage it has reached.
export function allowedTeleport(run, pos) {
  if (stageAt(pos.z) === 0) return true;
  for (let n = 1; n <= run.maxStage; n++) {
    const r = stageRespawn(n);
    if (Math.hypot(pos.x - r.x, pos.z - r.z) < 20) return true;
  }
  return false;
}

export function applyStageAction(p, run, action, pos, now) {
  const fail = (error) => ({ ok: false, error });
  switch (action?.type) {
    case 'collectCoin': {
      const c = coinById(action.id);
      if (!c || run.maxStage < c.stage || !near(pos, c, 12)) return fail('');
      if (now - (run.coinAt[c.id] || 0) < STAGE_COIN_COOLDOWN_MS) return fail('');
      run.coinAt[c.id] = now;
      const before = p.coins;
      grantCoins(p, STAGE_COIN_VALUE, now);
      return { ok: true, coins: p.coins - before };
    }
    case 'openSafe': {
      const n = Number(action.stage);
      if (!stageDef(n) || run.maxStage < n || !near(pos, stagePads(n).safe, 22)) return fail('Drive to the safe first');
      if (now - (run.safeAt[n] || 0) < SAFE_COOLDOWN_MS) return fail(`Ready in ${formatClock(SAFE_COOLDOWN_MS - (now - run.safeAt[n]))}`);
      run.safeAt[n] = now;
      p.coins += SAFE_COINS;
      return { ok: true, toast: `+${SAFE_COINS} Coins!` };
    }
    case 'stageWin': {
      const n = Number(action.stage);
      const s = stageDef(n);
      if (!s || run.maxStage < n || !near(pos, stagePads(n).wins, 14)) return fail('Finish the stage first');
      if (now - (run.enteredAt[n] || now) < stageMinTimeMs(n)) return fail('Finish the stage first');
      grantWins(p, s.wins);
      p.counters.stagesBeaten = (p.counters.stagesBeaten || 0) + 1;
      if (n >= STAGES.length) p.counters.world1Beaten = (p.counters.world1Beaten || 0) + 1;
      run.maxStage = 0;
      return { ok: true, toast: `+${formatNumber(s.wins)} Wins!`, teleport: 'spawn' };
    }
    case 'useSkip': {
      const n = Number(action.stage); // skip stage n+1
      const next = stageDef(n + 1);
      if (!next || run.maxStage < n || !near(pos, stagePads(n).skip, 14)) return fail('Stand on the Skip Stage pad');
      if ((p.skips || 0) < 1) return fail('NEED_SKIP');
      p.skips -= 1;
      run.maxStage = n + 1;
      run.enteredAt[n + 1] = now - stageMinTimeMs(n + 1);
      return { ok: true, toast: `Skipped Stage ${n + 1}!`, teleport: { x: 0, z: stagePads(n + 1).wins.z + 18, ry: Math.PI } };
    }
    default:
      return fail('Unknown action');
  }
}

// ---------------------------------------------------------------------------
// Leaderboard starting rows (from the reference). Real players are ranked against
// these and push them off the top 9. Set SHOW_SEED_LEADERBOARD = false to hide them.
// `look` drives the procedural avatar bubble: [skin, hair, background].
// ---------------------------------------------------------------------------
export const SHOW_SEED_LEADERBOARD = true;
export const LEADERBOARD_SEED = {
  speed: [
    { name: 'colindoubleu', value: 106.3e12, look: ['#3b2a78', '#170f3f', '#ffffff'] },
    { name: 'Thatguyrikku', value: 63.2e12, look: ['#2fbf4a', '#13702a', '#ffffff'] },
    { name: 'ChocolateBaumann17', value: 49.9e12, look: ['#f3d2b6', '#2b2b3d', '#dfe8ff'] },
    { name: 'Kaiarchie007', value: 34.6e12, look: ['#ffffff', '#f4c6ec', '#fff0fb'] },
    { name: 'EjglidMjyInner', value: 25.7e12, look: ['#f1b07a', '#a8461a', '#ffffff'] },
    { name: 'tejveersinghsidhu', value: 7.3e12, look: ['#1c1c26', '#08080e', '#ffffff'] },
    { name: 'kidcool12376', value: 6.0e12, look: ['#ffe1fb', '#ff5ccf', '#e9f6ff'] },
    { name: 'rdy4ty', value: 3.7e12, look: ['#f6c99c', '#b0521c', '#ffffff'] },
    { name: 'ketoneko_2331000', value: 2.4e12, look: ['#ffffff', '#1f1f2a', '#ffffff'] },
  ],
  wins: [
    { name: 'hfidkydydchixh', value: 251.0e6, look: ['#f6c99c', '#b0521c', '#ffffff'] },
    { name: 'ParziBooo_1', value: 222.2e6, look: ['#f6c99c', '#a3401a', '#ffffff'] },
    { name: 'ramdom_zq', value: 176.4e6, look: ['#f6c99c', '#c25a1c', '#ffffff'] },
    { name: 'yulian_20189', value: 67.1e6, look: ['#1a1f3a', '#0a0e22', '#ffffff'] },
    { name: 'shzinhi032', value: 45.1e6, look: ['#ffe48a', '#ffb31a', '#ffffff'] },
    { name: 'ketoneko_2331000', value: 44.6e6, look: ['#ffffff', '#1f1f2a', '#ffffff'] },
    { name: 'MyGuyYoe', value: 30.5e6, look: ['#f6c99c', '#b0521c', '#ffffff'] },
    { name: 'bob12345pomaaa666', value: 25.1e6, look: ['#7ef0a6', '#2fbf6a', '#ffffff'] },
    { name: 'PJRM_ALT', value: 23.2e6, look: ['#f3d2b6', '#2b2b3d', '#ffffff'] },
  ],
  rebirths: [
    { name: 'Kaiarchie007', value: 16, look: ['#ffffff', '#f4c6ec', '#fff0fb'] },
    { name: 'colindoubleu', value: 12, look: ['#3b2a78', '#170f3f', '#ffffff'] },
    { name: 'EjglidMjyInner', value: 12, look: ['#f1b07a', '#a8461a', '#ffffff'] },
    { name: 'MrSlay132', value: 11, look: ['#2f6bd8', '#16306e', '#ffffff'] },
    { name: 'Patrick_27651', value: 11, look: ['#3a3a52', '#18e05a', '#ffffff'] },
    { name: 'ChocolateBaumann17', value: 11, look: ['#f3d2b6', '#2b2b3d', '#dfe8ff'] },
    { name: 'Thatguyrikku', value: 11, look: ['#2fbf4a', '#13702a', '#ffffff'] },
    { name: 'MANUTHIA35', value: 11, look: ['#14141c', '#050508', '#ffffff'] },
    { name: 'rdy4ty', value: 10, look: ['#f6c99c', '#b0521c', '#ffffff'] },
  ],
};

// Merges live rows ({ name, value, avatar }) with the seed rows and keeps the top 9.
export function mergeLeaderboard(stat, rows) {
  const all = [...rows];
  if (SHOW_SEED_LEADERBOARD) {
    const live = new Set(rows.map((r) => r.name));
    for (const s of LEADERBOARD_SEED[stat] || []) if (!live.has(s.name)) all.push(s);
  }
  return all.sort((a, b) => b.value - a.value).slice(0, 9);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];
export function formatNumber(n) {
  n = Number(n) || 0;
  if (Math.abs(n) < 1000) return String(Math.floor(n));
  let i = 0;
  while (Math.abs(n) >= 1000 && i < SUFFIXES.length - 1) {
    n /= 1000;
    i++;
  }
  const s = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(1);
  return s.replace(/\.0$/, '') + SUFFIXES[i];
}

export function formatClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function publicSummary(p) {
  return { speed: p.speed, wins: p.wins, rebirths: p.rebirths };
}
