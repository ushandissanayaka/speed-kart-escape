/* eslint-disable react/prop-types */
// Popups, modelled on the reference recording: coloured studded header with icon and
// title, a red X, a light studded body, and coloured cards with outlined text.
import { useEffect, useState } from 'react';
import {
  BoostsIcon,
  CoinIcon,
  FastForwardIcon,
  FriendsIcon,
  GemIcon,
  GiftIcon,
  KartsIcon,
  OrbIcon,
  PotionIcon,
  PotionsIcon,
  QuestsIcon,
  RebirthIcon,
  ShoeIcon,
  TrailArt,
  TrailsIcon,
  TrophyIcon,
  WarnIcon,
  WorldsIcon,
  XIcon,
} from '../icons/Icons.jsx';
import {
  BOOSTS,
  GEM_PRODUCTS,
  KARTS,
  POTIONS,
  QUESTS,
  TRAILS,
  TUNING,
  boostCost,
  boostMult,
  canRebirth,
  formatClock,
  formatNumber,
  maxLevel,
  maxLevelFor,
  merchantStatus,
  msUntilDailyReset,
  playtimeState,
  questProgress,
  rebirthCoins,
  rebirthMultiplier,
} from '../../shared/gameData.js';
import * as legion from '../../bloxity/legion.js';
import { sfx } from '../../game/audio/Sfx.js';

function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export function Modal({ theme, icon, title, right, onClose, above, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="panel-wrap">
      {above && <div className="panel-above">{above}</div>}
      <div className={`panel t-${theme}`}>
        <div className="panel-head">
          {icon && <div className="ph-icon">{icon}</div>}
          <span className="ttl o">{title}</span>
          {right && <span className="ph-right o">{right}</span>}
          <button
            className="panel-close press"
            onClick={() => {
              sfx.click();
              onClose();
            }}
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );
}

const Btn = ({ color = 'green', className = '', children, ...rest }) => (
  <button className={`gbtn press o c-${color} ${className}`} {...rest}>
    {children}
  </button>
);

// --- Rebirth -----------------------------------------------------------------
function RebirthPanel({ game, p, onClose }) {
  const max = maxLevel(p);
  const ready = canRebirth(p);
  const pct = Math.min(100, (p.level / max) * 100);
  return (
    <Modal
      theme="rebirth"
      icon={<RebirthIcon />}
      title="Rebirth"
      onClose={onClose}
      above={
        <>
          <div className="warn-line o red">
            <WarnIcon /> The rebirths resets your levels
          </div>
          <div className="warn-line o green">
            <BoostsIcon /> World 2 unlocks at {TUNING.world2Rebirths} rebirths!
          </div>
        </>
      }
    >
      <div className="rb-grid">
        <div className="rb-card lvl">
          <span className="rb-tag o">Level</span>
          <BoostsIcon />
          <span className="o">MAX {max}</span>
        </div>
        <div className="rb-arrow">
          <FastForwardIcon />
        </div>
        <div className="rb-card lvl">
          <span className="rb-tag o">Level</span>
          <BoostsIcon />
          <span className="o">MAX {maxLevelFor(p.rebirths + 1)}</span>
        </div>
        <div className="rb-card spd">
          <span className="rb-tag o">Speed</span>
          <ShoeIcon />
          <span className="o">x{rebirthMultiplier(p.rebirths)}</span>
        </div>
        <div className="rb-arrow">
          <FastForwardIcon />
        </div>
        <div className="rb-card spd">
          <span className="rb-tag o">Speed</span>
          <ShoeIcon />
          <span className="o">x{rebirthMultiplier(p.rebirths + 1)}</span>
        </div>
      </div>
      <div className="rb-req o">Required</div>
      <div className="rb-bar">
        <div className="fill" style={{ width: `${pct}%` }} />
        <span className="o">
          Level {p.level}/{max}
        </span>
      </div>
      <div className="rb-actions">
        <Btn color="purple" onClick={() => game.purchase('skip_rebirth')}>
          <span>Skip Rebirth</span>
          <small>
            <GemIcon /> {GEM_PRODUCTS.skip_rebirth.displayPrice}
          </small>
        </Btn>
        <Btn color={ready ? 'green' : 'grey'} onClick={() => game.action({ type: 'rebirth' })}>
          <span>Rebirth</span>
          <small>
            <CoinIcon /> +${formatNumber(rebirthCoins(p.rebirths))}
          </small>
        </Btn>
      </div>
    </Modal>
  );
}

