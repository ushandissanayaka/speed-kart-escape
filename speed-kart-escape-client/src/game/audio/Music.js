// Two procedural background tracks, scheduled a little ahead of time with WebAudio:
//  - "Fresh Sax": upbeat jazzy groove — breathy saxophone melody, electric piano
//    chords, walking bass, soft hi-hats (Dm7 G7 Cmaj7 Am7).
//  - "Classical": calm piano arpeggios over a string pad (Pachelbel-style
//    progression D A Bm F#m G D G A).
// Each plays for 2 minutes, then 10 seconds of silence, then the other one.

const TRACK_SECONDS = 120;
const GAP_SECONDS = 10;
const LOOKAHEAD = 0.25;

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---- Fresh Sax -------------------------------------------------------------
const SAX = {
  bpm: 126,
  // chord tones (MIDI) per bar
  chords: [
    [50, 53, 57, 60], // Dm7
    [43, 47, 50, 53], // G7
    [48, 52, 55, 59], // Cmaj7
    [45, 48, 52, 55], // Am7
  ],
  bass: [
    [38, 41, 45, 43],
    [43, 47, 50, 49],
    [48, 47, 45, 43],
    [45, 48, 52, 50],
  ],
  // melody: [beat offset within 4 bars, midi, length in beats]; two phrases alternate
  melodies: [
    [[0, 74, 1.5], [1.5, 72, 0.5], [2, 69, 1], [3, 72, 1], [4, 71, 2], [6, 67, 1], [7, 69, 1], [8, 72, 1.5], [9.5, 74, 0.5], [10, 76, 2], [12, 72, 1], [13, 69, 1], [14, 67, 2]],
    [[0, 69, 0.5], [0.5, 72, 0.5], [1, 74, 1], [2, 77, 2], [4, 76, 1], [5, 74, 0.5], [5.5, 72, 0.5], [6, 71, 2], [8, 76, 1], [9, 74, 1], [10, 72, 1.5], [11.5, 71, 0.5], [12, 69, 3]],
  ],
};

// ---- Classical ---------------------------------------------------------------
const CLASSIC = {
  bpm: 92,
  chords: [
    [50, 54, 57], // D
    [45, 49, 52], // A
    [47, 50, 54], // Bm
    [42, 45, 49], // F#m
    [43, 47, 50], // G
    [50, 54, 57], // D
    [43, 47, 50], // G
    [45, 49, 52], // A
  ],
  melody: [78, 76, 74, 73, 71, 69, 71, 73],
};

// ---- Turbo Race: fast synth racing track ----------------------------------------
const RACE = {
  bpm: 150,
  roots: [45, 41, 43, 40], // Am F G Em
  lead: [69, 72, 76, 74, 72, 69, 67, 69, 72, 74, 76, 79, 76, 74, 72, 71],
};

