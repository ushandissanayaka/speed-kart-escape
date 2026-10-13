// Hand-drawn SVG icons matching the reference HUD (glossy, thick dark outlines).
/* eslint-disable react/prop-types */

const O = '#1b1530'; // outline colour

const Svg = ({ size = '100%', children, view = '0 0 100 100', style }) => (
  <svg viewBox={view} width={size} height={size} style={style} aria-hidden="true">
    {children}
  </svg>
);

export const TrophyIcon = (p) => (
  <Svg {...p}>
    <defs>
      <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe866" />
        <stop offset="0.55" stopColor="#ffbe1a" />
        <stop offset="1" stopColor="#e88a00" />
      </linearGradient>
    </defs>
    <path d="M22 22 C4 22 6 48 30 50 M78 22 C96 22 94 48 70 50" fill="none" stroke={O} strokeWidth="11" strokeLinecap="round" />
    <path d="M22 22 C4 22 6 48 30 50 M78 22 C96 22 94 48 70 50" fill="none" stroke="#ffc21a" strokeWidth="5" strokeLinecap="round" />
    <path d="M20 14 H80 V30 C80 52 66 62 50 62 C34 62 20 52 20 30 Z" fill="url(#tg)" stroke={O} strokeWidth="5" strokeLinejoin="round" />
    <path d="M28 20 H44 V30 C44 42 38 50 32 52 C28 46 28 38 28 30 Z" fill="#fff6b0" opacity="0.55" />
    <rect x="43" y="60" width="14" height="14" fill="#e89a00" stroke={O} strokeWidth="5" />
    <path d="M28 74 H72 L76 88 H24 Z" fill="url(#tg)" stroke={O} strokeWidth="5" strokeLinejoin="round" />
    <text x="50" y="47" textAnchor="middle" fontFamily="Fredoka One" fontSize="28" fill="#e8462a" stroke={O} strokeWidth="2.5" paintOrder="stroke">1</text>
  </Svg>
);

export const CoinIcon = (p) => (
  <Svg {...p}>
    <defs>
      <radialGradient id="cg" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#fff07a" />
        <stop offset="0.6" stopColor="#ffc21a" />
        <stop offset="1" stopColor="#f29a00" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="52" r="40" fill="#d97800" stroke={O} strokeWidth="5" />
    <circle cx="50" cy="48" r="38" fill="url(#cg)" stroke={O} strokeWidth="5" />
    <circle cx="50" cy="48" r="27" fill="none" stroke="#e08a00" strokeWidth="4" />
    <text x="50" y="62" textAnchor="middle" fontFamily="Fredoka One" fontSize="40" fill="#f08c00" stroke="#a85800" strokeWidth="2">$</text>
  </Svg>
);

export const PlusIcon = ({ color = '#ffd21c', ...p }) => (
  <Svg {...p}>
    <path d="M38 10 H62 V38 H90 V62 H62 V90 H38 V62 H10 V38 H38 Z" fill={color} stroke={O} strokeWidth="7" strokeLinejoin="round" />
    <path d="M42 15 H58 V42 H85" fill="none" stroke="#fff6b0" strokeWidth="4" opacity="0.6" />
  </Svg>
);

export const RebirthIcon = (p) => (
  <Svg {...p}>
    <defs>
      <linearGradient id="rbA" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ff7ab8" />
        <stop offset="1" stopColor="#e8165e" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="56" r="30" fill="#f4f6ff" stroke={O} strokeWidth="5" />
    <path d="M22 60 H78" stroke={O} strokeWidth="9" />
    <circle cx="50" cy="60" r="9" fill="#f4f6ff" stroke={O} strokeWidth="5" />
    <path d="M14 46 A36 36 0 0 1 80 26 L88 16 L92 46 L62 40 L72 32 A26 26 0 0 0 26 48 Z" fill="url(#rbA)" stroke={O} strokeWidth="5" strokeLinejoin="round" />
    <path d="M86 66 A36 36 0 0 1 22 82 L14 92 L10 64 L38 70 L30 76 A26 26 0 0 0 74 64 Z" fill="url(#rbA)" stroke={O} strokeWidth="5" strokeLinejoin="round" />
  </Svg>
);

