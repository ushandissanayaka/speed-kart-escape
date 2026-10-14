// Thin wrapper around window.Legion.SDK (the Bloxity SDK).
// Every call is guarded so the game still runs when the SDK script is blocked or
// when developing locally without the portal.

import { GAME_SLUG } from '../shared/gameData.js';

export const SLUG = import.meta.env.VITE_GAME_SLUG || GAME_SLUG;
// Boxity hosting id (<id>.host.bloxity.io) used by net.resolveEndpoint when hosted.
export const HOSTING_ID = import.meta.env.VITE_BLOXITY_HOSTING_ID || SLUG;

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
const safe = (fn) => {
  try {
    return fn();
  } catch (err) {
    console.warn('[bloxity]', err);
    return undefined;
  }
};
// friend-join toasts: playerInRoom for players already there when we join,
// playerJoined for players who arrive afterwards
export const playerJoined = (username) => username && safe(() => sdk()?.game?.playerJoined?.(username));
export const playerInRoom = (username) => username && safe(() => sdk()?.game?.playerInRoom?.(username));
// features the portal should show UI for (emotes); call on boot
export const registerFeature = (name) => safe(() => sdk()?.game?.registerFeature?.(name));

// --- portal ----------------------------------------------------------------

export const showMenu = (relock = true) => safe(() => sdk()?.portal?.showMenu?.(relock));
export const requestFullscreen = () => safe(() => sdk()?.portal?.requestFullscreen?.());
export const exitFullscreen = () => safe(() => document.fullscreenElement && sdk()?.portal?.exitFullscreen?.());

// --- chat (Boxity draws the chat box; we show bubbles over the players) ----

export function onChatMessage(cb) {
  const c = sdk()?.chat;
  if (!c?.onMessage) return () => {};
  return c.onMessage(cb);
}
export function attachChatBubble(THREE, root, message) {
  const c = sdk()?.chat;
  if (!c?.attachBubble) return;
  safe(() => c.attachBubble(THREE, root, c.bubbleText ? c.bubbleText(message) : message.text));
}

// --- party play (own servers) ----------------------------------------------

export const enableParty = (maxPartySize) => safe(() => sdk()?.party?.enable?.({ maxPartySize }));
export async function getPartyLaunch() {
  try {
    return (await sdk()?.party?.getLaunch?.()) || null;
  } catch {
    return null;
  }
}
export const partyJoined = (roomId) => safe(() => sdk()?.party?.joined?.(roomId));
export const partyFailed = (reason) => safe(() => sdk()?.party?.failed?.(reason));

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
export const triggerAllSettings = () => safe(() => sdk()?.settings?.triggerAll?.());

// --- gems ------------------------------------------------------------------

// Legion.SDK.gems (Legion.SDK.bux is the older alias)
const gemsApi = () => sdk()?.gems || sdk()?.bux || null;

// Server-authoritative: pass ONLY the sku. The price comes from the Boxity catalog;
// the item is granted by the webhook on our server (keyed by transactionId).
export async function requestPurchase(sku) {
  const g = gemsApi();
  if (!g?.requestPurchase) return { success: false, error: 'Gems are only available on Bloxity' };
  if (!getUser()) {
    showAuthPopup();
    return { success: false, error: 'Log in to buy with Gems' };
  }
  try {
    return await g.requestPurchase(sku);
  } catch (err) {
    return { success: false, error: err?.message || 'Purchase failed' };
  }
}

export async function getGemBalance() {
  try {
    return (await gemsApi()?.getBalance?.()) ?? 0;
  } catch {
    return 0;
  }
}

// --- multiplayer -----------------------------------------------------------

export async function resolveEndpoint() {
  const s = sdk();
  if (!s?.net?.resolveEndpoint) throw new Error('Bloxity SDK net unavailable');
  return s.net.resolveEndpoint(HOSTING_ID);
}

// --- social ----------------------------------------------------------------

// social.inviteFriend needs a friend's user id, so the Invite button opens our own
// popup with the share link (getInviteFriendsLink). Returns false = show the popup.
export function inviteFriends() {
  return false;
}

export async function inviteFriend(userId, roomId) {
  const s = sdk();
  if (!s?.social?.inviteFriend || !userId) return false;
  if (roomId) updateRoom(roomId); // the friend should land in our room
  try {
    return !!(await s.social.inviteFriend(userId));
  } catch {
    return false;
  }
}

export async function getFriends() {
  try {
    return (await sdk()?.social?.getFriends?.()) || [];
  } catch {
    return [];
  }
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
