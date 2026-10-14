// Player profile persistence.
//
// - MONGODB_URI set (Boxity hosting, many pods): profiles, leaderboards and Gems grants
//   live in MongoDB so every pod sees the same data. Each pod keeps a cache of the
//   players it holds and writes changes back every few seconds.
// - No MONGODB_URI (local dev / single server): logged-in players are saved to a JSON
//   file, exactly as before.
// Guests are never saved on the server.

import fs from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { mergeLeaderboard, newProfile, normalizeProfile } from '../shared/gameData.js';

const MONGO_URI = process.env.MONGODB_URI || '';
export const useMongo = !!MONGO_URI;

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const FILE = path.join(DATA_DIR, 'profiles.json');
const SAVE_DEBOUNCE_MS = 3000;
const FLUSH_MS = 3000; // MongoDB write-back interval
const TOPS_MS = 30_000; // leaderboard refresh from MongoDB
const CACHE_MAX = 5000; // cached profiles per pod before idle ones are dropped

const BOARD_STATS = ['speed', 'wins', 'rebirths'];

// legionId -> { profile, name, avatar }
const records = new Map();
let saveTimer = null;

// MongoDB state
let profilesCol = null;
let grantsCol = null;
const dirty = new Set();
let flushing = null;
let tops = { speed: [], wins: [], rebirths: [] };
let isOnline = () => false; // set by the room module: is this player connected to this pod?

export function setOnlineCheck(fn) {
  isOnline = fn;
}

export async function loadProfiles() {
  if (useMongo) {
    const client = new MongoClient(MONGO_URI, { maxPoolSize: 20 });
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'speed_kart_escape');
    profilesCol = db.collection('profiles');
    grantsCol = db.collection('gem_grants');
    await Promise.all([
      ...BOARD_STATS.map((s) => profilesCol.createIndex({ [`profile.${s}`]: -1 })),
      grantsCol.createIndex({ legionId: 1, applied: 1 }),
    ]);
    setInterval(() => flushProfiles().catch((err) => console.error('[profiles] flush failed:', err.message)), FLUSH_MS).unref();
    setInterval(() => refreshTops().catch(() => {}), TOPS_MS).unref();
    await refreshTops().catch(() => {});
    console.log('[profiles] using MongoDB');
    return;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    for (const [id, rec] of Object.entries(raw)) {
      records.set(id, { name: rec.name || 'Player', avatar: rec.avatar || null, profile: normalizeProfile(rec.profile) });
    }
    console.log(`[profiles] loaded ${records.size} profiles from file`);
  } catch (err) {
    console.error('[profiles] could not read profiles file:', err.message);
  }
}

// --- file backend -----------------------------------------------------------

function writeFileNow() {
  saveTimer = null;
  const out = {};
  for (const [id, rec] of records) out[id] = rec;
  const tmp = FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(out));
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error('[profiles] save failed:', err.message);
  }
}

// --- shared API ---------------------------------------------------------------

// Mark a profile as changed. With MongoDB only that player's document is written.
export function scheduleSave(legionId) {
  if (useMongo) {
    if (legionId) dirty.add(legionId);
    return;
  }
  if (!saveTimer) saveTimer = setTimeout(writeFileNow, SAVE_DEBOUNCE_MS);
}

export async function flushProfiles() {
  if (!useMongo) {
    if (saveTimer) clearTimeout(saveTimer);
    writeFileNow();
    return;
  }
  if (flushing) return flushing;
  const ids = [...dirty];
  dirty.clear();
  const ops = [];
  for (const id of ids) {
    const rec = records.get(id);
    if (rec) ops.push({ updateOne: { filter: { _id: id }, update: { $set: { name: rec.name, avatar: rec.avatar, profile: rec.profile, updatedAt: new Date() } }, upsert: true } });
  }
  if (!ops.length) return;
  flushing = profilesCol
    .bulkWrite(ops, { ordered: false })
    .catch((err) => {
      for (const id of ids) dirty.add(id); // retry next time
      throw err;
    })
    .finally(() => {
      flushing = null;
      evictIdle();
    });
  return flushing;
}