export const QuestsIcon = (p) => (
  <Svg {...p}>
    <path d="M24 16 H76 C84 16 84 30 76 30 H72 V78 C72 86 66 90 58 90 H20 C12 90 12 76 20 76 H28 V30 C20 30 18 16 24 16 Z" fill="#fbe8c4" stroke={O} strokeWidth="5" strokeLinejoin="round" />
    <path d="M28 30 H72" stroke="#d9b886" strokeWidth="4" />
    <path d="M36 44 H64 M36 54 H64 M36 64 H58" stroke="#c9a06a" strokeWidth="4" strokeLinecap="round" />
    <path d="M20 76 C28 76 30 82 28 90" fill="none" stroke={O} strokeWidth="4" />
    <ellipse cx="76" cy="23" rx="6" ry="7" fill="#eacb94" stroke={O} strokeWidth="4" />
  </Svg>
);

export const TrailsIcon = (p) => (
  <Svg {...p}>
    <defs>
      <radialGradient id="fl" cx="0.5" cy="0.7" r="0.7">
        <stop offset="0" stopColor="#ffd0e4" />
        <stop offset="0.45" stopColor="#ff4f8a" />
        <stop offset="1" stopColor="#d4103c" />
      </radialGradient>
    </defs>
    <path d="M50 8 C58 26 76 28 74 46 C84 40 84 30 82 24 C96 44 92 70 74 84 C64 92 36 92 26 84 C8 70 6 46 20 30 C20 42 26 48 30 50 C26 32 40 20 50 8 Z" fill="url(#fl)" stroke={O} strokeWidth="5" strokeLinejoin="round" />
    <circle cx="50" cy="64" r="15" fill="#3a1418" stroke={O} strokeWidth="4" />
    <path d="M30 22 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" fill="#fff" />
    <path d="M74 60 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#fff" />
  </Svg>
);

export const WorldsIcon = (p) => (
  <Svg {...p}>
    <defs>
      <radialGradient id="gx" cx="0.5" cy="0.5" r="0.55">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.25" stopColor="#c58bff" />
        <stop offset="0.7" stopColor="#5a12c8" />
        <stop offset="1" stopColor="#24064f" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="40" fill="url(#gx)" stroke={O} strokeWidth="5" />
    <path d="M50 50 C58 40 72 46 70 58 C68 72 48 78 36 68 C22 56 28 30 50 24 C70 18 88 34 84 54" fill="none" stroke="#e3c4ff" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
    <path d="M50 50 C42 60 28 54 30 42 C32 28 52 22 64 32 C78 44 72 70 50 76 C30 82 12 66 16 46" fill="none" stroke="#9a5cff" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
    <circle cx="24" cy="30" r="2" fill="#fff" />
    <circle cx="76" cy="72" r="2.4" fill="#fff" />
    <circle cx="70" cy="22" r="1.6" fill="#fff" />
  </Svg>
);

export const KartsIcon = (p) => (
  <Svg {...p}>
    <g transform="rotate(-24 50 50)">
      <rect x="12" y="34" width="20" height="30" rx="5" fill="#2a2d3d" stroke={O} strokeWidth="5" />
      <rect x="68" y="34" width="20" height="30" rx="5" fill="#2a2d3d" stroke={O} strokeWidth="5" />
      <path d="M26 40 H74 L80 60 H20 Z" fill="#c9d3ff" stroke={O} strokeWidth="5" strokeLinejoin="round" />
      <path d="M38 22 H62 L66 44 H34 Z" fill="#eef2ff" stroke={O} strokeWidth="5" strokeLinejoin="round" />
      <path d="M42 26 H56 L58 38 H42 Z" fill="#ffffff" opacity="0.8" />
      <rect x="24" y="58" width="52" height="10" rx="3" fill="#3a3f5a" stroke={O} strokeWidth="4" />
    </g>
  </Svg>
);

