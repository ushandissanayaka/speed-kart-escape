// Bloxity (Legion) login handshake.
//
// The client calls `Legion.SDK.auth.authenticateWithServer(<this server>/api/legion-auth)`,
// which POSTs `{ token, user }`. We verify the Bloxity JWT, then hand back our own
// short-lived HMAC session token that the client passes when joining a Colyseus room.

import crypto from 'node:crypto';

const API_URL = (process.env.LEGION_API_URL || 'https://api.bloxity.io').replace(/\/$/, '');
const VERIFY_PATH = process.env.LEGION_VERIFY_PATH || '/v1/social/profile';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.startsWith('change-me')) {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[auth] SESSION_SECRET not set — using a random secret (sessions reset on restart).');
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function pickId(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return obj._id || obj.id || obj.userId || obj.user?._id || obj.user?.id || obj.profile?._id || null;
}

// Verifies the token by calling the Bloxity API on the player's behalf: the API only
// answers 2xx for a valid, unexpired token, and it tells us whose token it is.
export async function verifyLegionToken(token, claimedUser) {
  const payload = decodeJwtPayload(token);
  if (!payload) throw new Error('Malformed token');
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('Token expired');

  const res = await fetch(API_URL + VERIFY_PATH, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Bloxity rejected token (${res.status})`);
  const body = await res.json().catch(() => ({}));

  const legionId = String(payload.sub || pickId(body) || '');
  if (!legionId) throw new Error('Token has no subject');
  const apiId = pickId(body);
  if (apiId && String(apiId) !== legionId) throw new Error('Token subject mismatch');
  if (claimedUser?._id && String(claimedUser._id) !== legionId) throw new Error('User mismatch');

  const source = body.user || body.profile || body;
  return {
    legionId,
    username: String(source.username || claimedUser?.username || 'Player').slice(0, 32),
    displayName: String(source.displayName || claimedUser?.displayName || source.username || 'Player').slice(0, 32),
  };
}

export function signSession(identity) {
  const body = b64url(JSON.stringify({ ...identity, exp: Date.now() + SESSION_TTL_MS }));
  const sig = b64url(crypto.createHmac('sha256', sessionSecret).update(body).digest());
  return `${body}.${sig}`;
}

export function readSession(sessionToken) {
  const [body, sig] = String(sessionToken || '').split('.');
  if (!body || !sig) return null;
  const expected = b64url(crypto.createHmac('sha256', sessionSecret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// Express handler for POST /api/legion-auth
export async function legionAuthHandler(req, res) {
  const { token, user } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });
  try {
    const identity = await verifyLegionToken(token, user);
    res.json({ sessionToken: signSession(identity), ...identity });
  } catch (err) {
    console.warn('[auth] handshake failed:', err.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
}
