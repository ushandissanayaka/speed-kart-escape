// Arcade kart physics with camera-relative controls: the input vector (keys or
// thumbstick) is turned into a world direction using the camera's heading, the kart
// steers toward that direction and drives forward. Also handles wall sliding,
// ground height following and treadmill parking.

import { kartTopVelocity, treadmillAt } from '../../shared/gameData.js';

const RADIUS = 5.2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class KartController {
  constructor(collision) {
    this.collision = collision;
    this.x = 0;
    this.z = 0;
    this.y = 0;
    this.ry = 0;
    this.v = 0;
    this.steer = 0;
    this.accel = 0;
    this.topSpeed = 40;
    this.onTreadmill = null;
    this.driving = false;
    this.jumpY = 0; // height above the ground while jumping
    this.vy = 0;
  }

  place(x, z, ry) {
    this.x = x;
    this.z = z;
    this.ry = ry;
    this.v = 0;
    this.jumpY = 0;
    this.vy = 0;
    this.y = this.collision.heightAt(x, z);
  }

  setStats(speedStat, kartId, customSpeed, level) {
    this.topSpeed = kartTopVelocity(speedStat, kartId, customSpeed, level);
  }

  // move: { x: right, y: forward } relative to the camera; camFwd: camera forward on XZ.
  update(dt, move, camFwd, jump = false) {
    const top = this.topSpeed;
    const prevV = this.v;

    let fx = camFwd.x;
    let fz = camFwd.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    // camera right = forward x up
    const dx = fx * move.y - fz * move.x;
    const dz = fz * move.y + fx * move.x;
    const mag = Math.min(1, Math.hypot(dx, dz));
    this.driving = mag > 0.12;

    let steerTarget = 0;
    if (this.driving) {
      const diff = wrap(Math.atan2(dx, dz) - this.ry);
      // Turn toward the wanted direction; still turns when parked so you can't get stuck.
      const turnRate = 2.4 - Math.min(0.8, Math.abs(this.v) / 180);
      const step = Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
      this.ry = wrap(this.ry + step);
      steerTarget = Math.max(-1, Math.min(1, diff * 1.6));
      // Ease off the throttle during sharp turns so U-turns stay tight.
      const throttle = mag * (Math.abs(diff) > 1.7 ? 0.35 : Math.abs(diff) > 0.8 ? 0.7 : 1);
      const wanted = top * throttle;
      const a = this.v < wanted ? 26 + top * 0.55 : 40;
      this.v = this.v < wanted ? Math.min(wanted, this.v + a * dt) : Math.max(wanted, this.v - a * dt);
    } else {
      const drag = 30 * dt;
      this.v = Math.abs(this.v) <= drag ? 0 : this.v - Math.sign(this.v) * drag;
    }
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 10);

    const hx = Math.sin(this.ry);
    const hz = Math.cos(this.ry);
    const res = this.collision.resolve(this.x + hx * this.v * dt, this.z + hz * this.v * dt, RADIUS);
    if (res.hit) {
      // Lose the velocity component going into the wall, keep sliding along it.
      const into = hx * res.nx + hz * res.nz;
      if (into < -0.2) this.v *= 1 - Math.min(0.9, Math.abs(into) * 0.9);
    }
    this.x = res.x;
    this.z = res.z;

    // Treadmill: letting go of the controls parks the kart on the belt (AFK training).
    this.onTreadmill = treadmillAt(this.x, this.z);
    if (this.onTreadmill && !this.driving && Math.abs(this.v) < 4) this.v = 0;

    const ground = this.collision.heightAt(this.x, this.z);
    this.y += (ground - this.y) * Math.min(1, dt * 14);

    // Jump (Space / Jump button): a short hop that clears the sliding logs.
    if (jump && this.jumpY === 0) this.vy = 27;
    if (this.vy !== 0 || this.jumpY > 0) {
      this.jumpY += this.vy * dt;
      this.vy -= 72 * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.vy = 0;
      }
    }
    this.accel = (this.v - prevV) / Math.max(dt, 1e-3);
  }
}
