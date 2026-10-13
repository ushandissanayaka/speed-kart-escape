// Movement input as a camera-relative 2D vector: x = right, y = forward (both -1..1).
// Sources: keyboard (WASD / arrows) and the on-screen thumbstick (touch / mouse).

export class Input {
  constructor() {
    this.keys = new Set();
    this.stick = { x: 0, y: 0, active: false };
    this.enabled = true;
    this.jumpPressed = false; // touch Jump button
    this.onKeyDown = (e) => {
      if (isTyping(e)) return;
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onBlur = () => this.keys.clear();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  // Thumbstick in screen space: x right, y down (-1..1)
  setStick(x, y, active) {
    this.stick.x = x;
    this.stick.y = y;
    this.stick.active = active;
  }

  read() {
    if (!this.enabled) return { x: 0, y: 0, jump: false };
    const jump = this.keys.has('Space') || this.jumpPressed;
    if (this.stick.active) return { x: clamp(this.stick.x), y: clamp(-this.stick.y), jump };
    const k = this.keys;
    const y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len, jump } : { x, y, jump };
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}

const clamp = (v) => Math.max(-1, Math.min(1, v));
const isTyping = (e) => ['INPUT', 'TEXTAREA'].includes(e.target?.tagName);