export const BoostsIcon = (p) => (
  <Svg {...p}>
    <defs>
      <linearGradient id="bo" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5dff8a" />
        <stop offset="1" stopColor="#0fae44" />
      </linearGradient>
    </defs>
    <path d="M50 8 L88 34 V54 L50 30 L12 54 V34 Z" fill="url(#bo)" stroke={O} strokeWidth="5" strokeLinejoin="round" />
    <path d="M50 42 L88 66 V86 L50 62 L12 86 V66 Z" fill="url(#bo)" stroke={O} strokeWidth="5" strokeLinejoin="round" />
    <path d="M50 14 L82 36 V42 L50 22 L18 42 V36 Z" fill="#c8ffd8" opacity="0.5" />
  </Svg>
);

export const GiftIcon = (p) => (
  <Svg {...p}>
    <path d="M50 26 C40 6 22 10 26 22 C28 28 40 28 50 26 C60 28 72 28 74 22 C78 10 60 6 50 26 Z" fill="#ffd21c" stroke={O} strokeWidth="4.5" strokeLinejoin="round" />
    <rect x="14" y="26" width="72" height="20" rx="3" fill="#ff3d55" stroke={O} strokeWidth="5" />
    <rect x="20" y="44" width="60" height="44" rx="3" fill="#e81e3c" stroke={O} strokeWidth="5" />
    <rect x="43" y="26" width="14" height="62" fill="#ffd21c" stroke={O} strokeWidth="4" />
    <path d="M24 50 H40 M24 58 H36" stroke="#ff8c9a" strokeWidth="3" />
  </Svg>
);

export const HandIcon = (p) => (
  <Svg {...p}>
    <path d="M30 18 C30 10 42 10 42 18 V46 L46 44 C48 36 58 36 58 44 L62 42 C64 34 74 36 74 44 L76 44 C80 38 88 42 88 50 V66 C88 82 76 92 60 92 H50 C40 92 32 86 26 76 L14 56 C10 48 18 42 24 48 L30 56 Z" fill="#ffffff" stroke={O} strokeWidth="5" strokeLinejoin="round" />
    <path d="M44 74 C50 80 64 80 72 72" fill="none" stroke="#d6dbef" strokeWidth="4" />
    <rect x="32" y="84" width="40" height="12" rx="4" fill="#3ec7ff" stroke={O} strokeWidth="4" transform="rotate(-8 52 90)" />
  </Svg>
);

export const GemIcon = (p) => (
  <Svg {...p}>
    <path d="M50 6 L88 28 V72 L50 94 L12 72 V28 Z" fill="#2fd24a" stroke={O} strokeWidth="6" strokeLinejoin="round" />
    <path d="M50 26 L70 38 V62 L50 74 L30 62 V38 Z" fill="#0f8a26" stroke={O} strokeWidth="5" strokeLinejoin="round" />
    <path d="M50 14 L80 31" stroke="#a8ffb6" strokeWidth="4" opacity="0.7" />
  </Svg>
);

export const ShoeIcon = (p) => (
  <Svg {...p}>
    <g transform="rotate(-28 50 50)">
      <path d="M10 62 L16 30 C18 24 26 24 30 30 L40 40 L66 46 C80 48 90 54 90 64 V70 H10 Z" fill="#2f8cff" stroke={O} strokeWidth="5" strokeLinejoin="round" />
      <path d="M10 64 H90 V74 C90 78 86 80 82 80 H14 C10 80 8 76 10 72 Z" fill="#ffffff" stroke={O} strokeWidth="5" strokeLinejoin="round" />
      <path d="M36 44 L44 38 M44 48 L52 42 M52 50 L60 44" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 34 C20 30 24 30 26 34" stroke="#9fd0ff" strokeWidth="4" fill="none" />
    </g>
  </Svg>
);

