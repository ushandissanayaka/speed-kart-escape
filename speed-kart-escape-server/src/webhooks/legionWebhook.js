// Bloxity Gems fulfillment webhook.
//
// Bloxity deducts Gems, then POSTs the transaction here. We must answer 2xx within
// 10 seconds or the player is refunded; a 4xx refunds immediately without retry.
// Retries can deliver the same transaction twice, so grants are de-duplicated by transactionId.

import crypto from 'node:crypto';
import { findRecord, getRecord, flushProfiles, useMongo, recordGrant } from '../game/profiles.js';
import { GEM_PRODUCTS, applyGemProduct } from '../shared/gameData.js';
import { notifyProfileChanged } from '../rooms/StartingPlaceRoom.js';

function secretMatches(header) {
  const expected = process.env.LEGION_WEBHOOK_SECRET;
  if (!expected) return true;
  const a = Buffer.from(String(header || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Field names are read defensively: the transaction carries sku, user, amount and
// the metadata we passed to requestPurchase().
function parse(body) {
  const tx = body?.transaction || body?.data || body || {};
  const meta = tx.metadata || body?.metadata || {};
  const user = tx.user || body?.user || {};
  return {
    sku: tx.sku || tx.itemSku || tx.item?.sku || meta.sku,
    transactionId: String(tx.transactionId || tx.transaction_id || tx.id || body?.transactionId || ''),
    legionId: String(tx.userId || tx.legionId || user._id || user.id || meta.legionId || '').replace(/^legion_/, ''),
  };
}

export async function legionWebhookHandler(req, res) {
  if (!secretMatches(req.get('x-legion-webhook-secret'))) {
    return res.status(401).json({ error: 'Bad webhook secret' });
  }
  const { sku, transactionId, legionId } = parse(req.body);
  if (!sku || !GEM_PRODUCTS[sku]) return res.status(400).json({ error: 'Unknown sku' });
  if (!legionId) return res.status(400).json({ error: 'Missing user' });
  if (!transactionId) return res.status(400).json({ error: 'Missing transactionId' });

  // Boxity hosting (many pods): this may not be the buyer's pod. Record the grant in
  // MongoDB keyed by transactionId and answer 2xx; the pod holding the player applies
  // it within a few seconds (see applyPendingGrants in index.js).
  if (useMongo) {
    try {
      const r = await recordGrant({ transactionId, legionId, sku });
      console.log(`[webhook] ${sku} -> ${legionId} (${transactionId}) recorded${r.duplicate ? ' (duplicate)' : ''}`);
      return res.json({ ok: true });
    } catch (err) {
      console.error('[webhook] could not record grant:', err.message);
      return res.status(500).json({ error: 'Storage unavailable' }); // Boxity retries
    }
  }

  const record = findRecord(legionId) || getRecord(legionId);
  const result = applyGemProduct(record.profile, sku, transactionId);
  if (!result.ok) return res.status(400).json({ error: result.error });

  flushProfiles();
  if (!result.duplicate) notifyProfileChanged(legionId, result.toast);
  console.log(`[webhook] ${sku} -> ${legionId} (${transactionId})${result.duplicate ? ' duplicate' : ''}`);
  res.json({ ok: true });
}
