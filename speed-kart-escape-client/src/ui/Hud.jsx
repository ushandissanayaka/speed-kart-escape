/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react';
import * as legion from '../bloxity/legion.js';
import {
  BagIcon,
  BoostsIcon,
  ChatIcon,
  CoinIcon,
  FriendsIcon,
  GemIcon,
  GiftIcon,
  HandIcon,
  KartsIcon,
  MenuIcon,
  PlusIcon,
  QuestsIcon,
  RebirthIcon,
  ShoeIcon,
  SpiralIcon,
  TrailsIcon,
  TrophyIcon,
  WorldsIcon,
} from './icons/Icons.jsx';
import {
  GEM_PRODUCTS,
  QUESTS,
  TUNING,
  formatClock,
  formatNumber,
  playtimeClaimable,
  playtimeState,
  maxLevel,
  canRebirth as canRebirthFn,
  activeSpeedBoost,
  questProgress,
  rebirthMultiplier,
  xpForLevel,
} from '../shared/gameData.js';

const MENU = [
  { id: 'rebirth', label: 'Rebirth', Art: RebirthIcon, cls: 'c-rebirth' },
  { id: 'quests', label: 'Quests', Art: QuestsIcon, cls: 'c-quests' },
  { id: 'trails', label: 'Trails', Art: TrailsIcon, cls: 'c-trails' },
  { id: 'worlds', label: 'Worlds', Art: WorldsIcon, cls: 'c-worlds' },
  { id: 'karts', label: 'Karts', Art: KartsIcon, cls: 'c-karts' },
  { id: 'boosts', label: 'Boosts', Art: BoostsIcon, cls: 'c-boosts' },
];

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function Hud({ game, profile, online, serverOffset, openPanel }) {
  const now = useNow() + serverOffset;
  const [collapsed, setCollapsed] = useState(false);
  const [csEdit, setCsEdit] = useState(null);

  const level = profile.level;
  const cap = maxLevel(profile);
  const need = xpForLevel(level);
  const maxed = level >= cap;
  const pct = maxed ? 100 : Math.min(100, (profile.xp / need) * 100);
  const ptReady = playtimeClaimable(game.playtime, now);
  const ptNext = playtimeState(game.playtime, now).find((r) => !r.ready);
  const potionLeft = (profile.potions?.speed2x || 0) - now;
  const boostLeft = activeSpeedBoost(profile, now) > 1 ? profile.speedBoost.until - now : 0;
  const turboLeft = Math.max(potionLeft, boostLeft);
  const questsReady = QUESTS.filter((q) => {
    const pr = questProgress(profile, q);
    return pr.done && !pr.claimed;
  }).length;
  const canRebirth = canRebirthFn(profile);
  const commitCs = () => {
    if (csEdit !== null && csEdit !== '') game.action({ type: 'setCustomSpeed', value: Math.min(TUNING.customSpeedMax, Math.max(0, Number(csEdit) || 0)) });
    setCsEdit(null);
  };

  return (
    <div className="hud">
      {/* system pills */}
      <div className="sys">
        <div className="sys-pill">
          <button className="press" title="Settings" onClick={() => openPanel('settings')}>
            <MenuIcon />
          </button>
          <button className="press" title="Chat — use the Bloxity chat" onClick={() => openPanel('settings')}>
            <ChatIcon />
          </button>
        </div>
        <div className="sys-pill round">
          <button className="press" title="Shop" onClick={() => openPanel('shop')}>
            <BagIcon />
          </button>
        </div>
      </div>
      {!online && <div className="offline-chip o">Offline mode</div>}

      {turboLeft > 0 && (
        <div className="turbo">
          <ShoeIcon />
          <span className="tl">TURBO GAIN</span>
          <span className="tt">{formatClock(turboLeft)}</span>
        </div>
      )}

      {/* currencies */}
      <div className="currency" style={{ top: 'calc(165px * var(--s))' }}>
        <div className="ico">
          <TrophyIcon />
        </div>
        <div className="val o">{formatNumber(profile.wins)}</div>
        <button className="plus press" title="Get Wins" onClick={() => openPanel('currency')}>
          <PlusIcon />
        </button>
      </div>
      <div className="currency" style={{ top: 'calc(248px * var(--s))' }}>
        <div className="ico">
          <CoinIcon />
        </div>
        <div className="val o">{formatNumber(profile.coins)}</div>
        <button className="plus press" title="Get Coins" onClick={() => openPanel('currency')}>
          <PlusIcon />
        </button>
      </div>

      {/* menu grid */}
      <div className={`menu-grid${collapsed ? ' hidden' : ''}`}>
        {MENU.map(({ id, label, Art, cls }) => (
          <button key={id} className={`mbtn press ${cls}`} onClick={() => openPanel(id)}>
            <div className="art">
              <Art />
            </div>
            <span className="lbl o">{label}</span>
            {id === 'quests' && questsReady > 0 && <span className="badge o">!</span>}
            {id === 'rebirth' && canRebirth && <span className="badge o">!</span>}
          </button>
        ))}
      </div>

      {/* right column */}
      <div className="right-col">
        <button className={`playtime press${ptReady ? ' flash' : ''}`} onClick={() => openPanel('playtime')}>
          <div className="gift">
            <GiftIcon />
          </div>
          <div className="txt">
            <div className="t1 o">Playtime</div>
            <div className="t2 o">{ptReady || !ptNext ? 'CLAIM THE REWARD!' : `NEXT IN ${formatClock(ptNext.msLeft)}`}</div>
          </div>
          {ptReady && <span className="bang o">!</span>}
        </button>

        <div className="cs-label o">Custom Speed</div>
        <div style={{ position: 'relative' }}>
          {/* Click the box and type a number, like the reference TextBox. 0 = no limit. */}
          <label className="custom-speed press" title="Type 0 - 20 (0 = no limit)">
            <div className="hand">
              <HandIcon />
            </div>
            <input
              className="num o"
              inputMode="numeric"
              value={csEdit ?? String(profile.customSpeed)}
              onFocus={(e) => {
                setCsEdit('');
                e.target.select();
              }}
              onChange={(e) => setCsEdit(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
              onBlur={commitCs}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
            <div className="max o">Max. {TUNING.customSpeedMax}</div>
          </label>
        </div>

        <PassButton game={game} profile={profile} sku="pass_x2_wins" pass="x2Wins" cls="pass-wins" title="x2 Wins" />
        <PassButton game={game} profile={profile} sku="pass_x2_speed" pass="x2Speed" cls="pass-speed" title="x2 Speed" />
      </div>

      {/* bottom centre */}
      <div className="bottom-center">
        <div className="speed-text o">Speed: {formatNumber(profile.speed)}</div>
        <div className="level-bar">
          <div className="fill" style={{ width: `${pct}%` }} />
          <span className="lvl o">
            Level {level} / {cap}
          </span>
          <span className="xp o">{maxed ? 'MAX' : `${profile.xp}/${need}`}</span>
        </div>
        <div className="boost-row">
          {['speed_100k', 'speed_1m', 'speed_10m'].map((sku) => (
            <button key={sku} className="boost-btn press o" onClick={() => game.purchase(sku)} title={`${GEM_PRODUCTS[sku].name} (Gems)`}>
              <ShoeIcon />
              {GEM_PRODUCTS[sku].name.replace(' Speed', '')}
            </button>
          ))}
          <button className="plus-btn press" title="More" onClick={() => openPanel('shop')}>
            <PlusIcon color="#ffffff" />
          </button>
        </div>
      </div>

      {/* bottom-left */}
      <div className="bottom-left">
        <div className="mini" title="Rebirth bonus">
          <SpiralIcon />
          <span className="pct o">+{Math.round((rebirthMultiplier(profile.rebirths) - 1) * 100)}%</span>
        </div>
        <button className="mini wide press" title="Invite friends" onClick={() => legion.inviteFriends() || openPanel('invite')}>
          <FriendsIcon />
          <span className="pct o">+0%</span>
        </button>
        <button className={`collapse press${collapsed ? ' flipped' : ''}`} onClick={() => setCollapsed((c) => !c)} title="Toggle menu">
          ◀
        </button>
      </div>
    </div>
  );
}

function PassButton({ game, profile, sku, pass, cls, title }) {
  const owned = !!profile.passes?.[pass];
  return (
    <button className={`pass press ${cls}${owned ? ' owned' : ''}`} onClick={() => !owned && game.purchase(sku)}>
      <div className="big o">{title}</div>
      <div className="only o">
        {owned ? (
          'OWNED'
        ) : (
          <>
            ONLY <GemIcon /> {GEM_PRODUCTS[sku].displayPrice}
          </>
        )}
      </div>
    </button>
  );
}

// Floating "+1 👟" numbers and toast messages
export function Popups({ game }) {
  const [gains, setGains] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [stage, setStage] = useState(null);
  const idRef = useRef(0);

  useEffect(() => {
    const offs = [
      game.events.on('gain', (g) => {
        const id = ++idRef.current;
        const jitter = (Math.random() - 0.5) * 80;
        setGains((list) => [...list.slice(-14), { id, amount: g.amount, x: g.x + 70 + jitter, y: g.y + (Math.random() - 0.5) * 30 }]);
        setTimeout(() => setGains((list) => list.filter((x) => x.id !== id)), 1000);
      }),
      game.events.on('toast', (t) => {
        const id = ++idRef.current;
        setToasts((list) => [...list.slice(-3), { id, ...t }]);
        setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3200);
      }),
      game.events.on('stage', (s) => {
        setStage({ ...s, id: ++idRef.current });
        setTimeout(() => setStage(null), 1600);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [game]);

  return (
    <>
      <div className="popups">
        {gains.map((g) => (
          <div key={g.id} className="gain o" style={{ left: g.x, top: g.y }}>
            +{formatNumber(g.amount)} <ShoeIcon />
          </div>
        ))}
      </div>
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast o ${t.kind || ''}`}>
            {t.text}
          </div>
        ))}
      </div>
      {stage && (
        <div className="stage-banner" key={stage.id}>
          <span>{stage.name}</span>
        </div>
      )}
    </>
  );
}

// Full-screen control surface under the HUD buttons.
//  Touch: a thumbstick appears wherever the left-side thumb lands (Roblox mobile style);
//         dragging on the right side turns the camera; two fingers pinch to zoom.
//  Mouse / touchpad: drag anywhere to orbit the camera, scroll or pinch to zoom.
export function ControlLayer({ game, touch }) {
  const stickRef = useRef(null); // { id, ox, oy }
  const cams = useRef(new Map()); // pointerId -> { x, y }
  const pinch = useRef(0);
  const [stick, setStick] = useState(null); // { ox, oy, kx, ky } for drawing
  const RADIUS = 70;

  const camDistance = () => {
    const pts = [...cams.current.values()];
    return pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
  };

  const onDown = (e) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture unsupported for this pointer */
    }
    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (isTouch && !stickRef.current && e.clientX < window.innerWidth * 0.45) {
      stickRef.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
      setStick({ ox: e.clientX, oy: e.clientY, kx: 0, ky: 0 });
      game.setStick(0, 0, true);
      return;
    }
    cams.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current = camDistance();
  };

  const onMove = (e) => {
    const st = stickRef.current;
    if (st && st.id === e.pointerId) {
      let dx = e.clientX - st.ox;
      let dy = e.clientY - st.oy;
      const len = Math.hypot(dx, dy);
      if (len > RADIUS) {
        dx = (dx / len) * RADIUS;
        dy = (dy / len) * RADIUS;
      }
      setStick({ ox: st.ox, oy: st.oy, kx: dx, ky: dy });
      game.setStick(dx / RADIUS, dy / RADIUS, true);
      return;
    }
    const prev = cams.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    cams.current.set(e.pointerId, next);
    if (cams.current.size >= 2) {
      const d = camDistance();
      if (pinch.current > 0 && d > 0) game.zoomCamera(pinch.current / d);
      pinch.current = d;
    } else {
      game.orbitCamera(next.x - prev.x, next.y - prev.y);
    }
  };

  const onUp = (e) => {
    if (stickRef.current?.id === e.pointerId) {
      stickRef.current = null;
      setStick(null);
      game.setStick(0, 0, false);
      return;
    }
    cams.current.delete(e.pointerId);
    pinch.current = camDistance();
  };

  useEffect(() => {
    const el = document.querySelector('.control-layer');
    const onWheel = (e) => {
      e.preventDefault();
      // Touchpad pinch arrives as ctrl+wheel with small deltas
      const f = e.ctrlKey ? 1 + e.deltaY * 0.01 : 1 + Math.sign(e.deltaY) * 0.1;
      game.zoomCamera(Math.max(0.8, Math.min(1.25, f)));
    };
    el?.addEventListener('wheel', onWheel, { passive: false });
    return () => el?.removeEventListener('wheel', onWheel);
  }, [game]);

  return (
    <div
      className="control-layer"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {stick ? (
        <div className="joy active" style={{ left: stick.ox, top: stick.oy }}>
          <div className="knob" style={{ transform: `translate(${stick.kx}px, ${stick.ky}px)` }} />
        </div>
      ) : (
        touch && (
          <div className="joy idle">
            <div className="knob" />
          </div>
        )
      )}
    </div>
  );
}