export const SpiralIcon = (p) => (
  <Svg {...p}>
    <rect x="8" y="8" width="84" height="84" rx="10" fill="#ffb300" stroke={O} strokeWidth="6" />
    <path d="M22 80 V22 H78 V78 H36 V36 H64 V64 H50 V50" fill="none" stroke={O} strokeWidth="9" strokeLinejoin="miter" />
    <path d="M22 80 V22 H78 V78 H36 V36 H64 V64 H50 V50" fill="none" stroke="#ffd65a" strokeWidth="3" />
  </Svg>
);

export const FriendsIcon = (p) => (
  <Svg {...p} view="0 0 120 100">
    <rect x="58" y="22" width="44" height="40" rx="10" fill="#ffd21c" stroke={O} strokeWidth="5" />
    <rect x="62" y="62" width="40" height="26" rx="6" fill="#2f8cff" stroke={O} strokeWidth="5" />
    <circle cx="74" cy="40" r="3.5" fill={O} />
    <circle cx="88" cy="40" r="3.5" fill={O} />
    <path d="M72 50 Q81 57 90 50" fill="none" stroke={O} strokeWidth="3.5" strokeLinecap="round" />
    <rect x="14" y="14" width="50" height="46" rx="11" fill="#ffe14a" stroke={O} strokeWidth="5" />
    <rect x="18" y="60" width="44" height="30" rx="6" fill="#2f8cff" stroke={O} strokeWidth="5" />
    <circle cx="31" cy="34" r="4" fill={O} />
    <circle cx="47" cy="34" r="4" fill={O} />
    <path d="M28 45 Q39 54 50 45" fill="none" stroke={O} strokeWidth="4" strokeLinecap="round" />
  </Svg>
);

export const MenuIcon = (p) => (
  <Svg {...p}>
    <rect x="22" y="22" width="56" height="56" rx="6" fill="#fff" transform="rotate(15 50 50)" />
    <rect x="42" y="42" width="16" height="16" fill="#1e1e26" transform="rotate(15 50 50)" />
  </Svg>
);

export const ChatIcon = (p) => (
  <Svg {...p}>
    <path d="M14 18 H86 V68 H50 L32 84 V68 H14 Z" fill="none" stroke="#fff" strokeWidth="7" strokeLinejoin="round" />
    <path d="M30 38 H70 M30 52 H58" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
  </Svg>
);

export const BagIcon = (p) => (
  <Svg {...p}>
    <path d="M20 36 H80 L74 86 H26 Z" fill="none" stroke="#fff" strokeWidth="7" strokeLinejoin="round" />
    <path d="M36 36 V28 C36 14 64 14 64 28 V36" fill="none" stroke="#fff" strokeWidth="7" />
  </Svg>
);

export const LockIcon = (p) => (
  <Svg {...p}>
    <rect x="20" y="44" width="60" height="44" rx="8" fill="#ffd21c" stroke={O} strokeWidth="6" />
    <path d="M32 44 V32 C32 12 68 12 68 32 V44" fill="none" stroke={O} strokeWidth="8" />
    <circle cx="50" cy="64" r="6" fill={O} />
  </Svg>
);

export const PotionIcon = ({ color = '#ff3d7a', ...p }) => (
  <Svg {...p}>
    <rect x="40" y="8" width="20" height="12" rx="3" fill="#b07a4a" stroke={O} strokeWidth="5" />
    <path d="M42 20 H58 V36 C74 42 82 54 82 66 C82 82 68 92 50 92 C32 92 18 82 18 66 C18 54 26 42 42 36 Z" fill={color} stroke={O} strokeWidth="5" strokeLinejoin="round" />
    <path d="M30 60 C32 50 40 46 46 44" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
  </Svg>
);

