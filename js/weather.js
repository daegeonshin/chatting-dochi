import * as THREE from 'three';

// 날씨는 시간으로만 정해짐 → 같은 시각이면 누구 폰에서든 같은 날씨 (4단계 친구 공유 대비)
export const WEATHERS = {
  clear: { icon: '☀️', name: '맑음' },
  cloudy: { icon: '☁️', name: '흐림' },
  rain: { icon: '🌧️', name: '비' },
  snow: { icon: '❄️', name: '눈' },
};
const SLOT = 7 * 60 * 1000; // 7분마다 날씨가 바뀔 수 있음
function hash(n) {
  n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}
export function weatherAt(ms) {
  const r = hash(Math.floor(ms / SLOT) + 20261121);
  return r < 0.42 ? 'clear' : r < 0.7 ? 'cloudy' : r < 0.95 ? 'rain' : 'snow';
}

const BOX = { x: 44, y: 26, z: 44 };

export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.override = null; // 테스트용
    this.kind = weatherAt(Date.now());
    this.cloud = 0; this.wet = 0; this.snowy = 0; // 0~1로 서서히 바뀜
    // 비 (짧은 선)
    const RN = 1400;
    const rp = new Float32Array(RN * 6);
    this.rainSeed = [];
    for (let i = 0; i < RN; i++) {
      const x = (Math.random() - 0.5) * BOX.x, y = Math.random() * BOX.y, z = (Math.random() - 0.5) * BOX.z;
      this.rainSeed.push({ x, y, z, v: 22 + Math.random() * 8 });
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0, depthWrite: false }));
    this.rain.frustumCulled = false;
    // 눈 (점)
    const SN = 1100;
    const sp = new Float32Array(SN * 3);
    this.snowSeed = [];
    for (let i = 0; i < SN; i++) this.snowSeed.push({ x: (Math.random() - 0.5) * BOX.x, y: Math.random() * BOX.y, z: (Math.random() - 0.5) * BOX.z, v: 1.4 + Math.random() * 1.2, p: Math.random() * 6 });
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0, depthWrite: false }));
    this.snow.frustumCulled = false;
    scene.add(this.rain, this.snow);
    this.onChange = null;
  }
  get raining() { return this.kind === 'rain'; }
  get info() { return WEATHERS[this.kind]; }

  update(dt, center) {
    const k = this.override || weatherAt(Date.now());
    if (k !== this.kind) { this.kind = k; this.onChange && this.onChange(k); }
    const goal = { clear: [0, 0, 0], cloudy: [0.55, 0, 0], rain: [1, 1, 0], snow: [0.6, 0, 1] }[k];
    const a = Math.min(1, dt * 0.5);
    this.cloud += (goal[0] - this.cloud) * a;
    this.wet += (goal[1] - this.wet) * a;
    this.snowy += (goal[2] - this.snowy) * a;

    this.rain.visible = this.wet > 0.02;
    this.rain.material.opacity = this.wet * 0.55;
    if (this.rain.visible) {
      const p = this.rain.geometry.attributes.position.array;
      this.rainSeed.forEach((d, i) => {
        d.y -= d.v * dt; if (d.y < 0) d.y += BOX.y;
        const x = center.x + d.x, z = center.z + d.z, y = center.y - 4 + d.y;
        p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z;
        p[i * 6 + 3] = x + 0.05; p[i * 6 + 4] = y + 0.7; p[i * 6 + 5] = z;
      });
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    this.snow.visible = this.snowy > 0.02;
    this.snow.material.opacity = this.snowy * 0.95;
    if (this.snow.visible) {
      const p = this.snow.geometry.attributes.position.array;
      const t = performance.now() / 1000;
      this.snowSeed.forEach((d, i) => {
        d.y -= d.v * dt; if (d.y < 0) d.y += BOX.y;
        p[i * 3] = center.x + d.x + Math.sin(t + d.p) * 0.6; p[i * 3 + 1] = center.y - 4 + d.y; p[i * 3 + 2] = center.z + d.z + Math.cos(t * 0.8 + d.p) * 0.6;
      });
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
  }
}
