// Reports Speed / Wins / Rebirths / Level to Bloxity player profiles.
// POST https://api.bloxity.io/v1/games/{BLOXITY_GAME_ID}/stats — values come only from
// server-owned profiles, guests are skipped, batches are capped at 200 players.

const API_URL = (process.env.LEGION_API_URL || 'https://api.bloxity.io').replace(/\/$/, '');
const INTERVAL_MS = 60_000;
const BATCH = 200;

const DEFINITIONS = [
  { key: 'speed', label: 'Speed', type: 'number', sortOrder: 1 },
  { key: 'wins', label: 'Wins', type: 'number', sortOrder: 2 },
  { key: 'rebirths', label: 'Rebirths', type: 'number', sortOrder: 3 },
  { key: 'level', label: 'Level', type: 'number', sortOrder: 4 },
];
const CEILING = 1_000_000_000; // ceiling for type "number"

const valid = (v) => Number.isFinite(v) && v >= 0 && v <= CEILING;

function toUserId(legionId) {
  const id = String(legionId).split('#m')[0];
  return id.startsWith('legion_') ? id : `legion_${id}`;
}

async function send(players) {
  const gameId = process.env.BLOXITY_GAME_ID;
  const token = process.env.BLOXITY_REPORT_TOKEN;
  if (!gameId || !token || players.length === 0) return;
  for (let i = 0; i < players.length; i += BATCH) {
    try {
      const res = await fetch(`${API_URL}/v1/games/${encodeURIComponent(gameId)}/stats`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ definitions: DEFINITIONS, players: players.slice(i, i + BATCH) }),
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      if (!res.ok) console.warn(`[stats] ${res.status}: ${text}`);
      else console.log(`[stats] ${text}`);
    } catch (err) {
      console.warn('[stats] report failed:', err.message);
    }
  }
}

function collect(getOnlineLegionRecords) {
  const players = [];
  for (const { legionId, profile } of getOnlineLegionRecords()) {
    const values = {};
    for (const key of ['speed', 'wins', 'rebirths', 'level']) {
      const v = Math.floor(profile[key]);
      if (valid(v)) values[key] = v;
    }
    if (Object.keys(values).length) players.push({ userId: toUserId(legionId), values });
  }
  return players;
}

// `getOnlineLegionRecords` returns [{ legionId, profile }] for logged-in players currently online.
export function startStatsReporter(getOnlineLegionRecords) {
  if (!process.env.BLOXITY_GAME_ID || !process.env.BLOXITY_REPORT_TOKEN) {
    console.log('[stats] BLOXITY_GAME_ID / BLOXITY_REPORT_TOKEN not set — stat reporting disabled');
    return { flush: async () => {}, stop: () => {} };
  }
  const timer = setInterval(() => {
    send(collect(getOnlineLegionRecords)).catch(() => {});
  }, INTERVAL_MS);
  return {
    flush: () => send(collect(getOnlineLegionRecords)).catch(() => {}),
    stop: () => clearInterval(timer),
  };
}
