import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
export function mesh(geo, color, opts) {
  const m = new THREE.Mesh(geo, typeof color === 'number' ? mat(color, opts) : color);
  return m;
}
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
// 시드 고정 난수 (매번 같은 숲)
export function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// 머리 위 이름표
export function makeLabel(text, color = '#ffffff', bg = 'rgba(176,80,122,0.85)') {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = 'bold 44px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  c.width = w; c.height = 64;
  ctx.font = font;
  ctx.fillStyle = bg;
  const r = 30;
  ctx.beginPath(); ctx.roundRect(0, 2, w, 60, r); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  sp.scale.set(w / 64 * 0.42, 0.42, 1);
  sp.renderOrder = 10;
  return sp;
}

// 이모지 말풍선 (하트, 배고픔 등)
const emoCache = new Map();
export function emojiSprite(emo, size = 0.6) {
  if (!emoCache.has(emo)) {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const ctx = c.getContext('2d');
    ctx.font = '72px "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emo, 48, 54);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    emoCache.set(emo, tex);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoCache.get(emo), depthWrite: false, transparent: true }));
  sp.scale.set(size, size, 1);
  sp.renderOrder = 11;
  return sp;
}

// 둥근 그림자
let shadowTex;
export function blobShadow(r = 0.6) {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(40,40,60,0.38)'); g.addColorStop(1, 'rgba(40,40,60,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

// 떠오르는 효과 (하트 등)
export class Floaters {
  constructor(scene) { this.scene = scene; this.list = []; }
  add(emo, pos, size = 0.5) {
    const s = emojiSprite(emo, size);
    s.position.copy(pos);
    this.scene.add(s);
    this.list.push({ s, t: 0, vx: rand(-0.3, 0.3) });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.t += dt;
      f.s.position.y += dt * 0.9;
      f.s.position.x += f.vx * dt;
      f.s.material.opacity = Math.max(0, 1 - f.t / 1.4);
      if (f.t > 1.4) { this.scene.remove(f.s); f.s.material.dispose(); this.list.splice(i, 1); }
    }
  }
}
