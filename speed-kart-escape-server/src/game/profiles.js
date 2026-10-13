// Player profile persistence. Logged-in Bloxity players are saved to a JSON file;
// guests live in memory for the length of their session only.

import fs from 'node:fs';
import path from 'node:path';
import { mergeLeaderboard, newProfile, normalizeProfile } from '../shared/gameData.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const FILE = path.join(DATA_DIR, 'profiles.json');
const SAVE_DEBOUNCE_MS = 3000;

// legionId -> { profile, name, avatar }
const records = new Map();
let saveTimer = null;

export function loadProfiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    for (const [id, rec] of Object.entries(raw)) {
      records.set(id, { name: rec.name || 'Player', avatar: rec.avatar || null, profile: normalizeProfile(rec.profile) });
    }
    console.log(`[profiles] loaded ${records.size} profiles`);
  } catch (err) {
    console.error('[profiles] could not read profiles file:', err.message);
  }
}

function writeNow() {
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

export function scheduleSave() {
  if (!saveTimer) saveTimer = setTimeout(writeNow, SAVE_DEBOUNCE_MS);
}

export function flushProfiles() {
  if (saveTimer) clearTimeout(saveTimer);
  writeNow();
}

export function getRecord(legionId, name) {
  let rec = records.get(legionId);
  if (!rec) {
    rec = { name: name || 'Player', avatar: null, profile: newProfile() };
    records.set(legionId, rec);
    scheduleSave();
  } else if (name && rec.name !== name) {
    rec.name = name;
    scheduleSave();
  }
  return rec;
}

export function findRecord(legionId) {
  return records.get(legionId) || null;
}

const BOARD_STATS = ['speed', 'wins', 'rebirths'];

// Top 9 per stat across every saved profile, merged with live guest values.
export function computeLeaderboards(liveGuests = []) {
  const rows = [];
  for (const [id, rec] of records) rows.push({ id, name: rec.name, avatar: rec.avatar, ...pick(rec.profile) });
  for (const g of liveGuests) rows.push(g);
  const boards = {};
  for (const stat of BOARD_STATS) {
    const live = rows.filter((r) => r[stat] > 0).map((r) => ({ name: r.name, value: r[stat], avatar: r.avatar }));
    boards[stat] = mergeLeaderboard(stat, live);
  }
  return boards;
}

function pick(p) {
  return { speed: p.speed, wins: p.wins, rebirths: p.rebirths };
}

export function allRecords() {
  return records;
}
