// Small procedural sound kit (no audio files): kart engine hum, pickup pops,
// level-up chime and UI clicks. Starts on the first user gesture.

class SfxEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engine = null;
    this.volume = 0.6;
    this.muted = false;
    const unlock = () => {
      this.ensure();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
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
    this.startEngine();
    return true;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  setMuted(m) {
    this.muted = m;
    this.setVolume(this.volume);
  }

  startEngine() {
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    const sub = c.createOscillator();
    sub.type = 'square';
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const gain = c.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();
    sub.start();
    this.engine = { osc, sub, filter, gain };
  }

  // speed01: 0..1 of the kart's top speed; throttle: is the player pressing gas
  updateEngine(speed01, throttle) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    const f = 48 + speed01 * 120 + (throttle ? 12 : 0);
    this.engine.osc.frequency.setTargetAtTime(f, t, 0.08);
    this.engine.sub.frequency.setTargetAtTime(f / 2, t, 0.08);
    this.engine.filter.frequency.setTargetAtTime(300 + speed01 * 1300, t, 0.1);
    this.engine.gain.gain.setTargetAtTime(0.035 + speed01 * 0.05, t, 0.15);
  }

  blip(freq, dur = 0.12, type = 'sine', vol = 0.25, slide = 1.5) {
    if (!this.ensure()) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  pop() {
    this.blip(660 + Math.random() * 120, 0.09, 'triangle', 0.12, 1.8);
  }

  click() {
    this.blip(520, 0.06, 'square', 0.08, 1.2);
  }

  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.2, 1.01), i * 90));
  }

  error() {
    this.blip(220, 0.18, 'square', 0.1, 0.7);
  }

  reward() {
    [784, 988, 1175].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'sine', 0.22, 1.02), i * 70));
  }
}

export const sfx = new SfxEngine();
