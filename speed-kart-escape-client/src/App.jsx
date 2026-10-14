import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './game/Game.js';
import { ControlLayer, Hud, Popups } from './ui/Hud.jsx';
import { PanelHost } from './ui/panels/Panels.jsx';
import { PurchasePrompt } from './ui/PurchasePrompt.jsx';
import { AwayPopup } from './ui/AwayPopup.jsx';
import { newProfile } from './shared/gameData.js';

// HUD scale: the reference was captured at 1918x1004.
// HUD scale (--s): the HUD is laid out at 1918x1004. Landscape fits that box; portrait
// phones get a narrower reference so buttons stay big enough to tap.
function computeScale() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const s = h > w ? Math.min(w / 900, h / 1700) : Math.min(h / 1004, w / 1500);
  return Math.max(0.3, Math.min(1.5, s));
}

const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export default function App() {
  const mountRef = useRef(null);
  const gameRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(newProfile());
  const [online, setOnline] = useState(false);
  const [identity, setIdentity] = useState(null);
  const [panel, setPanel] = useState(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [loading, setLoading] = useState({ text: 'Starting…', progress: 0.02 });

  useEffect(() => {
    const apply = () => document.documentElement.style.setProperty('--s', computeScale().toFixed(4));
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  useEffect(() => {
    const game = new Game(mountRef.current);
    gameRef.current = game;
    const offs = [
      game.events.on('loading', (l) => setLoading(l)),
      game.events.on('ready', ({ online: o, identity: id }) => {
        setLoading({ text: 'Ready!', progress: 1 });
        setOnline(o);
        setIdentity(id);
        setReady(true);
      }),
      game.events.on('profile', (p) => {
        setProfile(p);
        setServerOffset(game.serverOffset);
      }),
      game.events.on('status', (s) => setOnline(s.online)),
      game.events.on('openPanel', (name) => setPanel(name)),
    ];
    game.start().catch((err) => {
      console.error(err);
      setError(err?.message || String(err));
    });
    return () => {
      offs.forEach((off) => off());
      game.dispose();
    };
  }, []);

  const openPanel = useCallback((name) => setPanel(name), []);
  const closePanel = useCallback(() => setPanel(null), []);
  const game = gameRef.current;

  return (
    <>
      {/* Shared SVG filter that gives every icon a glossy, raised 3D look. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="icon3d" x="-15%" y="-15%" width="130%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="blur" />
          <feSpecularLighting in="blur" surfaceScale="5" specularConstant="0.85" specularExponent="16" lightingColor="#ffffff" result="spec">
            <fePointLight x="-4000" y="-8000" z="9000" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
          <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.6" k4="0" result="lit" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="sh" />
          <feOffset in="sh" dy="3.5" result="shOff" />
          <feFlood floodColor="#0b0a1e" floodOpacity="0.45" />
          <feComposite in2="shOff" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="lit" />
          </feMerge>
        </filter>
      </svg>
      <div className={`game-root${panel ? ' blurred' : ''}`} ref={mountRef} />
      {ready && game && (
        <>
          <ControlLayer game={game} touch={isTouch} />
          <Hud game={game} profile={profile} online={online} serverOffset={serverOffset} openPanel={openPanel} />
          <Popups game={game} />
          <AwayPopup game={game} profile={profile} />
          <PurchasePrompt game={game} />
          {panel && <PanelHost panel={panel} game={game} profile={profile} identity={identity} onClose={closePanel} openPanel={openPanel} />}
        </>
      )}
      {/* Loading screen: blurred artwork behind a dark card with the game icon and
          title; tracks real progress and fades into the game when it is ready. */}
      <div className={`loading${ready ? ' done' : ''}`}>
        <div className="ld-bg" />
        <div className="ld-center">
          <img className="ld-icon" src="./loading-art.jpg" alt="" />
          <div className="ld-title">
            <span className="ld-pen">✏️</span> +1 Speed Kart Escape <span className="ld-check">✓</span>
          </div>
          <div className="ld-sub">User Created Game</div>
          {error ? (
            <div className="ld-err">Could not start the game: {error}</div>
          ) : (
            <div className="ld-dots">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
        <div className="ld-status">{error ? '' : `${loading.text} ${Math.round(loading.progress * 100)}%`}</div>
      </div>
    </>
  );
}