// --- Daily Quests ----------------------------------------------------------------
function QuestsPanel({ game, p, onClose }) {
  useTick(30_000);
  const left = msUntilDailyReset(Date.now() + game.serverOffset);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return (
    <Modal theme="quests" icon={<QuestsIcon />} title="Daily Quests" right={`Resets in ${h}h ${m}m`} onClose={onClose}>
      {QUESTS.map((q) => {
        const prog = questProgress(p, q);
        const claimable = prog.done && !prog.claimed;
        return (
          <div className={`quest q-${q.color}`} key={q.id}>
            <div className="q-main">
              <div className="q-title o">{q.name}</div>
              <div className="q-sub o">
                {q.tier} - {q.sub}
              </div>
              <div className="q-bar">
                <div className="fill" style={{ width: `${(prog.value / prog.target) * 100}%` }} />
              </div>
              <span className="q-count o">
                {formatNumber(prog.value)} / {formatNumber(prog.target)}
              </span>
            </div>
            <Btn
              color={prog.claimed ? 'grey' : claimable ? 'gold' : 'green'}
              className={`q-reward${claimable ? ' claim' : ''}`}
              onClick={() => claimable && game.action({ type: 'claimQuest', id: q.id })}
            >
              {prog.claimed ? (
                'CLAIMED'
              ) : claimable ? (
                <>
                  <small>CLAIM</small>
                  <small>{q.rewardText}</small>
                </>
              ) : (
                q.rewardText
              )}
            </Btn>
          </div>
        );
      })}
    </Modal>
  );
}

// Gem particles floating around the trail art (positions from the reference).
const SPARKS = [[8, 36], [30, 120], [150, 14], [196, 70], [238, 30], [228, 140]];