// ---- Fast classical pieces (public domain), notes in sixteenths --------------------
// [start sixteenth, midi, length in sixteenths]; 2/4 time = 8 sixteenths per bar.
const melody = (bars) => {
  const out = [];
  let pos = 0;
  for (const bar of bars) for (const [m, len] of bar) {
    if (m) out.push([pos, m, len]);
    pos += len;
  }
  return { notes: out, length: pos };
};
// Mozart — Rondo alla Turca (A minor), opening theme.
const TURCA = {
  bpm: 126,
  ...melody([
    [[71, 1], [69, 1], [68, 1], [69, 1], [72, 4]],
    [[74, 1], [72, 1], [71, 1], [72, 1], [76, 4]],
    [[77, 1], [76, 1], [75, 1], [76, 1], [83, 1], [81, 1], [80, 1], [81, 1]],
    [[83, 1], [81, 1], [80, 1], [81, 1], [84, 4]],
    [[81, 2], [84, 2], [83, 2], [81, 2]],
    [[80, 2], [81, 2], [83, 2], [81, 2]],
    [[80, 2], [81, 2], [83, 2], [81, 2]],
    [[80, 2], [78, 2], [76, 4]],
  ]),
  chords: ['Am', 'Am', 'E', 'Am', 'Am', 'E', 'Am', 'E'],
};
// Rossini — William Tell Overture, galloping finale theme (A major).
const G = (n) => [[n, 1], [n, 1], [n, 2]]; // da-da-dum
const TELL = {
  bpm: 150,
  ...melody([
    [...G(76), ...G(76)],
    [...G(76), [81, 2], [83, 2]],
    [[85, 4], ...G(76)],
    [...G(76), [85, 2], [81, 2]],
    [...G(76), ...G(76)],
    [...G(81), [85, 2], [83, 2]],
    [...G(81), ...G(80)],
    [[81, 4], [76, 2], [69, 2]],
  ]),
  chords: ['A', 'A', 'A', 'E', 'A', 'A', 'E', 'A'],
};
const CHORDS = {
  Am: { root: 45, tones: [57, 60, 64] },
  E: { root: 40, tones: [56, 59, 64] },
  A: { root: 45, tones: [57, 61, 64] },
};
const PLAYLIST = [
  { step: 'tellStep', bpm: TELL.bpm, perBeat: 4 },
  { step: 'turcaStep', bpm: TURCA.bpm, perBeat: 4 },
];

export class MusicPlayer {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = out;
    this.noise = this.makeNoise();
    this.trackIndex = 0;
    this.trackStart = 0;
    this.nextTime = 0;
    this.step = 0;
    this.timer = null;
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  start() {
    this.beginTrack(0, this.ctx.currentTime + 0.3);
    this.timer = setInterval(() => this.tick(), 90);
  }

  stop() {
    clearInterval(this.timer);
  }

  beginTrack(i, at) {
    this.trackIndex = i;
    this.trackStart = at;
    this.nextTime = at;
    this.step = 0;
  }

  tick() {
    const c = this.ctx;
    if (c.state !== 'running') return;
    const horizon = c.currentTime + LOOKAHEAD;
    while (this.nextTime < horizon) {
      const elapsed = this.nextTime - this.trackStart;
      if (elapsed >= TRACK_SECONDS) {
        // 10 s of silence, then the other track
        this.beginTrack((this.trackIndex + 1) % PLAYLIST.length, this.trackStart + TRACK_SECONDS + GAP_SECONDS);
        continue;
      }
      const tr = PLAYLIST[this.trackIndex];
      this[tr.step](this.nextTime, this.step);
      this.nextTime += 60 / tr.bpm / tr.perBeat;
      this.step++;
    }
  }

  // ---- instruments -----------------------------------------------------------
  env(node, t, attack, peak, decay, sustain, release, dur) {
    const g = node.gain;
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(peak, t + attack);
    g.linearRampToValueAtTime(peak * sustain, t + attack + decay);
    g.setValueAtTime(peak * sustain, t + Math.max(attack + decay, dur));
    g.linearRampToValueAtTime(0.0001, t + Math.max(attack + decay, dur) + release);
  }

