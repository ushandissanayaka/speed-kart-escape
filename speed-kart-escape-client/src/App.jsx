import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './game/Game.js';
import { ControlLayer, Hud, Popups } from './ui/Hud.jsx';
import { PanelHost } from './ui/panels/Panels.jsx';
import { newProfile } from './shared/gameData.js';

// HUD scale: the reference was captured at 1918x1004.
function computeScale() {
  return Math.max(0.42, Math.min(1.5, Math.min(window.innerHeight / 1004, window.innerWidth / 1500)));
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
      game.events.on('ready', ({ online: o, identity: id }) => {
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
          {panel && <PanelHost panel={panel} game={game} profile={profile} identity={identity} onClose={closePanel} openPanel={openPanel} />}
        </>
      )}
      <div className={`loading${ready ? ' done' : ''}`}>
        <div className="title">
          Speed <b>Kart</b> Escape
        </div>
        {error ? <div className="err">Could not start the game: {error}</div> : <div className="spin" />}
      </div>
    </>
  );
}