// Keep the per-pod cache bounded: drop saved profiles of players who left.
function evictIdle() {
  if (records.size <= CACHE_MAX) return;
  for (const id of records.keys()) {
    if (records.size <= CACHE_MAX * 0.8) break;
    if (!dirty.has(id) && !isOnline(id)) records.delete(id);
  }
}

// Load a player's profile when they join. With MongoDB the stored copy is read fresh
// (they may have played on another pod since), unless this pod still has unsaved changes.
export async function loadRecord(legionId, name) {
  if (useMongo && !dirty.has(legionId) && !isOnline(legionId)) {
    const doc = await profilesCol.findOne({ _id: legionId });
    if (doc) records.set(legionId, { name: doc.name || name || 'Player', avatar: doc.avatar || null, profile: normalizeProfile(doc.profile) });
  }
  return getRecord(legionId, name);
}

export function getRecord(legionId, name) {
  let rec = records.get(legionId);
  if (!rec) {
    rec = { name: name || 'Player', avatar: null, profile: newProfile() };
    records.set(legionId, rec);
    scheduleSave(legionId);
  } else if (name && rec.name !== name) {
    rec.name = name;
    scheduleSave(legionId);
  }
  return rec;
}

export function findRecord(legionId) {
  return records.get(legionId) || null;
}

export function allRecords() {
  return records;
}

// --- leaderboards -------------------------------------------------------------

async function refreshTops() {
  const next = {};
  for (const stat of BOARD_STATS) {
    const docs = await profilesCol
      .find({ [`profile.${stat}`]: { $gt: 0 } }, { projection: { name: 1, avatar: 1, profile: 1 } })
      .sort({ [`profile.${stat}`]: -1 })
      .limit(9)
      .toArray();
    next[stat] = docs.map((d) => ({ id: d._id, name: d.name || 'Player', avatar: d.avatar || null, ...pick(d.profile || {}) }));
  }
  tops = next;
}

// Top 9 per stat (all players across all pods when using MongoDB), merged with live values.
export function computeLeaderboards(liveGuests = []) {
  const byId = new Map();
  if (useMongo) for (const stat of BOARD_STATS) for (const r of tops[stat]) byId.set(r.id, r);
  for (const [id, rec] of records) byId.set(id, { id, name: rec.name, avatar: rec.avatar, ...pick(rec.profile) });
  const rows = [...byId.values(), ...liveGuests];
  const boards = {};
  for (const stat of BOARD_STATS) {
    const live = rows.filter((r) => r[stat] > 0).map((r) => ({ name: r.name, value: r[stat], avatar: r.avatar }));
    boards[stat] = mergeLeaderboard(stat, live);
  }
  return boards;
}

function pick(p) {
  return { speed: p.speed || 0, wins: p.wins || 0, rebirths: p.rebirths || 0 };
}

// --- Gems grants (MongoDB) -------------------------------------------------------
// The Boxity webhook can land on any pod, not the buyer's. It records the grant here
// (transactionId is the _id, so a retried webhook is a no-op) and answers 2xx; each
// pod applies unapplied grants for the players it holds.

export async function recordGrant({ transactionId, legionId, sku }) {
  try {
    await grantsCol.insertOne({ _id: transactionId, legionId, sku, applied: false, at: new Date() });
    return { ok: true };
  } catch (err) {
    if (err?.code === 11000) return { ok: true, duplicate: true };
    throw err;
  }
}

export async function pendingGrants(legionIds) {
  if (!useMongo || !legionIds.length) return [];
  return grantsCol.find({ legionId: { $in: legionIds }, applied: false }).limit(200).toArray();
}

export async function markGrantApplied(transactionId) {
  await grantsCol.updateOne({ _id: transactionId }, { $set: { applied: true, appliedAt: new Date() } });
}
