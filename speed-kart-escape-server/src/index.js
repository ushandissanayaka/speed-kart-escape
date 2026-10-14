import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { legionAuthHandler } from './auth/legionAuth.js';
import { legionWebhookHandler } from './webhooks/legionWebhook.js';
import { loadProfiles, flushProfiles, computeLeaderboards, findRecord, pendingGrants, markGrantApplied, scheduleSave, useMongo } from './game/profiles.js';
import { startStatsReporter } from './game/statsReporter.js';
import { StartingPlaceRoom, onlineLegionRecords, onlineLegionIds, notifyProfileChanged, SEAT_CAP } from './rooms/StartingPlaceRoom.js';
import { applyGemProduct } from './shared/gameData.js';
import { ROOM_NAME } from './shared/gameData.js';

const PORT = Number(process.env.PORT || 2567);
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

await loadProfiles();

const app = express();
// Bloxity serves the client from *.play.bloxity.io / bloxity.io: always allow those.
const isBloxity = (origin) => {
  try {
    const h = new URL(origin).hostname;
    return h === 'bloxity.io' || h.endsWith('.bloxity.io');
  } catch {
    return false;
  }
};
app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin) || origins.includes('*') || isBloxity(origin)) }));
app.use(express.json({ limit: '64kb' }));

// Must stay fast: Boxity Legion probes it.
app.get('/health', (_req, res) => res.json({ ok: true, version: process.env.APP_VERSION || 'dev', seatCap: SEAT_CAP }));
app.post('/api/legion-auth', legionAuthHandler);
app.post('/api/webhook/legion', legionWebhookHandler);
app.get('/api/leaderboards', (_req, res) => res.json(computeLeaderboards()));

const server = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server }) });
// filterBy partyKey: a Boxity party (own servers) shares one room strangers can't join
gameServer.define(ROOM_NAME, StartingPlaceRoom).filterBy(['partyKey']);

const stats = startStatsReporter(onlineLegionRecords);

// Gems grants recorded by the webhook (on any pod): apply the ones for players on
// this pod. The profile is saved before the grant is marked applied, and
// applyGemProduct skips a transactionId it has already seen, so nothing is lost or
// granted twice.
let applying = false;
async function applyPendingGrants() {
  if (!useMongo || applying) return;
  applying = true;
  try {
    const grants = await pendingGrants(onlineLegionIds());
    for (const g of grants) {
      const rec = findRecord(g.legionId);
      if (!rec) continue;
      const result = applyGemProduct(rec.profile, g.sku, String(g._id));
      scheduleSave(g.legionId);
      await flushProfiles();
      await markGrantApplied(g._id);
      if (result.ok && !result.duplicate) notifyProfileChanged(g.legionId, result.toast);
      console.log(`[grants] ${g.sku} -> ${g.legionId} (${g._id}) applied`);
    }
  } catch (err) {
    console.error('[grants] apply failed:', err.message);
  } finally {
    applying = false;
  }
}
if (useMongo) setInterval(applyPendingGrants, 3000).unref();

server.listen(PORT, () => console.log(`[server] Speed Kart Escape listening on :${PORT} (seatCap ${SEAT_CAP}, ${useMongo ? 'MongoDB' : 'file'} storage)`));

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} — flushing and shutting down`);
  stats.stop();
  await stats.flush();
  await gameServer.gracefullyShutdown(false).catch(() => {});
  await flushProfiles().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
