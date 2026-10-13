// Thin wrapper around window.Legion.SDK (the Bloxity SDK).
// Every call is guarded so the game still runs when the SDK script is blocked or
// when developing locally without the portal.

import { GAME_SLUG } from '../shared/gameData.js';

export const SLUG = import.meta.env.VITE_GAME_SLUG || GAME_SLUG;

const sdk = () => window.Legion?.SDK || null;
let initialized = false;

export function initLegion() {
  const s = sdk();
  if (!s || initialized) return !!s;
  try {
    s.init({ gameSlug: SLUG });
    initialized = true;
  } catch (err) {
    console.warn('[bloxity] init failed', err);
  }
  return initialized;
}

export const hasSdk = () => !!sdk();

// --- auth ------------------------------------------------------------------

export function onUserChanged(cb) {
  const s = sdk();
  if (!s?.auth?.onUserChanged) {
    cb(null);
    return () => {};
  }
  return s.auth.onUserChanged(cb);
}

// init() returns before the portal answers, so give the login callback a moment
// to report a signed-in user before falling back to guest play.
export function waitForUser(timeoutMs = 2500) {
  return new Promise((resolve) => {
    if (!sdk()?.auth?.onUserChanged) return resolve(null);
    let off = () => {};
    const timer = setTimeout(() => {
      off();
      resolve(getUser());
    }, timeoutMs);
    off = onUserChanged((user) => {
      if (!user) return;
      clearTimeout(timer);
      queueMicrotask(() => off());
      resolve(user);
    });
  });
}

export const getUser = () => sdk()?.auth?.getUser?.() || null;
export const getGuest = () => sdk()?.auth?.getGuest?.() || null;
export const showAuthPopup = () => sdk()?.auth?.showAuthPopup?.();

export function currentIdentity() {
  const user = getUser();
  if (user) return { ...user, isGuest: false };
  const guest = getGuest();
  if (guest) return { ...guest, isGuest: true };
  let name = 'Guest';
  try {
    name = localStorage.getItem('ske_guest_name') || `Racer${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem('ske_guest_name', name);
  } catch {
    /* storage unavailable */
  }
  return { username: name, displayName: name, isGuest: true, avatar: null };
}

export async function authenticateWithServer(url) {
  const s = sdk();
  if (!s?.auth?.authenticateWithServer || !getUser()) return null;
  try {
    return await s.auth.authenticateWithServer(url);
  } catch (err) {
    console.warn('[bloxity] server handshake failed', err);
    return null;
  }
}

// --- avatar ----------------------------------------------------------------

export function getAvatarData() {
  const s = sdk();
  const user = getUser();
  if (s?.avatar && user) {
    return {
      equipped: s.avatar.getEquipped?.() || {},
      proportions: s.avatar.getProportions?.() || {},
      skinUrl: s.avatar.getSkinTextureUrl?.() || null,
      pfp: user.pfp || null,
    };
  }
  const guest = getGuest();
  const av = guest?.avatar || {};
  return {
    equipped: av.equipped || av,
    proportions: av.proportions || {},
    skinUrl: null,
    pfp: guest?.pfp || null,
  };
}

export function onAvatarChanged(cb) {
  const s = sdk();
  const offs = [];
  if (s?.avatar?.onAvatarChanged) offs.push(s.avatar.onAvatarChanged(() => cb()));
  if (s?.avatar?.onProportionsChanged) offs.push(s.avatar.onProportionsChanged(() => cb()));
  return () => offs.forEach((off) => typeof off === 'function' && off());
}

// --- game lifecycle --------------------------------------------------------

export const loadingStep = (text) => sdk()?.game?.loadingStep?.(text);
export const loadingEnd = () => sdk()?.game?.loadingEnd?.();
export const gameplayStart = () => sdk()?.game?.gameplayStart?.();
export const gameplayEnd = () => sdk()?.game?.gameplayEnd?.();
export const updateRoom = (roomId) => sdk()?.game?.updateRoom?.(roomId || '');

export function onPlayerEvent(cb) {
  const s = sdk();
  if (!s?.player?.onEvent) return () => {};
  return s.player.onEvent(cb);
}

// --- settings --------------------------------------------------------------

export function listenSetting(key, cb) {
  const s = sdk();
  if (!s?.settings?.listen) return () => {};
  return s.settings.listen(key, cb);
}

// --- gems ------------------------------------------------------------------

export async function requestPurchase(sku, legionId) {
  const s = sdk();
  if (!s?.gems?.requestPurchase) return { success: false, error: 'Gems are only available on Bloxity' };
  if (!getUser()) {
    showAuthPopup();
    return { success: false, error: 'Log in to buy with Gems' };
  }
  try {
    return await s.gems.requestPurchase(sku, { metadata: { sku, legionId } });
  } catch (err) {
    return { success: false, error: err?.message || 'Purchase failed' };
  }
}

export async function getGemBalance() {
  try {
    return (await sdk()?.gems?.getBalance?.()) ?? 0;
  } catch {
    return 0;
  }
}

// --- multiplayer -----------------------------------------------------------

export async function resolveEndpoint() {
  const s = sdk();
  if (!s?.net?.resolveEndpoint) throw new Error('Bloxity SDK net unavailable');
  return s.net.resolveEndpoint(SLUG, { userId: getUser()?._id });
}

// --- social ----------------------------------------------------------------

// Opens Bloxity's own invite UI when available. Returns false if the caller should
// show the game's fallback invite popup instead.
export function inviteFriends() {
  const s = sdk();
  try {
    if (s?.social?.inviteFriend) {
      s.social.inviteFriend();
      return true;
    }
  } catch {
    /* fall back to our own popup */
  }
  return false;
}

export function inviteLink() {
  try {
    const l = sdk()?.social?.getInviteFriendsLink?.();
    if (typeof l === 'string' && l) return l;
  } catch {
    /* ignore */
  }
  return `https://bloxity.io/g/${SLUG}`;
}
