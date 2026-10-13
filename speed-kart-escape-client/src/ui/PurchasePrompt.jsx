/* eslint-disable react/prop-types */
// Legion-style purchase popup (modelled on the platform's "Buy item" dialog): dark
// card, item icon + name + Gem price, the player's Gem balance, a big blue Buy
// button and a small terms line. Opens for every Gems purchase, e.g. when a kart
// drives onto a purple "Skip Stage" pad.
import { useEffect, useState } from 'react';
import { GEM_PRODUCTS, formatNumber } from '../shared/gameData.js';
import * as legion from '../bloxity/legion.js';
import { GemIcon } from './icons/Icons.jsx';

export function PurchasePrompt({ game }) {
  const [req, setReq] = useState(null); // { sku, resolve }
  const [balance, setBalance] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(
    () =>
      game.events.on('purchasePrompt', (r) => {
        // Only one prompt at a time; a newer request cancels the older one.
        setReq((old) => {
          old?.resolve({ success: false, error: 'User cancelled' });
          return r;
        });
        setBusy(false);
        setError('');
        setBalance(null);
        legion.getGemBalance().then(setBalance);
      }),
    [game]
  );

  useEffect(() => {
    if (!req) return undefined;
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!req) return null;
  const prod = GEM_PRODUCTS[req.sku] || { name: req.sku, displayPrice: 0 };

  function close(result = { success: false, error: 'User cancelled' }) {
    req.resolve(result);
    setReq(null);
  }

  async function buy() {
    setBusy(true);
    setError('');
    const res = await game.confirmPurchase(req.sku);
    setBusy(false);
    if (res?.success) close(res);
    else if (res?.error && res.error !== 'User cancelled') setError(res.error);
  }

  return (
    <div className="lp-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="lp-card">
        <div className="lp-head">
          <span className="lp-title">Buy item</span>
          <span className="lp-balance">
            <GemIcon /> {balance === null ? '…' : formatNumber(balance)}
          </span>
          <button className="lp-x" onClick={() => close()} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="lp-item">
          <div className="lp-thumb">
            <img src="./legion-logo.png" alt="" />
          </div>
          <div>
            <div className="lp-name">{prod.name}</div>
            <div className="lp-price">
              <GemIcon /> {formatNumber(prod.displayPrice)}
            </div>
          </div>
        </div>

        <div className="lp-row">
          <span>
            <GemIcon /> {formatNumber(prod.displayPrice)} Gems
          </span>
          <span className="lp-row-note">Legion Gems</span>
        </div>

        {error && <div className="lp-error">{error}</div>}

        <button className="lp-buy" disabled={busy} onClick={buy}>
          {busy ? 'Processing…' : 'Buy'}
        </button>
        <div className="lp-terms">
          Your Gems will be charged. Legion <u>Terms of Use</u> apply.
        </div>
      </div>
    </div>
  );
}
