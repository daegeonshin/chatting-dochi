import * as THREE from 'three';
import { DAY_MIN, NIGHT_MIN } from './data.js';
import { clamp } from './utils.js';

const DAY = DAY_MIN * 60 * 1000, NIGHT = NIGHT_MIN * 60 * 1000;
const SKY_DAY = new THREE.Color(0xa8dcff), SKY_DUSK = new THREE.Color(0xffb3a0), SKY_NIGHT = new THREE.Color(0x1c2250);

// 낮 25분, 밤은 최대 5분, 모두 자면 바로 아침
export class DayNight {
  constructor(scene, world, saved) {
    this.scene = scene; this.world = world;
    this.clock = saved && saved.phase ? { ...saved } : { phase: 'day', start: Date.now() };
    // 앱을 오래 꺼 뒀다가 켜면 그동안 흐른 시간만큼 진행
    this.catchUp(Date.now());
    this.hemi = new THREE.HemisphereLight(0xdff2ff, 0x8ed46b, 1.1);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.7);
    this.amb = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(this.hemi, this.sun, this.amb, this.sun.target);
    scene.fog = new THREE.Fog(SKY_DAY.clone(), 60, 190);
    scene.background = SKY_DAY.clone();
    this.night = 0;
    this.onChange = null; // (phase) => {}
  }
  catchUp(now) {
    for (let i = 0; i < 2000; i++) {
      const len = this.clock.phase === 'day' ? DAY : NIGHT;
      if (now - this.clock.start < len) break;
      this.clock.start += len;
      this.clock.phase = this.clock.phase === 'day' ? 'night' : 'day';
    }
  }
  get isNight() { return this.clock.phase === 'night'; }
  // 모두 잠들면 아침
  skipNight() {
    if (!this.isNight) return;
    this.clock = { phase: 'day', start: Date.now() };
    this.dawn = true;
    this.onChange && this.onChange('day');
  }
  // 테스트용
  forceNight() { this.clock = { phase: 'night', start: Date.now() }; this.onChange && this.onChange('night'); }

  update(playerPos) {
    const now = Date.now();
    const before = this.clock.phase;
    this.catchUp(now);
    if (before !== this.clock.phase) { this.dawn = this.clock.phase === 'day'; this.onChange && this.onChange(this.clock.phase); }
    const el = now - this.clock.start;
    let target;
    if (this.isNight) target = 1;
    else if (el < 20000 && this.dawn) target = 0.6 * (1 - el / 20000);
    else if (el > DAY - 60000) target = clamp((el - (DAY - 60000)) / 60000, 0, 1) * 0.85;
    else target = 0;
    this.night += (target - this.night) * 0.05;
    const n = this.night;

    // 하늘색
    const sky = this.scene.background;
    if (n < 0.5) sky.copy(SKY_DAY).lerp(SKY_DUSK, Math.sin(n * Math.PI) * 0.8);
    else sky.copy(SKY_DUSK).lerp(SKY_NIGHT, (n - 0.5) * 2);
    if (n > 0.8) sky.copy(SKY_NIGHT);
    this.scene.fog.color.copy(sky);
    this.hemi.intensity = 1.1 - n * 0.7;
    this.hemi.color.setHex(n > 0.5 ? 0x8a9aff : 0xdff2ff);
    this.sun.intensity = 1.7 - n * 1.4;
    this.sun.color.setHex(n > 0.5 ? 0xaab8ff : 0xfff4e0);
    this.amb.intensity = 0.25 + n * 0.1;

    // 해와 달
    const frac = this.isNight ? el / NIGHT : el / DAY;
    const ang = Math.PI * (0.1 + frac * 0.8);
    const p = playerPos;
    const sx = Math.cos(ang) * 300, sy = Math.sin(ang) * 220 + 20;
    this.sun.position.set(p.x + 40, 80, p.z + 30);
    this.sun.target.position.set(p.x, 0, p.z);
    this.world.sunMesh.position.set(p.x + sx, this.isNight ? -500 : sy, p.z - 200);
    this.world.moonMesh.position.set(p.x + sx, this.isNight ? sy : -500, p.z - 200);
    this.world.stars.position.set(p.x, 0, p.z);
    this.world.stars.material.opacity = clamp((n - 0.5) * 2, 0, 1);
    this.world.lampMat.emissive.setHex(n > 0.4 ? 0xffd27a : 0x000000);
    if (this.world.windowMat) this.world.windowMat.emissive.setHex(n > 0.4 ? 0xffc86a : 0x000000);
  }
  // 상단 시계 문구
  label() {
    const el = Date.now() - this.clock.start;
    const left = Math.max(0, (this.isNight ? NIGHT : DAY) - el);
    const m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
    const t = m > 0 ? `${m}분` : `${s}초`;
    return this.isNight ? { icon: '🌙', text: `아침까지 ${t}` } : { icon: '☀️', text: `밤까지 ${t}` };
  }
  serialize() { return { ...this.clock }; }
}