// --- Trails ------------------------------------------------------------------------
function TrailsPanel({ game, p, onClose }) {
  return (
    <Modal theme="trails" icon={<TrailsIcon />} title="Trails" onClose={onClose}>
      <div className="scroll">
        {TRAILS.filter((t) => t.id !== 'none').map((t) => {
          const owned = p.ownedTrails.includes(t.id);
          const equipped = p.trail === t.id;
          return (
            <div className="item-card" key={t.id} style={{ '--g1': t.card[0], '--g2': t.card[1] }}>
              <div className="ic-art trail">
                <TrailArt c1={t.colors[0]} c2={t.colors[1]} ice={t.id === 'ice'} />
              </div>
              <div className="ic-band" />
              <div className="ic-name o">{t.name}</div>
              {SPARKS.map(([x, y], i) => (
                <span key={i} className="spark" style={{ '--i': i, left: `calc(${x}px * var(--s))`, top: `calc(${y}px * var(--s))`, background: t.colors[0] }} />
              ))}
              <div className="ic-stats o">
                <span>
                  <ShoeIcon /> x{t.boost.toFixed(1)} Speed Boost
                </span>
              </div>
              <div className="ic-buttons">
                {owned ? (
                  <Btn color={equipped ? 'green' : 'blue'} className="wide" onClick={() => !equipped && game.action({ type: 'equipTrail', id: t.id })}>
                    {equipped ? 'Equipped' : 'Equip'}
                  </Btn>
                ) : (
                  <>
                    <Btn color="gold" onClick={() => game.action({ type: 'buyTrail', id: t.id })}>
                      <CoinIcon /> {formatNumber(t.coins)}
                    </Btn>
                    <Btn color="green" onClick={() => game.purchase(`trail_${t.id}`)}>
                      <GemIcon /> {t.gems}
                    </Btn>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// --- Worlds -----------------------------------------------------------------------
function WorldsPanel({ p, onClose }) {
  return (
    <Modal theme="worlds" icon={<WorldsIcon />} title="Worlds" onClose={onClose}>
      <div className="world w-blue">
        <div>
          <div className="w-title o">World 1</div>
          <div className="w-sub o">Where everyone starts</div>
          <div className="w-mult o">x1 SPEED</div>
        </div>
        <Btn color="green" className="w-btn small">
          YOU ARE
          <br />
          HERE
        </Btn>
      </div>
      <div className="world w-purple">
        <div>
          <div className="w-title o">World 2</div>
          <div className="w-sub o">
            Needs {TUNING.world2Rebirths} rebirths - you have {p.rebirths}
          </div>
          <div className="w-mult o">x2 SPEED</div>
        </div>
        <Btn color="green" className="w-btn">
          {p.rebirths >= TUNING.world2Rebirths ? 'SOON' : 'LOCKED'}
        </Btn>
      </div>
    </Modal>
  );
}

// --- Karts -------------------------------------------------------------------------
function KartsPanel({ game, p, onClose }) {
  return (
    <Modal theme="karts" icon={<KartsIcon />} title="Karts" onClose={onClose}>
      <div className="scroll">
        {KARTS.map((k) => {
          const owned = p.ownedKarts.includes(k.id);
          const equipped = p.kart === k.id;
          return (
            <div className={`item-card kart k-${k.card}`} key={k.id}>
              <div className="ic-art kart">{game.kartThumbs?.[k.id] && <img src={game.kartThumbs[k.id]} alt="" draggable="false" />}</div>
              <div className="ic-name o">{k.name}</div>
              <div className="ic-stats o">
                <span>
                  <ShoeIcon /> x{k.speed < 10 ? k.speed.toFixed(1) : k.speed} Speed Boost
                </span>
                <span>
                  <CoinIcon /> x{k.coins} Coins Boost
                </span>
                <span>
                  <ShoeIcon /> Max {formatNumber(k.maxSpeed)} Speed
                </span>
              </div>
              <div className="ic-buttons">
                {owned ? (
                  <Btn color={equipped ? 'green' : 'blue'} className="wide" onClick={() => !equipped && game.action({ type: 'equipKart', id: k.id })}>
                    {equipped ? 'Equipped' : 'Equip'}
                  </Btn>
                ) : (
                  <Btn color="gold" className="wide" onClick={() => game.action({ type: 'buyKart', id: k.id })}>
                    <TrophyIcon /> {formatNumber(k.cost)}
                  </Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// --- Boosts ------------------------------------------------------------------------
const BOOST_ICON = { speed: <ShoeIcon />, coins: <CoinIcon />, wins: <TrophyIcon /> };
function BoostsPanel({ game, p, onClose }) {
  return (
    <Modal theme="boosts" icon={<BoostsIcon />} title="Boosts" onClose={onClose}>
      <div className="boost-cards">
        {BOOSTS.map((b) => {
          const lvl = p.boosts[b.id] || 0;
          return (
            <div className={`boost-card b-${b.id}`} key={b.id}>
              <div className="bc-icon">{BOOST_ICON[b.id]}</div>
              <div className="bc-name o">{b.name}</div>
              <div className="bc-mult o">x{boostMult(lvl).toFixed(1)}</div>
              <div className="bc-next o">NEXT x{boostMult(lvl + 1).toFixed(1)}</div>
              <div className="bc-desc o">{b.desc}</div>
              <Btn color="orange" onClick={() => game.action({ type: 'upgradeBoost', id: b.id })}>
                {formatNumber(boostCost(b, lvl))} COINS
              </Btn>
              <Btn color="purple" onClick={() => game.purchase(`boost_${b.id}`)}>
                <GemIcon /> {b.gems}
              </Btn>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// --- Playtime ----------------------------------------------------------------------
const PT_ICON = {
  orb: <OrbIcon />,
  orbs: <OrbIcon count={3} />,
  coin: <CoinIcon />,
  shoe: <ShoeIcon />,
  trophy: <TrophyIcon />,
  potions: <PotionsIcon />,
};
function PlaytimePanel({ game, onClose }) {
  useTick(1000);
  const items = playtimeState(game.playtime, Date.now() + game.serverOffset);
  return (
    <Modal theme="playtime" icon={<GiftIcon />} title="Playtime" onClose={onClose}>
      <div className="pt-note o">If you exit the game, the rewards will be reset!</div>
      <div className="pt-grid">
        {items.map((r) => (
          <button
            key={r.index}
            className={`pt-tile press pt-${r.color}${r.ready ? '' : ' locked'}${r.claimed ? ' claimed' : ''}`}
            onClick={() => r.ready && !r.claimed && game.action({ type: 'claimPlaytime', index: r.index })}
          >
            <span className="pt-label o">{r.label}</span>
            <span className="pt-icon">{PT_ICON[r.icon]}</span>
            <span className="pt-state o">{r.claimed ? 'Claimed' : r.ready ? 'Claim!' : formatClock(r.msLeft)}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// --- Merchant (potions) ------------------------------------------------------------
const POTION_COLORS = { speed2x: '#3ec7ff', coins2x: '#ffd21c', xp2x: '#9b3bff' };
function MerchantPanel({ game, p, onClose }) {
  useTick();
  const now = Date.now() + game.serverOffset;
  const m = merchantStatus(now);
  return (
    <Modal theme="rebirth" icon={<PotionIcon color="#3ec7ff" />} title="Merchant" right={m.present ? `50% off • ${formatClock(m.msLeft)}` : `Arrives in ${formatClock(m.msLeft)}`} onClose={onClose}>
      <div className="boost-cards">
        {POTIONS.map((po) => {
          const left = (p.potions?.[po.id] || 0) - now;
          const cost = m.present ? Math.ceil(po.cost / 2) : po.cost;
          return (
            <div className="boost-card b-speed" key={po.id}>
              <div className="bc-icon">
                <PotionIcon color={POTION_COLORS[po.id]} />
              </div>
              <div className="bc-name o">{po.name}</div>
              <div className="bc-desc o">{po.desc}</div>
              {left > 0 && <div className="bc-next o">Active {formatClock(left)}</div>}
              <Btn color="gold" onClick={() => game.action({ type: 'buyPotion', id: po.id })}>
                <CoinIcon /> {cost}
              </Btn>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// --- Gem shop ------------------------------------------------------------------------
function ShopPanel({ game, p, onClose }) {
  const [balance, setBalance] = useState(null);
  useEffect(() => {
    legion.getGemBalance().then(setBalance);
  }, []);
  const skus = ['speed_100k', 'speed_1m', 'speed_10m', 'pass_x2_wins', 'pass_x2_speed', 'mythical_treadmill', 'coins_500'];
  return (
    <Modal theme="karts" icon={<GemIcon />} title="Shop" right={`Gems: ${balance === null ? '…' : formatNumber(balance)}`} onClose={onClose}>
      <div className="boost-cards wrap">
        {skus.map((sku) => {
          const prod = GEM_PRODUCTS[sku];
          const owned = prod.grant.pass && p.passes?.[prod.grant.pass];
          return (
            <div className="boost-card b-coins" key={sku}>
              <div className="bc-icon">{prod.grant.coins ? <CoinIcon /> : prod.grant.pass === 'x2Wins' ? <TrophyIcon /> : <ShoeIcon />}</div>
              <div className="bc-name o">{prod.name}</div>
              <Btn color={owned ? 'grey' : 'purple'} onClick={() => !owned && game.purchase(sku)}>
                {owned ? (
                  'OWNED'
                ) : (
                  <>
                    <GemIcon /> {prod.displayPrice}
                  </>
                )}
              </Btn>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// --- Coins & Wins packs (opened from the + next to the counters) -------------------
const COIN_PACKS = ['coins_500', 'coins_2500', 'coins_10k', 'coins_50k'];
const WIN_PACKS = ['wins_500', 'wins_5k', 'wins_25k', 'wins_100k'];
function CurrencyPanel({ game, onClose }) {
  const pack = (sku, kind) => (
    <button key={sku} className={`pack press pk-${kind}`} onClick={() => game.purchase(sku)}>
      <span className="pk-icon">{kind === 'coins' ? <CoinIcon /> : <TrophyIcon />}</span>
      <span className="pk-text">
        <span className="pk-name o">{GEM_PRODUCTS[sku].name}</span>
        <span className="pk-price o">{GEM_PRODUCTS[sku].displayPrice} GEMS</span>
      </span>
    </button>
  );
  return (
    <Modal theme="rebirth" title="" onClose={onClose}>
      <div className="pack-grid">{COIN_PACKS.map((s) => pack(s, 'coins'))}</div>
      <div className="pack-grid gap">{WIN_PACKS.map((s) => pack(s, 'wins'))}</div>
    </Modal>
  );
}

// --- Invite friends (Bloxity) ------------------------------------------------------
// Your Bloxity friends with their status and an Invite button (Bloxity sends them an
// invite into this room), "Add Friend" for logged-in players in the room, and the
// share link.
const DEFAULT_PFP = 'https://static.bloxity.io/img/pfps/s0.png?width=128&quality=85&v=2';
const PRESENCE = {
  'in-game': ['#3dff6a', 'In game'],
  online: ['#3dc8ff', 'Online'],
  away: ['#ffc23d', 'Away'],
  offline: ['#9aa0b8', 'Offline'],
};
const PRESENCE_ORDER = { 'in-game': 0, online: 1, away: 2, offline: 3 };

function InvitePanel({ game, identity, onClose }) {
  const loggedIn = !!identity && !identity.isGuest;
  const [friends, setFriends] = useState(null);
  const [sent, setSent] = useState({}); // friend id -> 'sending' | 'sent' | 'failed'
  const [requests, setRequests] = useState({}); // player id -> 'sending' | 'pending' | 'accepted' | 'failed'
  const [copied, setCopied] = useState(false);
  const roomId = game.currentRoomId();
  const link = legion.inviteLink(roomId);

  useEffect(() => {
    if (!loggedIn) return undefined;
    let alive = true;
    const load = () => legion.getFriends().then((list) => alive && setFriends(Array.isArray(list) ? list : []));
    load();
    const timer = setInterval(load, 15000); // keep online status fresh
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [loggedIn]);

  const invite = async (f) => {
    setSent((m) => ({ ...m, [f._id]: 'sending' }));
    const ok = await legion.inviteFriend(f._id, roomId);
    setSent((m) => ({ ...m, [f._id]: ok ? 'sent' : 'failed' }));
    if (!ok) setTimeout(() => setSent((m) => ({ ...m, [f._id]: undefined })), 2500);
  };
  const addFriend = async (p) => {
    setRequests((m) => ({ ...m, [p.legionId]: 'sending' }));
    const res = await legion.sendFriendRequest(p.legionId);
    setRequests((m) => ({ ...m, [p.legionId]: res?.success ? res.status || 'pending' : 'failed' }));
  };

  const sorted = (friends || []).slice().sort((a, b) => (PRESENCE_ORDER[a.presence?.status] ?? 3) - (PRESENCE_ORDER[b.presence?.status] ?? 3));
  const friendIds = new Set(sorted.map((f) => String(f._id)));
  const strangers = loggedIn ? game.roomPlayers().filter((p) => !friendIds.has(String(p.legionId))) : [];
  const statusText = (f) => {
    const st = f.presence?.status || 'offline';
    if (f.presence?.gameSlug === legion.SLUG) return 'Playing Speed Kart Escape';
    if (st === 'in-game' && f.presence?.gameName) return `Playing ${f.presence.gameName}`;
    return (PRESENCE[st] || PRESENCE.offline)[1];
  };

  return (
    <Modal theme="worlds" icon={<FriendsIcon />} title="Invite Friends" onClose={onClose}>
      <div className="invite">
        {!loggedIn ? (
          <div className="inv-login">
            <div className="o">Log in to invite your Bloxity friends.</div>
            <Btn color="blue" onClick={() => game.login()}>
              Log in
            </Btn>
          </div>
        ) : (
          <>
            <div className="inv-title o">Your friends</div>
            <div className="inv-list">
              {friends === null && <div className="inv-empty o">Loading friends…</div>}
              {friends && !sorted.length && <div className="inv-empty o">No friends yet. Share the link below!</div>}
              {sorted.map((f) => {
                const color = (PRESENCE[f.presence?.status] || PRESENCE.offline)[0];
                const state = sent[f._id];
                return (
                  <div className="inv-row" key={f._id}>
                    <img className="inv-pfp" src={f.pfp || DEFAULT_PFP} alt="" draggable="false" onError={(e) => (e.currentTarget.src = DEFAULT_PFP)} />
                    <div className="inv-who">
                      <div className="inv-name o">{f.displayName || f.username}</div>
                      <div className="inv-status" style={{ color }}>
                        <i style={{ background: color }} />
                        {statusText(f)}
                      </div>
                    </div>
                    <Btn color={state === 'sent' ? 'green' : state === 'failed' ? 'red' : 'blue'} disabled={!!state} onClick={() => invite(f)}>
                      {state === 'sending' ? '…' : state === 'sent' ? 'Sent ✓' : state === 'failed' ? 'Failed' : 'Invite'}
                    </Btn>
                  </div>
                );
              })}
            </div>
            {strangers.length > 0 && (
              <>
                <div className="inv-title o">Players here</div>
                <div className="inv-list">
                  {strangers.map((p) => {
                    const st = requests[p.legionId];
                    return (
                      <div className="inv-row" key={p.legionId}>
                        <img className="inv-pfp" src={DEFAULT_PFP} alt="" draggable="false" />
                        <div className="inv-who">
                          <div className="inv-name o">{p.name}</div>
                          <div className="inv-status" style={{ color: '#3dff6a' }}>
                            <i style={{ background: '#3dff6a' }} />
                            In this server
                          </div>
                        </div>
                        <Btn color={st === 'accepted' || st === 'pending' ? 'green' : 'purple'} disabled={!!st && st !== 'failed'} onClick={() => addFriend(p)}>
                          {st === 'sending' ? '…' : st === 'accepted' ? 'Friends ✓' : st === 'pending' ? 'Requested' : st === 'failed' ? 'Retry' : 'Add Friend'}
                        </Btn>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
        <div className="inv-title o">Invite link</div>
        <div className="invite-row">
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
          <Btn
            color="blue"
            onClick={() => {
              navigator.clipboard?.writeText(link).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// --- Settings -----------------------------------------------------------------------
function SettingsPanel({ game, onClose, identity }) {
  const [vol, setVol] = useState(sfx.volume);
  const [muted, setMuted] = useState(sfx.muted);
  const [music, setMusic] = useState(sfx.musicOn);
  return (
    <Modal theme="rebirth" title="Settings" onClose={onClose}>
      <div className="set-row">
        <span className="o">Sound volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={vol}
          onChange={(e) => {
            sfx.setVolume(Number(e.target.value));
            setVol(sfx.volume);
          }}
        />
        <Btn
          color="grey"
          onClick={() => {
            sfx.setMuted(!muted);
            setMuted(!muted);
          }}
        >
          {muted ? 'Unmute' : 'Mute'}
        </Btn>
      </div>
      <div className="set-row">
        <span className="o">Background music</span>
        <Btn
          color={music ? 'green' : 'grey'}
          onClick={() => {
            sfx.setMusic(!music);
            setMusic(!music);
          }}
        >
          {music ? 'On' : 'Off'}
        </Btn>
      </div>
      <div className="set-row">
        <span className="o">{identity?.isGuest ? 'Playing as a guest — log in to save your progress' : `Logged in as ${identity?.displayName || identity?.username}`}</span>
        {identity?.isGuest && legion.hasSdk() && (
          <Btn color="blue" onClick={() => legion.showAuthPopup()}>
            Log in
          </Btn>
        )}
      </div>
      <div className="set-row">
        <span className="o">Stuck? Return to the spawn.</span>
        <Btn
          color="pink"
          onClick={() => {
            game.respawn();
            onClose();
          }}
        >
          Respawn
        </Btn>
      </div>
      <p className="set-help o">WASD / arrows drive toward where the camera looks. Drag to turn the camera, scroll or pinch to zoom. On phones: left thumb = joystick, right side = camera.</p>
    </Modal>
  );
}

const PANELS = {
  rebirth: RebirthPanel,
  quests: QuestsPanel,
  trails: TrailsPanel,
  worlds: WorldsPanel,
  karts: KartsPanel,
  boosts: BoostsPanel,
  playtime: PlaytimePanel,
  merchant: MerchantPanel,
  shop: ShopPanel,
  currency: CurrencyPanel,
  invite: InvitePanel,
  settings: SettingsPanel,
};

export function PanelHost({ panel, game, profile, identity, onClose, openPanel }) {
  const P = PANELS[panel];
  if (!P) return null;
  return <P key={panel} game={game} p={profile} identity={identity} onClose={onClose} openPanel={openPanel} />;
}
