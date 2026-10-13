// Global leaderboards (SPEED / WINS / REBIRTHS), modelled on the reference:
//  - light-blue studded frame with an inset screen of 9 rows
//  - dark navy back pillar and a two-tier navy cap
//  - two glowing studded strips on each side (bright inner, tinted outer)
//  - navy plinth with a glowing accent band
//  - floating gradient title + "Global Leaderboard"

import * as THREE from 'three';
import { studBox, plainBox } from '../util/textures.js';
import { textSprite, canvasTexture, FONTS } from '../util/text.js';
import { mergeLeaderboard } from '../../shared/gameData.js';

export const BOARDS = {
  speed: {
    title: 'SPEED',
    titleFill: ['#4ff0ff', '#19a8ff', '#1257e8'],
    inner: '#0a84ff',
    outer: '#5fb2ff',
    glow: '#00d4ff',
    value: '#3ecbff',
    icon: 'shoe',
  },
  wins: {
    title: 'WINS',
    titleFill: ['#fff44f', '#ffc21a', '#ff8a00'],
    inner: '#e2e400',
    outer: '#d6ef86',
    glow: '#bdf08e',
    value: '#ffd23a',
    icon: 'trophy',
  },
  rebirths: {
    title: 'REBIRTHS',
    titleFill: ['#5dff3c', '#22d63a', '#0b9a2a'],
    inner: '#0cc556',
    outer: '#0b8f47',
    glow: '#16cf4f',
    value: '#46ff6a',
    icon: 'rebirth',
  },
};

const NAVY = '#24468a';
const NAVY_DARK = '#1b3874';
const FRAME = '#93b9f0';
const FRAME_LIP = '#7aa3e6';

// Frame / screen size in world units
const FW = 19;
const FH = 26;
const SW = 15.4;
const SH = 22.4;
const BASE_H = 3.6;

// Canvas resolution (2x for crisp text)
const K = 2;
const W = 512 * K;
const H = Math.round((512 * SH) / SW) * K;

const avatarImages = new Map();
function loadAvatarImage(url, onLoad) {
  if (!url) return null;
  if (avatarImages.has(url)) return avatarImages.get(url);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = onLoad;
  img.src = url;
  avatarImages.set(url, img);
  return img;
}

// 106.3T / 251.0M / 16 — always one decimal once a suffix is used, like the reference.
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];
function formatBoard(n) {
  n = Number(n) || 0;
  if (n < 1000) return String(Math.floor(n));
  let i = 0;
  while (n >= 1000 && i < SUFFIX.length - 1) {
    n /= 1000;
    i++;
  }
  return n.toFixed(1) + SUFFIX[i];
}

// Blocky Roblox-style head inside the avatar bubble. look = [skin, hair, background]
function hashLook(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const skins = ['#f6c99c', '#f1b07a', '#ffe48a', '#7ef0a6', '#9fd0ff', '#ffffff', '#d7b2ff'];
  const hairs = ['#b0521c', '#2b2b3d', '#13702a', '#ff5ccf', '#1f6bff', '#a8461a', '#ffb31a'];
  return [skins[h % skins.length], hairs[(h >> 3) % hairs.length], '#ffffff'];
}

function drawHead(g, look, cx, cy, r) {
  const [skin, hair, bg] = look;
  g.fillStyle = bg;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
  const s = r * 1.15;
  const x = cx - s / 2;
  const y = cy - s / 2 + r * 0.12;
  g.fillStyle = skin;
  g.fillRect(x, y, s, s);
  // hair / hood: top band and sides
  g.fillStyle = hair;
  g.fillRect(x - s * 0.06, y - s * 0.12, s * 1.12, s * 0.36);
  g.fillRect(x - s * 0.06, y, s * 0.16, s * 0.55);
  g.fillRect(x + s * 0.9, y, s * 0.16, s * 0.4);
  // eyes + smile
  g.fillStyle = '#16142c';
  g.fillRect(x + s * 0.28, y + s * 0.44, s * 0.1, s * 0.16);
  g.fillRect(x + s * 0.62, y + s * 0.44, s * 0.1, s * 0.16);
  g.lineWidth = s * 0.06;
  g.strokeStyle = '#16142c';
  g.beginPath();
  g.arc(cx, y + s * 0.62, s * 0.16, 0.2 * Math.PI, 0.8 * Math.PI);
  g.stroke();
}

