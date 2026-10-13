import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { legionAuthHandler } from './auth/legionAuth.js';
import { legionWebhookHandler } from './webhooks/legionWebhook.js';
import { loadProfiles, flushProfiles, computeLeaderboards } from './game/profiles.js';
import { startStatsReporter } from './game/statsReporter.js';
import { StartingPlaceRoom, onlineLegionRecords } from './rooms/StartingPlaceRoom.js';
import { ROOM_NAME } from './shared/gameData.js';

const PORT = Number(process.env.PORT || 2567);
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

loadProfiles();

const app = express();
app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin) || origins.includes('*')) }));
app.use(express.json({ limit: '64kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.post('/api/legion-auth', legionAuthHandler);
app.post('/api/webhook/legion', legionWebhookHandler);
app.get('/api/leaderboards', (_req, res) => res.json(computeLeaderboards()));

const server = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server }) });
gameServer.define(ROOM_NAME, StartingPlaceRoom);

const stats = startStatsReporter(onlineLegionRecords);

server.listen(PORT, () => console.log(`[server] Speed Kart Escape listening on :${PORT}`));

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] ${signal} — flushing and shutting down`);
  stats.stop();
  await stats.flush();
  flushProfiles();
  await gameServer.gracefullyShutdown(false).catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