// Trail card art: a coloured comet with sparkles carrying a white blob, like the reference.
export const TrailArt = ({ c1 = '#b13bff', c2 = '#e08bff', ice = false, ...p }) => (
  <Svg {...p} view="0 0 140 100">
    <defs>
      <linearGradient id={`tr${c1.slice(1)}`} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor={c1} />
        <stop offset="1" stopColor={c2} />
      </linearGradient>
    </defs>
    <path
      d="M8 70 C20 40 40 22 62 18 L56 30 C70 22 84 22 96 26 L84 34 C98 36 108 44 112 56 L96 54 C100 66 96 80 88 88 C70 92 40 92 8 70 Z"
      fill={`url(#tr${c1.slice(1)})`}
      stroke={O}
      strokeWidth="5"
      strokeLinejoin="round"
    />
    {ice && <path d="M30 60 l10 0 M35 55 l0 10 M31 56 l8 8 M39 56 l-8 8" stroke="#fff" strokeWidth="3" />}
    <path d="M38 44 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 Z" fill="#fff" stroke={O} strokeWidth="2" />
    <path d="M24 60 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#fff" />
    <path d="M78 22 C96 18 118 26 120 44 C122 60 118 74 112 86 C104 94 86 94 76 88 C66 72 66 40 78 22 Z" fill="#fff" stroke={O} strokeWidth="5" strokeLinejoin="round" />
    <path d="M100 30 L108 30 L108 46" fill="none" stroke="#e6e9f5" strokeWidth="4" />
  </Svg>
);

export const OrbIcon = ({ count = 1, ...p }) => (
  <Svg {...p}>
    <defs>
      <radialGradient id="orb" cx="0.35" cy="0.3" r="0.75">
        <stop offset="0" stopColor="#e8faff" />
        <stop offset="0.45" stopColor="#4fb8ff" />
        <stop offset="1" stopColor="#1240c8" />
      </radialGradient>
    </defs>
    {(count === 1 ? [[50, 54, 34]] : [[30, 62, 24], [70, 62, 24], [50, 40, 26]]).map(([x, y, r], i) => (
      <g key={i}>
        <circle cx={x} cy={y} r={r} fill="url(#orb)" stroke={O} strokeWidth="5" />
        <ellipse cx={x - r * 0.3} cy={y - r * 0.35} rx={r * 0.28} ry={r * 0.18} fill="#fff" opacity="0.85" />
      </g>
    ))}
    {count === 1 && <circle cx="78" cy="24" r="9" fill="#cfefff" stroke={O} strokeWidth="4" />}
  </Svg>
);

export const PotionsIcon = (p) => (
  <Svg {...p}>
    {[
      [16, 30, '#7fd0ff'],
      [52, 30, '#4fb8ff'],
      [34, 18, '#9fe0ff'],
    ].map(([x, y, c], i) => (
      <g key={i}>
        <rect x={x + 8} y={y} width="14" height="10" fill="#e8eaf6" stroke={O} strokeWidth="4" />
        <rect x={x} y={y + 10} width="30" height="46" rx="6" fill={c} stroke={O} strokeWidth="5" />
        <rect x={x + 5} y={y + 16} width="6" height="24" rx="3" fill="#fff" opacity="0.7" />
      </g>
    ))}
  </Svg>
);

export const WarnIcon = (p) => (
  <Svg {...p}>
    <path d="M50 8 L94 88 H6 Z" fill="#ff4d5e" stroke={O} strokeWidth="7" strokeLinejoin="round" />
    <path d="M50 36 V60" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
    <circle cx="50" cy="74" r="6" fill="#fff" />
  </Svg>
);

export const FastForwardIcon = (p) => (
  <Svg {...p}>
    <path d="M8 18 L48 50 L8 82 Z M48 18 L88 50 L48 82 Z" fill="#ffffff" stroke={O} strokeWidth="7" strokeLinejoin="round" />
    <path d="M8 18 L48 50 L8 82 Z M48 18 L88 50 L48 82 Z" fill="none" stroke="#9fd8ff" strokeWidth="2" transform="translate(3 3)" opacity="0.6" />
  </Svg>
);

export const XIcon = (p) => (
  <Svg {...p}>
    <path d="M24 24 L76 76 M76 24 L24 76" stroke={O} strokeWidth="24" strokeLinecap="round" />
    <path d="M24 24 L76 76 M76 24 L24 76" stroke="#fff" strokeWidth="13" strokeLinecap="round" />
  </Svg>
);
