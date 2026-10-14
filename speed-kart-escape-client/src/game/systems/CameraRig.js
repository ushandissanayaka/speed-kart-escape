// Roblox "Classic" third-person camera: follows the kart's position but keeps its own
// heading, which only the player changes (mouse drag, touchpad, one-finger drag).
// That keeps camera-relative controls stable: "left" on screen stays left.
// Zoom: wheel, touchpad pinch, two-finger pinch.

import * as THREE from 'three';

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.yaw = 0; // world heading of the camera (camera sits at target + dir(yaw))
    this.pitch = 0.3;
    this.distance = 36;
    this.minDist = 10;
    this.maxDist = 90;
    this.target = new THREE.Vector3();
    this.bounds = null; // { minX, maxX, minZ, maxZ } the camera must stay inside

  }

  // Drag deltas in screen pixels
  orbit(dx, dy) {
    const k = this.sensitivity ?? 1; // Boxity camera_sensitivity setting
    this.yaw -= dx * 0.006 * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004 * k, 0.05, 1.35);
  }

  zoom(factor) {
    this.distance = THREE.MathUtils.clamp(this.distance * factor, this.minDist, this.maxDist);
  }

  // Camera forward direction on the ground plane
  forward() {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  update(dt, pos, velocity) {
    this.target.lerp(new THREE.Vector3(pos.x, pos.y + 5.5, pos.z), Math.min(1, dt * 12));
    const full = this.distance * (1 + Math.min(0.25, Math.abs(velocity) / 400));
    let d = full;
    const dx = Math.sin(this.yaw) * Math.cos(this.pitch);
    const dz = Math.cos(this.yaw) * Math.cos(this.pitch);
    // Pull the camera in rather than letting it pass through the arena walls.
    if (this.bounds) {
      const b = this.bounds;
      if (dx > 0) d = Math.min(d, (b.maxX - this.target.x) / dx);
      if (dx < 0) d = Math.min(d, (b.minX - this.target.x) / dx);
      if (dz > 0) d = Math.min(d, (b.maxZ - this.target.z) / dz);
      if (dz < 0) d = Math.min(d, (b.minZ - this.target.z) / dz);
      d = Math.max(d, 4);
    }
    const cx = this.target.x + dx * d;
    const cz = this.target.z + dz * d;
    // Keep the full height when pulled in so the view looks down over nearby props.
    const cy = this.target.y + Math.sin(this.pitch) * full;
    this.camera.position.set(cx, Math.max(cy, 1.5), cz);
    this.camera.lookAt(this.target);
    // Mild FOV kick at speed
    const fov = 70 + Math.min(12, Math.abs(velocity) * 0.08);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }
  }

  snap(pos, heading) {
    this.yaw = heading + Math.PI;
    this.target.set(pos.x, pos.y + 5.5, pos.z);
  }

  dispose() {}
}