// --- small canvas helpers ----------------------------------------------------
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function outlinedText(g, text, x, y, { size, font = FONTS.fredoka, fill = '#fff', stroke = '#121838', width, italic = false, align = 'left' }) {
  g.save();
  g.font = `${italic ? 'italic ' : ''}${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = width ?? size * 0.22;
  g.strokeStyle = stroke;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
  g.restore();
}

function fitSize(g, text, maxW, size, min) {
  let s = size;
  g.font = `${s}px ${FONTS.fredoka}`;
  while (s > min && g.measureText(text).width > maxW) {
    s -= 1;
    g.font = `${s}px ${FONTS.fredoka}`;
  }
  return s;
}

function drawIcon(g, kind, x, y, s) {
  g.save();
  g.translate(x, y);
  g.lineJoin = 'round';
  g.lineWidth = s * 0.09;
  g.strokeStyle = '#10204a';
  if (kind === 'trophy') {
    const grad = g.createLinearGradient(0, -s * 0.45, 0, s * 0.45);
    grad.addColorStop(0, '#ffe866');
    grad.addColorStop(1, '#f09000');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-s * 0.4, -s * 0.42);
    g.lineTo(s * 0.4, -s * 0.42);
    g.lineTo(s * 0.32, 0);
    g.quadraticCurveTo(0, s * 0.18, -s * 0.32, 0);
    g.closePath();
    g.stroke();
    g.fill();
    g.beginPath();
    g.rect(-s * 0.08, 0.04 * s, s * 0.16, s * 0.2);
    g.rect(-s * 0.3, s * 0.24, s * 0.6, s * 0.16);
    g.stroke();
    g.fill();
  } else if (kind === 'shoe') {
    g.rotate(-0.55);
    const grad = g.createLinearGradient(0, -s * 0.4, 0, s * 0.3);
    grad.addColorStop(0, '#9fe0ff');
    grad.addColorStop(1, '#1f7dff');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-s * 0.48, s * 0.18);
    g.lineTo(-s * 0.4, -s * 0.34);
    g.quadraticCurveTo(-s * 0.2, -s * 0.38, -s * 0.06, -s * 0.18);
    g.lineTo(s * 0.48, s * 0.02);
    g.lineTo(s * 0.48, s * 0.18);
    g.closePath();
    g.stroke();
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.rect(-s * 0.48, s * 0.1, s * 0.96, s * 0.16);
    g.stroke();
    g.fill();
  } else {
    // Rebirth: white disc with pink ring and dark centre
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, 0, s * 0.38, 0, Math.PI * 2);
    g.stroke();
    g.fill();
    g.strokeStyle = '#ff3fa6';
    g.lineWidth = s * 0.12;
    g.beginPath();
    g.arc(0, 0, s * 0.24, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#2a1036';
    g.beginPath();
    g.arc(0, 0, s * 0.09, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// --- board -------------------------------------------------------------------
export class Leaderboard {
  constructor(stat) {
    this.stat = stat;
    this.cfg = BOARDS[stat];
    this.root = new THREE.Group();
    this.rows = mergeLeaderboard(stat, []);
    const c = this.cfg;
    const add = (m, x, y, z) => {
      m.position.set(x, y, z);
      this.root.add(m);
      return m;
    };
    const dot = (w, h, d, color, extra = {}) => studBox(w, h, d, color, { unit: 2.6, cells: 2, style: 'dot', ...extra });

    // Plinth: navy slab, glowing band, navy slab
    add(dot(24, 1.3, 7.4, NAVY_DARK), 0, 0.65, 0);
    const glowColor = new THREE.Color(c.glow);
    add(plainBox(23.2, 0.9, 6.8, c.glow, { emissive: glowColor, emissiveIntensity: 0.9 }), 0, 1.75, 0);
    add(dot(22.2, 1.4, 6.2, NAVY), 0, 2.9, 0);

    const fy = BASE_H + FH / 2;

    // Dark back pillar
    add(dot(21, FH + 1, 3, NAVY_DARK), 0, fy, -2.2);

    // Studded frame + inner lip around the screen
    add(studBox(FW, FH, 2, FRAME, { unit: 2.6, cells: 2, style: 'dot', contrast: 0.9, emissive: 0x6f9ce8, emissiveIntensity: 0.35 }), 0, fy, 0);
    const lipT = 0.6;
    add(plainBox(SW + lipT * 2, lipT, 0.5, FRAME_LIP), 0, fy + SH / 2 + lipT / 2, 1.05);
    add(plainBox(SW + lipT * 2, lipT, 0.5, FRAME_LIP), 0, fy - SH / 2 - lipT / 2, 1.05);
    add(plainBox(lipT, SH, 0.5, FRAME_LIP), -SW / 2 - lipT / 2, fy, 1.05);
    add(plainBox(lipT, SH, 0.5, FRAME_LIP), SW / 2 + lipT / 2, fy, 1.05);

    // Two-tier navy cap
    add(dot(22.6, 1.8, 5.4, NAVY), 0, BASE_H + FH + 0.9, -0.4);
    add(dot(19.6, 1.2, 4.2, NAVY_DARK), 0, BASE_H + FH + 2.4, -0.4);

    // Glowing side strips: inner (tall, bright) and outer (shorter, tinted)
    for (const sx of [-1, 1]) {
      const inner = dot(1.9, FH - 3, 1.9, c.inner, { emissive: new THREE.Color(c.inner).getHex(), emissiveIntensity: 0.45 });
      add(inner, sx * (FW / 2 + 1.0), BASE_H + (FH - 3) / 2 + 1, -0.6);
      const outer = dot(1.9, FH - 8, 1.9, c.outer, { emissive: new THREE.Color(c.outer).getHex(), emissiveIntensity: 0.35 });
      add(outer, sx * (FW / 2 + 3.0), BASE_H + (FH - 8) / 2 + 2.5, -1.0);
    }

    // Screen
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.texture = canvasTexture(this.canvas);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }));
    add(screen, 0, fy, 1.02);

    // Header
    const title = textSprite([{ text: c.title, size: 150, font: FONTS.fredoka, fill: c.titleFill, stroke: '#0d1846', strokeWidth: 22 }], 6.8);
    add(title, 0, BASE_H + FH + 11, 0);
    const sub = textSprite([{ text: 'Global Leaderboard', size: 64, font: FONTS.montserrat, weight: 800, fill: '#ffffff', stroke: '#141a3a', strokeWidth: 11 }], 2.7);
    add(sub, 0, BASE_H + FH + 6.3, 0);

    // Lean the tower (everything between the plinth and the header) back slightly.
    const tower = new THREE.Group();
    tower.position.y = BASE_H;
    tower.rotation.x = -0.07;
    for (const child of this.root.children.slice(3, -2)) {
      child.position.y -= BASE_H;
      tower.add(child);
    }
    this.root.add(tower);

    this.draw();
  }

  setRows(rows) {
    this.rows = Array.isArray(rows) ? rows.slice(0, 9) : [];
    this.draw();
  }

  draw() {
    const g = this.canvas.getContext('2d');
    const c = this.cfg;

    // Light-blue studded screen with a soft inner shadow
    g.fillStyle = '#8db8f1';
    g.fillRect(0, 0, W, H);
    const step = 22 * K;
    for (let y = 6 * K; y < H; y += step) {
      for (let x = 6 * K; x < W; x += step) {
        g.fillStyle = 'rgba(40,80,170,0.18)';
        g.fillRect(x + 2 * K, y + 2 * K, 12 * K, 12 * K);
        g.fillStyle = 'rgba(200,225,255,0.55)';
        g.fillRect(x, y, 12 * K, 12 * K);
      }
    }
    const shade = g.createLinearGradient(0, 0, 0, 24 * K);
    shade.addColorStop(0, 'rgba(30,60,130,0.35)');
    shade.addColorStop(1, 'rgba(30,60,130,0)');
    g.fillStyle = shade;
    g.fillRect(0, 0, W, 24 * K);

    const pad = 14 * K;
    const gap = 8 * K;
    const rowH = (H - pad * 2 - gap * 8) / 9;
    for (let i = 0; i < 9; i++) {
      const y = pad + i * (rowH + gap);
      const x0 = pad;
      const rw = W - pad * 2;
      const cy = y + rowH / 2;
      const r = this.rows[i];

      // Row pill: darker translucent blue, light top edge, dark bottom edge
      roundRect(g, x0, y, rw, rowH, 9 * K);
      const rg = g.createLinearGradient(0, y, 0, y + rowH);
      rg.addColorStop(0, 'rgba(92,138,222,0.78)');
      rg.addColorStop(1, 'rgba(58,94,178,0.82)');
      g.fillStyle = rg;
      g.fill();
      g.lineWidth = 3 * K;
      g.strokeStyle = 'rgba(24,42,104,0.7)';
      g.stroke();
      g.fillStyle = 'rgba(200,225,255,0.45)';
      g.fillRect(x0 + 10 * K, y + 3 * K, rw - 20 * K, 2 * K);
      // accent tint on the left edge for the top three
      if (i < 3 && r) {
        g.fillStyle = ['rgba(255,198,26,0.35)', 'rgba(235,242,255,0.3)', 'rgba(255,90,26,0.32)'][i];
        roundRect(g, x0, y, 70 * K, rowH, 9 * K);
        g.fill();
      }

      // Rank
      const rankFill = i === 0 ? '#ffb81c' : i === 1 ? '#e6eeff' : i === 2 ? '#ff4b1a' : '#ffffff';
      outlinedText(g, `#${i + 1}`, x0 + 12 * K, cy, { size: 38 * K, fill: rankFill, italic: true, width: 8 * K });

      if (!r) {
        if (i === 0 && this.rows.length === 0) {
          outlinedText(g, 'Be the first!', W / 2 + 24 * K, cy, { size: 30 * K, align: 'center', width: 6 * K });
        }
        continue;
      }

      // Avatar bubble
      const ax = x0 + 100 * K;
      const ar = 24 * K;
      g.save();
      g.beginPath();
      g.arc(ax, cy, ar, 0, Math.PI * 2);
      g.fillStyle = '#eef3ff';
      g.fill();
      g.clip();
      const img = loadAvatarImage(r.avatar, () => this.draw());
      if (img?.complete && img.naturalWidth) g.drawImage(img, ax - ar, cy - ar, ar * 2, ar * 2);
      else drawHead(g, r.look || hashLook(r.name), ax, cy, ar);
      g.restore();
      g.beginPath();
      g.arc(ax, cy, ar, 0, Math.PI * 2);
      g.lineWidth = 2 * K;
      g.strokeStyle = 'rgba(20,30,70,0.6)';
      g.stroke();

      // Value + icon (right), name shrinks to fit between avatar and value
      const val = formatBoard(r.value);
      const iconX = W - pad - 28 * K;
      const valRight = iconX - 30 * K;
      outlinedText(g, val, valRight, cy, { size: 27 * K, fill: c.value, align: 'right', width: 6 * K });
      drawIcon(g, c.icon, iconX, cy, 44 * K);

      g.font = `${27 * K}px ${FONTS.fredoka}`;
      const valW = g.measureText(val).width;
      const nameX = ax + ar + 10 * K;
      const name = `@${r.name}`;
      const maxW = valRight - valW - 12 * K - nameX;
      const size = fitSize(g, name, maxW, 31 * K, 14 * K);
      outlinedText(g, name, nameX, cy, { size, width: Math.max(3 * K, size * 0.2) });
    }
    this.texture.needsUpdate = true;
  }
}