  sax(midi, t, dur) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = mtof(midi);
    const vib = c.createOscillator();
    vib.frequency.value = 5.2;
    const vibAmt = c.createGain();
    vibAmt.gain.setValueAtTime(0, t);
    vibAmt.gain.linearRampToValueAtTime(mtof(midi) * 0.012, t + 0.25);
    vib.connect(vibAmt);
    vibAmt.connect(o.frequency);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(700, t);
    f.frequency.linearRampToValueAtTime(1500, t + 0.1);
    f.frequency.linearRampToValueAtTime(1000, t + dur);
    // breath noise
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const nf = c.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = mtof(midi) * 3;
    const ng = c.createGain();
    this.env(ng, t, 0.03, 0.025, 0.1, 0.4, 0.1, dur);
    n.connect(nf);
    nf.connect(ng);
    ng.connect(this.out);
    const g = c.createGain();
    this.env(g, t, 0.06, 0.08, 0.12, 0.7, 0.2, dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.out);
    o.start(t);
    vib.start(t);
    n.start(t);
    const end = t + dur + 0.3;
    o.stop(end);
    vib.stop(end);
    n.stop(end);
  }

  epiano(midis, t, dur, vol = 0.035) {
    const c = this.ctx;
    for (const m of midis) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = mtof(m + 12);
      const o2 = c.createOscillator();
      o2.type = 'triangle';
      o2.frequency.value = mtof(m + 24) * 1.003;
      const g = c.createGain();
      this.env(g, t, 0.01, vol, 0.4, 0.3, 0.3, dur);
      const g2 = c.createGain();
      g2.gain.value = 0.3;
      o.connect(g);
      o2.connect(g2);
      g2.connect(g);
      g.connect(this.out);
      o.start(t);
      o2.start(t);
      o.stop(t + dur + 0.4);
      o2.stop(t + dur + 0.4);
    }
  }

  bassNote(midi, t, dur, vol = 0.14) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = mtof(midi);
    const g = c.createGain();
    this.env(g, t, 0.01, vol, 0.15, 0.5, 0.08, dur * 0.9);
    o.connect(g);
    g.connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.2);
  }

  hat(t, vol = 0.01) {
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(f);
    f.connect(g);
    g.connect(this.out);
    n.start(t);
    n.stop(t + 0.06);
  }

  piano(midi, t, dur, vol = 0.07) {
    const c = this.ctx;
    for (const [mult, type, v] of [
      [1, 'triangle', 1],
      [2, 'sine', 0.35],
      [3, 'sine', 0.12],
    ]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = mtof(midi) * mult;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * v, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);
      o.connect(g);
      g.connect(this.out);
      o.start(t);
      o.stop(t + dur + 1.3);
    }
  }

  strings(midis, t, dur, vol = 0.022) {
    const c = this.ctx;
    for (const m of midis) {
      for (const det of [-6, 6]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = det;
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 1200;
        const g = c.createGain();
        this.env(g, t, 0.6, vol, 0.2, 0.9, 0.8, dur);
        o.connect(f);
        f.connect(g);
        g.connect(this.out);
        o.start(t);
        o.stop(t + dur + 1);
      }
    }
  }

  kick(t, vol = 0.32) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g);
    g.connect(this.out);
    o.start(t);
    o.stop(t + 0.25);
  }

  snare(t, vol = 0.09) {
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    n.connect(f);
    f.connect(g);
    g.connect(this.out);
    n.start(t);
    n.stop(t + 0.18);
  }

  synth(midi, t, dur, vol = 0.05, cutoff = 2400) {
    const c = this.ctx;
    for (const det of [-8, 8]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(midi);
      o.detune.value = det;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(cutoff, t);
      f.frequency.exponentialRampToValueAtTime(cutoff * 0.35, t + dur);
      const g = c.createGain();
      this.env(g, t, 0.01, vol, 0.08, 0.6, 0.06, dur);
      o.connect(f);
      f.connect(g);
      g.connect(this.out);
      o.start(t);
      o.stop(t + dur + 0.2);
    }
  }

  raceStep(t, step) {
    const beat = 60 / RACE.bpm;
    const e = step % 8;
    const bar = Math.floor(step / 8) % 4;
    const root = RACE.roots[bar];
    if (e % 2 === 0) this.kick(t, 0.2);
    if (e === 2 || e === 6) this.snare(t, 0.05);
    if (e % 2) this.hat(t, 0.012);
    // driving octave bass on every eighth
    this.synth(root - 12 + (e % 2 ? 12 : 0), t, beat * 0.45, 0.03, 700);
    // lead melody, rests every third phrase
    if (Math.floor(step / 32) % 3 !== 2) {
      this.piano(RACE.lead[step % 16], t, beat * 0.4, 0.045); // bell-like pluck lead
      if (e === 0) this.strings([root, root + 7, root + 12], t, beat * 4, 0.012);
    }
  }

  // Shared: melody + oom-pah accompaniment for a 2/4 piece on a sixteenth grid.
  classicPiece(piece, t, step, lead) {
    const s16 = 60 / piece.bpm / 4;
    const pos = step % piece.length;
    const loop = Math.floor(step / piece.length);
    for (const [at, m, len] of piece.notes) if (at === pos) lead(m, t, len * s16, loop);
    const bar = Math.floor(pos / 8) % piece.chords.length;
    const ch = CHORDS[piece.chords[bar]];
    const e = pos % 8;
    if (e === 0 || e === 4) this.piano(ch.root + (e === 4 ? 7 : 0), t, s16 * 2, 0.07); // root, then fifth
    if (e === 2 || e === 6) for (const m of ch.tones) this.piano(m, t, s16 * 1.5, 0.028);
    return { e, s16, loop };
  }

  tellStep(t, step) {
    const { e } = this.classicPiece(TELL, t, step, (m, tt, dur, loop) => {
      // bright strings + a soft brass-like doubling for the galloping theme
      this.strings([m], tt, dur * 0.9, 0.03);
      this.synth(m, tt, dur * 0.85, 0.022, 2000);
      if (loop % 2) this.piano(m + 12, tt, dur, 0.03);
    });
    if (e === 2 || e === 6) this.snare(t, 0.03);
    if (e === 0) this.kick(t, 0.12);
  }

  turcaStep(t, step) {
    this.classicPiece(TURCA, t, step, (m, tt, dur, loop) => {
      this.piano(m, tt, dur, 0.075);
      if (loop % 2) this.piano(m - 12, tt, dur, 0.03); // octave doubling on repeats
    });
  }

  // ---- arrangements -----------------------------------------------------------
  saxStep(t, step) {
    const beat = 60 / SAX.bpm;
    const e = step % 8; // eighth within bar
    const bar = Math.floor(step / 8) % 4;
    const phrase = Math.floor(step / 32);
    // swing the off-beats
    const swing = e % 2 ? beat * 0.08 : 0;
    const tt = t + swing;
    if (e % 2 === 0) this.bassNote(SAX.bass[bar][e / 2], tt, beat);
    if (e === 2 || e === 6) this.epiano(SAX.chords[bar], tt, beat * 1.4);
    if (e % 2 === 1) this.hat(tt);
    if (e === 0 || e === 4) this.kick(t, 0.14);
    if (e === 2 || e === 6) this.snare(tt, 0.035);
    if (e === 0 || e === 4) this.hat(tt, 0.01);
    // melody (rests every other 4-bar phrase so the groove breathes)
    if (phrase % 3 === 2) return;
    const mel = SAX.melodies[phrase % 2];
    const beatInPhrase = (step % 32) / 2;
    for (const [b, midi, len] of mel) if (b === beatInPhrase) this.sax(midi, tt, len * beat * 0.95);
  }

  classicalStep(t, step) {
    const beat = 60 / CLASSIC.bpm;
    const e = step % 8;
    const bar = Math.floor(step / 8) % 8;
    const chord = CLASSIC.chords[bar];
    if (e === 0) {
      this.strings([chord[0] - 12, chord[0], chord[2]], t, beat * 4);
      this.piano(chord[0] - 12, t, beat * 2, 0.06);
    }
    // gentle broken-chord arpeggio
    const arp = [chord[0], chord[1], chord[2], chord[1] + 12, chord[2] + 12, chord[1] + 12, chord[2], chord[1]];
    this.piano(arp[e] + 12, t, beat * 0.5, 0.035);
    // slow melody on the first beat of each bar, every other cycle
    if (e === 0 && Math.floor(step / 64) % 2 === 1) this.piano(CLASSIC.melody[bar], t, beat * 3, 0.06);
  }
}
