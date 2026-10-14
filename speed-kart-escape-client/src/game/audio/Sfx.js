// Procedural audio (no audio files): two background music tracks that take turns,
// kart engine, and sound effects. Starts on the first user gesture (browser rule).
//
// Music rotation: "Fresh Sax" -> "Turbo Race" -> "Classical", 2 min each with
// 10 s of silence between them, repeating. Music dips quietly whenever a sound effect plays.

import { MusicPlayer } from './Music.js';

function hallImpulse(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

class SfxEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engine = null;
    this.volume = 0.6;
    this.muted = false;
    this.musicOn = true;
    this.lastClick = 0;
    const unlock = () => {
      this.ensure();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // Every button press makes a water-drop "bloop".
    document.addEventListener('pointerdown', (e) => {
      if (e.target?.closest?.('button')) this.click();
    });
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? this.musicGain : 0;
    this.musicBus.connect(this.master);
    // polish: gentle compression + a soft hall reverb on the music
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    const verb = this.ctx.createConvolver();
    verb.buffer = hallImpulse(this.ctx, 2.4);
    const wet = this.ctx.createGain();
    wet.gain.value = 0.32;
    const musicIn = this.ctx.createGain();
    musicIn.connect(comp);
    musicIn.connect(verb);
    verb.connect(wet);
    wet.connect(comp);
    comp.connect(this.musicBus);
    this.music = new MusicPlayer(this.ctx, musicIn);
    this.music.start();
    this.tryMusicFiles(musicIn);
    this.startEngine();
    return true;
  }

  // If real music files are added to public/music/ (1.mp3, 2.mp3, 3.mp3 …) they are
  // played instead of the built-in music, taking turns with 10 s of silence between.
  async tryMusicFiles(out) {
    const buffers = [];
    for (let i = 1; i <= 6; i++) {
      try {
        const res = await fetch(`./music/${i}.mp3`);
        if (!res.ok || !(res.headers.get('content-type') || '').includes('audio')) break;
        buffers.push(await this.ctx.decodeAudioData(await res.arrayBuffer()));
      } catch {
        break;
      }
    }
    if (!buffers.length) return;
    this.music.stop();
    let i = 0;
    const play = () => {
      const src = this.ctx.createBufferSource();
      src.buffer = buffers[i % buffers.length];
      src.connect(out);
      src.onended = () => {
        i++;
        setTimeout(play, 10_000);
      };
      src.start();
    };
    play();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  // Boxity music_volume (0..1) scales the music bus
  get musicGain() {
    return 0.55 * (this.musicLevel ?? 1);
  }

  setMusicLevel(v) {
    this.musicLevel = Math.max(0, Math.min(1, v));
    if (this.musicBus && this.musicOn) this.musicBus.gain.setTargetAtTime(this.musicGain, this.ctx.currentTime, 0.1);
  }

  setMuted(m) {
    this.muted = m;
    this.setVolume(this.volume);
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? this.musicGain : 0, this.ctx.currentTime, 0.1);
  }

  // Lower the music briefly so sound effects stand out.
  duck(len = 0.6) {
    if (!this.musicBus || !this.musicOn) return;
    const g = this.musicBus.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.2, t, 0.04);
    g.setTargetAtTime(this.musicGain, t + len, 0.35);
  }

  // Racing engine: a smooth, rising "whine" that revs up through the gears like a
  // race car (pitch climbs, drops a little on each gear change, climbs again).
  // Soft filtering keeps it easy on the ears.
  startEngine() {
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    const harm = c.createOscillator();
    harm.type = 'triangle';
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.5;
    filter.frequency.value = 600;
    const harmGain = c.createGain();
    harmGain.gain.value = 0.5;
    const vib = c.createOscillator();
    vib.frequency.value = 6;
    const vibAmt = c.createGain();
    vibAmt.gain.value = 1.5;
    vib.connect(vibAmt);
    vibAmt.connect(osc.frequency);
    const gain = c.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    harm.connect(harmGain);
    harmGain.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    for (const n of [osc, harm, vib]) n.start();
    this.engine = { osc, harm, filter, gain, wasOn: false };
  }

  // speed01: 0..1 of the kart's top speed; throttle: is the player driving
  updateEngine(speed01, throttle) {
    if (!this.engine) return;
    const e = this.engine;
    const t = this.ctx.currentTime;
    // three gears: the pitch rises through each, then dips at the shift
    const g = Math.min(2.999, speed01 * 3);
    const gear = Math.floor(g);
    const rev = g - gear;
    const f = speed01 > 0.02 ? 85 + gear * 22 + rev * 120 + (throttle ? 6 : 0) : 70;
    e.osc.frequency.setTargetAtTime(f, t, 0.06);
    e.harm.frequency.setTargetAtTime(f * 2, t, 0.06);
    e.filter.frequency.setTargetAtTime(f * 3.2, t, 0.08);
    e.gain.gain.setTargetAtTime(speed01 > 0.02 ? 0.025 + speed01 * 0.02 : 0.01, t, 0.15); // quieter engine
    const on = speed01 > 0.05;
    if (on !== e.wasOn && this.musicBus && this.musicOn) {
      this.musicBus.gain.setTargetAtTime(on ? this.musicGain * 0.73 : this.musicGain, t, 0.4);
      e.wasOn = on;
    }
  }

  tone(freq, start, dur, { type = 'sine', vol = 0.25, slide = 1, attack = 0.005 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  blip(freq, dur = 0.12, type = 'sine', vol = 0.25, slide = 1.5) {
    if (!this.ensure()) return;
    this.tone(freq, this.ctx.currentTime, dur, { type, vol, slide });
  }

  // Water drop: a quick upward "bloop".
  click() {
    const now = performance.now();
    if (now - this.lastClick < 70 || !this.ensure()) return;
    this.lastClick = now;
    const t = this.ctx.currentTime;
    this.tone(420, t, 0.09, { vol: 0.28, slide: 3.2 });
    this.tone(1300, t + 0.05, 0.05, { vol: 0.08, slide: 1.4 });
    this.duck(0.3);
  }

  pop() {
    this.blip(660 + Math.random() * 120, 0.09, 'triangle', 0.1, 1.8);
  }

  // Coin pickup: bright two-note "ka-ching" with a sparkle.
  coin() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    this.tone(988, t, 0.09, { type: 'square', vol: 0.09 });
    this.tone(1319, t + 0.07, 0.28, { type: 'square', vol: 0.09 });
    this.tone(2637, t + 0.07, 0.3, { vol: 0.05 });
    this.duck(0.5);
  }

  // Trophy / stage win: rising fanfare with a shimmering final chord.
  trophy() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.1, 0.22, { type: 'triangle', vol: 0.18 }));
    for (const f of [1047, 1319, 1568, 2093]) this.tone(f, t + 0.45, 1.1, { type: 'triangle', vol: 0.09, attack: 0.02 });
    for (let i = 0; i < 6; i++) this.tone(2600 + i * 300, t + 0.5 + i * 0.07, 0.15, { vol: 0.05 });
    this.duck(1.8);
  }

  // Final stage win: a big brass-like fanfare with drum hits, a held major chord and
  // a shower of sparkles.
  victory() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    // drum roll into the fanfare
    for (let i = 0; i < 8; i++) this.tone(110, t + i * 0.06, 0.08, { type: 'triangle', vol: 0.12 + i * 0.015, slide: 0.7 });
    // ta-ta-ta-taaa
    const lead = [[523, 0.5, 0.14], [523, 0.66, 0.14], [523, 0.82, 0.14], [698, 0.98, 0.5], [784, 1.5, 0.18], [880, 1.7, 0.18], [1047, 1.9, 1.4]];
    for (const [f, at, d] of lead) {
      this.tone(f, t + at, d, { type: 'sawtooth', vol: 0.07, attack: 0.02 });
      this.tone(f, t + at, d, { type: 'triangle', vol: 0.14, attack: 0.01 });
      this.tone(f / 2, t + at, d, { type: 'triangle', vol: 0.08, attack: 0.01 });
    }
    // big held chord
    for (const f of [523, 659, 784, 1047, 1319]) this.tone(f, t + 1.9, 1.8, { type: 'triangle', vol: 0.07, attack: 0.03 });
    // crash hits
    for (const at of [0.98, 1.9]) this.tone(60, t + at, 0.4, { type: 'triangle', vol: 0.3, slide: 0.5 });
    // sparkles
    for (let i = 0; i < 14; i++) this.tone(2200 + ((i * 397) % 1600), t + 2.0 + i * 0.09, 0.14, { vol: 0.045 });
    this.duck(3.8);
  }

  levelUp() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.09, 0.18, { type: 'triangle', vol: 0.2 }));
    this.duck(0.8);
  }

  // Crash / fall: a soft "bonk", a cartoon slide-whistle drop and a gentle low thud.
  dead() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    this.tone(180, t, 0.12, { type: 'triangle', vol: 0.22, slide: 0.6 });
    this.tone(880, t + 0.08, 0.75, { vol: 0.14, slide: 0.25, attack: 0.02 });
    this.tone(1320, t + 0.08, 0.75, { vol: 0.04, slide: 0.25, attack: 0.02 });
    this.tone(90, t + 0.8, 0.35, { vol: 0.25, slide: 0.6 });
    [392, 370, 349, 330].forEach((f, i) => this.tone(f, t + 1.0 + i * 0.16, 0.22, { type: 'triangle', vol: 0.09 }));
    this.duck(1.8);
  }

  error() {
    this.blip(220, 0.18, 'square', 0.1, 0.7);
  }

  reward() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    [784, 988, 1175].forEach((f, i) => this.tone(f, t + i * 0.07, 0.16, { vol: 0.22 }));
    this.duck(0.6);
  }
}

export const sfx = new SfxEngine();
