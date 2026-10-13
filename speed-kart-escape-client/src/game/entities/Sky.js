// Sky dome: deep blue zenith fading to a bright cyan horizon, with soft white
// cumulus clouds like the default Roblox sky seen over the walls in the reference.

import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w; // always at the far plane
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.2, 1.0);
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.25, h));
    col = mix(col, uZenith, smoothstep(0.25, 0.85, h));

    if (d.y > 0.0) {
      // Project onto a cloud plane so clouds flatten toward the horizon.
      vec2 uv = d.xz / (d.y + 0.18) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
      float n = fbm(uv);
      float detail = fbm(uv * 3.1 + 5.0);
      float cloud = smoothstep(0.48, 0.78, n + detail * 0.18);
      float shade = smoothstep(0.45, 0.95, n + detail * 0.25);
      vec3 cloudCol = mix(vec3(0.80, 0.88, 1.0), vec3(1.0), shade);
      float fade = smoothstep(0.0, 0.18, d.y);
      col = mix(col, cloudCol, cloud * fade * 0.95);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export class Sky {
  constructor() {
    this.uniforms = {
      uTime: { value: 0 },
      uZenith: { value: new THREE.Color('#0b4fd0') },
      uMid: { value: new THREE.Color('#1592f5') },
      uHorizon: { value: new THREE.Color('#5fdcff') },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), mat);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
  }

  update(dt, cameraPos) {
    this.uniforms.uTime.value += dt;
    this.mesh.position.copy(cameraPos);
  }
}
