/* eslint-disable react/prop-types */
// "Welcome Back" popup shown when the game loads after time away: Speed and Wins
// earned while offline, with CLAIM and CLAIM 10x (Gems).
import { useEffect, useState } from 'react';
import { formatNumber } from '../shared/gameData.js';
import { ShoeIcon, TrophyIcon, XIcon } from './icons/Icons.jsx';

function awayText(ms) {
  const min = Math.floor(ms / 60_000);
  if (min >= 60) return `${Math.floor(min / 60)} hr`;
  return `${min} min`;
}

export function AwayPopup({ game, profile }) {
  const [shown, setShown] = useState(null); // the away reward being displayed
  const [done, setDone] = useState(false);

  // Opens once per session when there is an away reward, and stays open until the
  // player closes it (X) or claims — it never closes on its own.
  useEffect(() => {
    if (!done && profile.away && !shown) setShown(profile.away);
  }, [profile.away, shown, done]);

  if (!shown || done) return null;
  const close = () => setDone(true);
  // Claimed: start counting the next away reward from now.
  const markClaimed = () => {
    try {
      localStorage.setItem('ske_last_seen', String(Date.now()));
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className="aw-backdrop">
      <div className="aw-card">
        <div className="aw-head">
          <span className="aw-icon">
            <ShoeIcon />
          </span>
          <span className="aw-titles">
            <span className="aw-title o">Welcome Back</span>
            <span className="aw-sub o">You were away {awayText(shown.ms)}</span>
          </span>
          <button className="aw-x press" onClick={close} aria-label="Close">
            <XIcon />
          </button>
        </div>
        <div className="aw-body">
          <div className="aw-row aw-speed">
            <span className="aw-row-icon">
              <ShoeIcon />
            </span>
            <span className="o">+{formatNumber(shown.speed)}&nbsp;&nbsp;SPEED</span>
          </div>
          <div className="aw-row aw-wins">
            <span className="aw-row-icon">
              <TrophyIcon />
            </span>
            <span className="o">+{formatNumber(shown.wins)}&nbsp;&nbsp;WINS</span>
          </div>
          <div className="aw-buttons">
            <button
              className="aw-btn aw-claim press o"
              onClick={() => {
                game.action({ type: 'claimAway' });
                markClaimed();
                close();
              }}
            >
              CLAIM
            </button>
            <button className="aw-btn aw-claim10 press o" onClick={() => game.purchase('away_10x').then((r) => r?.success && (markClaimed(), close()))}>
              CLAIM 10x
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
