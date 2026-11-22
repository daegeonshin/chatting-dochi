import * as THREE from 'three';
import { toon, outline, castAll, GFX } from './look.js';
import { mesh, mat, makeLabel, emojiSprite, clamp, rand } from './utils.js';
import { COLORS7, PETS, PET_HOMES } from './data.js';

// 넓은 집 (26.11.22) : 거실을 가운데 두고 방 5개가 문으로 이어짐. 앞(+z)은 카메라 쪽이라 벽 없이 열어 둠
export const ROOM = { w: 24, d: 15 }; // x : -12~12, z : -7.5~7.5
const HX = ROOM.w / 2 - 0.4, HZ = ROOM.d / 2 - 0.4;
const WALL_H = 2.6, OUT_H = 4.2;
export const ROOMS = [
  { id: 'living', name: '거실', x0: -6, x1: 6, z0: 0, z1: 7.5, floor: 'wood' },
  { id: 'bath', name: '화장실', x0: -12, x1: -6, z0: 0, z1: 7.5, floor: 'tile', tile: [0xd8f0ff, 0xbfe4fb] },
  { id: 'nursery', name: '동물 육아실', x0: 6, x1: 12, z0: 0, z1: 7.5, floor: 'carpet', tile: [0xbfe8a8, 0xb2df9a] },
  { id: 'room1', name: '작은방', x0: -12, x1: -4, z0: -7.5, z1: 0, floor: 'carpet', tile: [0xffd6e7, 0xffcadf] },
  { id: 'kitchen', name: '주방', x0: -4, x1: 4, z0: -7.5, z1: 0, floor: 'tile', tile: [0xfff4e0, 0xffe2c2] },
  { id: 'room2', name: '작은방 2', x0: 4, x1: 12, z0: -7.5, z1: 0, floor: 'carpet', tile: [0xe6dcff, 0xdacfff] },
];
// 거실과 각 방 사이 문 (axis 'z' : z = at 인 가로벽, 'x' : x = at 인 세로벽)
export const DOORS = {
  room1: { axis: 'z', at: 0, c: -5, half: 0.8 },
  kitchen: { axis: 'z', at: 0, c: 0, half: 1.5 },
  room2: { axis: 'z', at: 0, c: 5, half: 0.8 },
  bath: { axis: 'x', at: -6, c: 3.75, half: 0.85 },
  nursery: { axis: 'x', at: 6, c: 3.75, half: 0.85 },
};
// 벽 (충돌 상자). 문 자리는 비움
function wallList() {
  const T = 0.1, out = [];
  const hz = (z, xa, xb, h = WALL_H) => out.push({ x0: xa, x1: xb, z0: z - T, z1: z + T, h });
  const vx = (x, za, zb, h = WALL_H) => out.push({ x0: x - T, x1: x + T, z0: za, z1: zb, h });
  // 가운데 가로벽 z = 0 (문 3개)
  hz(0, -12, -5.8); hz(0, -4.2, -1.5); hz(0, 1.5, 4.2); hz(0, 5.8, 12);
  // 세로벽
  vx(-6, 0, 2.9); vx(-6, 4.6, 7.5); vx(6, 0, 2.9); vx(6, 4.6, 7.5);
  vx(-4, -7.5, 0); vx(4, -7.5, 0);
  // 바깥벽 (뒤, 왼쪽, 오른쪽)
  hz(-7.5 - T, -12.2, 12.2, OUT_H); vx(-12 - T, -7.6, 7.5, OUT_H); vx(12 + T, -7.6, 7.5, OUT_H);
  return out;
}
export const WALLS = wallList();
export const roomAt = (x, z) => ROOMS.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) || null;
export const roomById = id => ROOMS.find(r => r.id === id);

// 가구 모델 (바닥이 원점, 앞쪽이 +z)
const GLASS = new THREE.MeshBasicMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.35, depthWrite: false });

// 창밖 풍경 그림 (하늘, 언덕, 나무)
let viewTex = null;
function viewTexture() {
  if (viewTex) return viewTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 208;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 208); g.addColorStop(0, '#7cc6ff'); g.addColorStop(0.7, '#d4efff'); g.addColorStop(1, '#fff2f7');
  x.fillStyle = g; x.fillRect(0, 0, 256, 208);
  x.fillStyle = '#ffffff'; for (const [cx, cy, r] of [[50, 40, 18], [70, 36, 22], [92, 42, 16], [190, 60, 14], [206, 56, 18]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
  x.fillStyle = '#9fdc7a'; x.beginPath(); x.ellipse(60, 230, 160, 90, 0, 0, 7); x.fill();
  x.fillStyle = '#86cf66'; x.beginPath(); x.ellipse(220, 236, 150, 95, 0, 0, 7); x.fill();
  for (let i = 0; i < 9; i++) {
    const tx = 12 + i * 30 + (i % 2) * 8, ty = 150 + (i % 3) * 8;
    x.fillStyle = '#8a5a3a'; x.fillRect(tx - 3, ty, 6, 22);
    x.fillStyle = i % 3 ? '#4fa85c' : '#6cc35f';
    x.beginPath(); if (i % 2) { x.moveTo(tx, ty - 40); x.lineTo(tx - 18, ty + 4); x.lineTo(tx + 18, ty + 4); } else x.arc(tx, ty - 10, 18, 0, 7); x.fill();
  }
  viewTex = new THREE.CanvasTexture(c); viewTex.colorSpace = THREE.SRGBColorSpace;
  return viewTex;
}

export function makeFurniture(id, color = 0xffb3c8, data = {}) {
  const g = new THREE.Group();
  let r = 0.6, walk = false, spot = null;
  const wood = 0xc8905a, dark = new THREE.Color(color).multiplyScalar(0.8).getHex();
  const box = (w, h, d, c, x, y, z) => { const m = mesh(new THREE.BoxGeometry(w, h, d), c); m.position.set(x, y, z); g.add(m); return m; };
  const cyl = (rt, rb, h, c, x, y, z, seg = 16) => { const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c); m.position.set(x, y, z); g.add(m); return m; };
  const sph = (rad, c, x, y, z) => { const m = mesh(new THREE.SphereGeometry(rad, 12, 10), c); m.position.set(x, y, z); g.add(m); return m; };
  switch (id) {
    case 'bed':
      box(2.2, 0.45, 3.2, wood, 0, 0.22, 0);
      box(2.2, 1.3, 0.2, wood, 0, 0.65, -1.6);
      box(2.05, 0.3, 3.0, 0xffffff, 0, 0.58, 0.02);
      box(2.1, 0.12, 2.0, color, 0, 0.76, 0.5);
      { const p = mesh(new THREE.CapsuleGeometry(0.25, 0.9, 4, 8), 0xffffff); p.rotation.z = Math.PI / 2; p.position.set(0, 0.85, -1.15); g.add(p); }
      r = 1.4; break;
    case 'chair':
      box(0.7, 0.1, 0.7, color, 0, 0.5, 0);
      box(0.7, 0.7, 0.1, color, 0, 0.9, -0.3);
      for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) box(0.08, 0.5, 0.08, wood, x, 0.25, z);
      r = 0.5; break;
    case 'table':
      cyl(0.9, 0.9, 0.1, color, 0, 0.78, 0, 24);
      cyl(0.1, 0.12, 0.75, wood, 0, 0.38, 0);
      cyl(0.45, 0.5, 0.06, wood, 0, 0.03, 0);
      r = 0.95; break;
    case 'sofa':
      box(2.2, 0.45, 0.95, color, 0, 0.3, 0);
      box(2.2, 0.75, 0.25, color, 0, 0.75, -0.38);
      for (const s of [-1, 1]) box(0.25, 0.6, 0.95, dark, 1.0 * s, 0.45, 0);
      for (const s of [-1, 1]) sph(0.22, 0xffffff, 0.5 * s, 0.68, -0.18).scale.set(1, 0.8, 0.5);
      r = 1.1; break;
    case 'shelf':
      box(1.6, 2.1, 0.5, wood, 0, 1.05, 0);
      for (let k = 0; k < 3; k++) {
        box(1.45, 0.06, 0.45, 0xe8c9a0, 0, 0.35 + k * 0.62, 0.03);
        for (let b = 0; b < 6; b++) box(0.16, 0.45, 0.35, [color, 0x8fd3ff, 0xffd84d, 0xc9a7ff, 0x8fdc8f][(b + k) % 5], -0.55 + b * 0.22, 0.6 + k * 0.62, 0.05);
      }
      r = 0.8; break;
    case 'plant':
      cyl(0.3, 0.22, 0.45, color, 0, 0.22, 0);
      for (let k = 0; k < 6; k++) { const a = k * 1.05; sph(0.25, 0x5fb35a, Math.cos(a) * 0.2, 0.7 + (k % 2) * 0.25, Math.sin(a) * 0.2); }
      sph(0.28, 0x6fc35f, 0, 1.05, 0);
      r = 0.4; break;
    case 'lamp': {
      cyl(0.3, 0.35, 0.06, 0x8a8a9a, 0, 0.03, 0);
      cyl(0.04, 0.04, 1.4, 0x8a8a9a, 0, 0.73, 0, 8);
      const shade = mesh(new THREE.CylinderGeometry(0.25, 0.42, 0.45, 16, 1, true), toon({ color, emissive: 0x000000, side: THREE.DoubleSide }));
      shade.position.y = 1.5; g.add(shade); g.userData.glow = shade.material;
      r = 0.35; break;
    }
    case 'rug':
      cyl(1.4, 1.4, 0.03, color, 0, 0.015, 0, 32);
      cyl(1.0, 1.0, 0.035, 0xffffff, 0, 0.017, 0, 32);
      cyl(0.6, 0.6, 0.04, color, 0, 0.02, 0, 32);
      walk = true; r = 1.4; break;
    case 'bear': {
      const br = 0xc8905a;
      sph(0.32, br, 0, 0.32, 0).scale.set(1, 1.05, 0.9);
      sph(0.24, br, 0, 0.78, 0.03);
      for (const s of [-1, 1]) { sph(0.09, br, 0.18 * s, 0.98, 0); sph(0.1, br, 0.3 * s, 0.4, 0.12); sph(0.11, br, 0.17 * s, 0.08, 0.2); }
      sph(0.09, 0xf0d2a8, 0, 0.73, 0.22);
      for (const s of [-1, 1]) sph(0.03, 0x1a1214, 0.08 * s, 0.83, 0.23);
      const bow = sph(0.07, color, 0, 0.56, 0.22); bow.scale.set(2.2, 0.8, 0.8);
      r = 0.4; break;
    }
    case 'wardrobe':
      box(1.6, 2.4, 0.7, color, 0, 1.2, 0);
      box(0.03, 2.2, 0.72, dark, 0, 1.2, 0);
      for (const s of [-1, 1]) sph(0.05, 0xffd84d, 0.12 * s, 1.25, 0.37);
      box(1.7, 0.12, 0.78, dark, 0, 2.45, 0);
      r = 0.9; break;
    case 'flower':
      cyl(0.13, 0.18, 0.5, color, 0, 0.25, 0);
      for (let k = 0; k < 5; k++) { const a = k * 1.25; sph(0.1, [0xff7aa8, 0xfff27a, 0xffffff, 0xc9a7ff, 0xff8a8a][k], Math.cos(a) * 0.12, 0.72 + (k % 2) * 0.08, Math.sin(a) * 0.12); }
      r = 0.25; break;
    case 'tv': {
      box(1.6, 0.55, 0.55, color, 0, 0.27, 0);
      box(1.5, 0.9, 0.08, 0x2a2a3a, 0, 1.05, 0);
      const scr = mesh(new THREE.PlaneGeometry(1.36, 0.76), new THREE.MeshBasicMaterial({ color: 0x8fd3ff }));
      scr.position.set(0, 1.05, 0.05); g.add(scr); g.userData.screen = scr.material;
      r = 0.8; break;
    }
    case 'piano':
      box(1.8, 1.1, 0.6, color, 0, 0.75, -0.1);
      box(1.7, 0.08, 0.35, 0xffffff, 0, 0.75, 0.3);
      for (let k = 0; k < 7; k++) box(0.08, 0.06, 0.2, 0x2a2a2a, -0.65 + k * 0.22, 0.81, 0.24);
      for (const s of [-1, 1]) box(0.1, 0.7, 0.1, dark, 0.8 * s, 0.35, 0.3);
      r = 0.9; break;
    case 'clock': {
      box(0.7, 2.1, 0.45, color, 0, 1.05, 0);
      const face = mesh(new THREE.CircleGeometry(0.26, 20), 0xffffff); face.position.set(0, 1.7, 0.23); g.add(face);
      box(0.03, 0.18, 0.02, 0x2a2a2a, 0, 1.75, 0.24);
      const pend = new THREE.Group(); pend.position.set(0, 1.35, 0.23);
      const rod = mesh(new THREE.BoxGeometry(0.03, 0.6, 0.02), 0xffd84d); rod.position.y = -0.3; pend.add(rod);
      const bob = mesh(new THREE.SphereGeometry(0.09, 10, 8), 0xffd84d); bob.position.y = -0.62; pend.add(bob);
      g.add(pend); g.userData.pend = pend;
      r = 0.45; break;
    }
    case 'cushion':
      sph(0.45, color, 0, 0.13, 0).scale.set(1, 0.3, 1);
      walk = true; r = 0.45; break;
    case 'cake':
      cyl(0.45, 0.45, 0.35, 0xfff4e0, 0, 0.18, 0, 20);
      cyl(0.46, 0.46, 0.08, color, 0, 0.37, 0, 20);
      cyl(0.3, 0.3, 0.25, 0xfff4e0, 0, 0.52, 0, 20);
      cyl(0.31, 0.31, 0.06, color, 0, 0.66, 0, 20);
      for (let k = 0; k < 5; k++) { const a = k * 1.256; sph(0.05, 0xff4a6a, Math.cos(a) * 0.2, 0.72, Math.sin(a) * 0.2); }
      cyl(0.025, 0.025, 0.2, 0x8fd3ff, 0, 0.8, 0, 6);
      { const fl = mesh(new THREE.SphereGeometry(0.04, 6, 5), 0xffc84a, { emissive: 0xffa020 }); fl.position.set(0, 0.93, 0); fl.scale.y = 1.6; g.add(fl); }
      r = 0.5; break;
    // ───── 펫 집 ─────
    case 'cattower': {
      box(1.1, 0.12, 1.1, color, 0, 0.06, 0);
      for (const [x, z, h] of [[-0.35, -0.35, 1.55], [0.35, 0.3, 0.8]]) cyl(0.09, 0.09, h, 0xe8d2a8, x, h / 2, z, 10);
      cyl(0.48, 0.48, 0.1, color, 0.3, 0.85, 0.25, 20); spot = { x: 0.3, y: 0.92, z: 0.25 };
      cyl(0.45, 0.45, 0.1, color, -0.3, 1.6, -0.3, 20);
      const cube = box(0.6, 0.5, 0.6, dark, -0.15, 0.37, 0.2);
      { const hole = mesh(new THREE.CircleGeometry(0.16, 14), 0x3a2a3a); hole.position.set(-0.15, 0.36, 0.51); g.add(hole); }
      sph(0.07, 0xffd84d, 0.6, 0.72, 0.25);
      g.userData.spotTop = { x: -0.3, y: 1.67, z: -0.3 };
      r = 0.75; break;
    }
    case 'birdcage': {
      cyl(0.55, 0.6, 0.12, wood, 0, 0.06, 0, 20);
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; cyl(0.015, 0.015, 1.25, color, Math.cos(a) * 0.52, 0.72, Math.sin(a) * 0.52, 4); }
      const dome = mesh(new THREE.SphereGeometry(0.53, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), color); dome.position.y = 1.33; dome.scale.y = 0.6; g.add(dome);
      sph(0.07, color, 0, 1.68, 0);
      { const perch = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), wood); perch.rotation.z = Math.PI / 2; perch.position.y = 0.62; g.add(perch); }
      cyl(0.5, 0.5, 0.04, 0xf4e6c8, 0, 0.14, 0, 20);
      spot = { x: 0, y: 0.64, z: 0 };
      r = 0.65; break;
    }
    case 'grasscage': {
      box(1.8, 0.08, 1.3, 0x6fc35f, 0, 0.04, 0);
      for (let k = 0; k < 22; k++) { const b = mesh(new THREE.ConeGeometry(0.05, 0.18, 4), 0x5fb34f); b.position.set(-0.8 + (k % 11) * 0.16, 0.16, k < 11 ? -0.5 : 0.45); g.add(b); }
      for (const z of [-0.65, 0.65]) for (let k = 0; k <= 9; k++) cyl(0.025, 0.025, 0.5, wood, -0.9 + k * 0.2, 0.3, z, 5);
      for (const x of [-0.9, 0.9]) for (let k = 0; k <= 6; k++) cyl(0.025, 0.025, 0.5, wood, x, 0.3, -0.65 + k * 0.217, 5);
      for (const z of [-0.65, 0.65]) box(1.82, 0.05, 0.05, wood, 0, 0.55, z);
      const hut = box(0.6, 0.4, 0.5, color, -0.5, 0.28, -0.25);
      { const rf = mesh(new THREE.ConeGeometry(0.48, 0.3, 4), dark); rf.rotation.y = Math.PI / 4; rf.position.set(-0.5, 0.63, -0.25); g.add(rf); }
      sph(0.08, 0xff9a3a, 0.4, 0.13, 0.2).scale.set(0.6, 0.6, 1.6);
      spot = { x: 0.25, y: 0.08, z: 0.05 }; g.userData.spot2 = { x: -0.25, y: 0.08, z: 0.3 };
      r = 1.0; break;
    }
    case 'doghouse': {
      box(1.15, 0.9, 1.1, color, 0, 0.45, 0);
      for (const s of [-1, 1]) { const rf = box(0.7, 0.08, 1.25, dark, 0.3 * s, 1.1, 0); rf.rotation.z = -0.65 * s; }
      { const hole = mesh(new THREE.CircleGeometry(0.3, 16, 0, Math.PI), 0x3a2a3a); hole.position.set(0, 0.25, 0.56); g.add(hole); const hb = mesh(new THREE.PlaneGeometry(0.6, 0.25), 0x3a2a3a); hb.position.set(0, 0.13, 0.56); g.add(hb); }
      { const bone = mesh(new THREE.CapsuleGeometry(0.03, 0.18, 4, 6), 0xffffff); bone.rotation.z = Math.PI / 2; bone.position.set(0.25, 0.75, 0.57); g.add(bone); }
      spot = { x: 0, y: 0, z: 0.9 }; g.userData.sleepSpot = { x: 0, y: 0, z: 0.1 };
      r = 0.75; break;
    }
    case 'slothtree': {
      cyl(0.35, 0.28, 0.4, color, 0, 0.2, 0);
      cyl(0.1, 0.13, 1.6, 0x9a6a44, 0, 1.1, 0, 8);
      { const br = mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.1, 6), 0x9a6a44); br.rotation.z = Math.PI / 2; br.position.set(0.45, 1.45, 0); g.add(br); }
      for (let k = 0; k < 5; k++) { const a = k * 1.25; sph(0.3, 0x6fc35f, Math.cos(a) * 0.25, 2.0 + (k % 2) * 0.15, Math.sin(a) * 0.25); }
      spot = { x: 0.6, y: 1.05, z: 0 }; g.userData.hang = true;
      r = 0.45; break;
    }
    case 'chickbox': {
      box(0.9, 0.06, 0.7, 0xd8b078, 0, 0.03, 0);
      for (const s of [-1, 1]) { box(0.9, 0.45, 0.05, 0xd8b078, 0, 0.25, 0.33 * s); box(0.05, 0.45, 0.7, 0xd8b078, 0.43 * s, 0.25, 0); }
      for (let k = 0; k < 14; k++) { const st = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 3), 0xf2d27a); st.rotation.set(Math.random() * 3, 0, Math.random() * 3); st.position.set((Math.random() - 0.5) * 0.7, 0.1, (Math.random() - 0.5) * 0.5); g.add(st); }
      { const lbl = mesh(new THREE.BoxGeometry(0.3, 0.15, 0.01), color); lbl.position.set(0, 0.3, 0.36); g.add(lbl); }
      spot = { x: 0, y: 0.08, z: 0 };
      r = 0.55; break;
    }
    case 'sapling': {
      if (!data.grown) {
        // 새싹 : 물을 주면 자람
        cyl(0.28, 0.22, 0.35, color, 0, 0.17, 0);
        cyl(0.25, 0.25, 0.04, 0x7a5030, 0, 0.35, 0);
        cyl(0.02, 0.025, 0.25 + (data.water || 0) * 0.1, 0x5fae4c, 0, 0.45 + (data.water || 0) * 0.05, 0, 5);
        const top = 0.58 + (data.water || 0) * 0.1;
        for (const s2 of [-1, 1]) { const lf = sph(0.09 + (data.water || 0) * 0.02, 0x7fcf62, 0.08 * s2, top, 0); lf.scale.set(1.4, 0.5, 0.8); lf.rotation.z = 0.4 * s2; }
        spot = { x: 0, y: top + 0.1, z: 0 };
        r = 0.35;
      } else {
        cyl(0.4, 0.32, 0.45, color, 0, 0.22, 0);
        cyl(0.36, 0.36, 0.04, 0x7a5030, 0, 0.45, 0);
        cyl(0.08, 0.12, 1.3, 0x9a6a44, 0, 1.1, 0, 8);
        sph(0.62, 0x6fc35f, 0, 2.0, 0).scale.set(1, 0.85, 1);
        sph(0.4, 0x5fb34f, 0.35, 1.75, 0.2);
        sph(0.38, 0x7fcf62, -0.3, 1.85, -0.2);
        spot = { x: 0, y: 2.5, z: 0 };
        if (data.nest) {
          const ring = mesh(new THREE.TorusGeometry(0.26, 0.09, 8, 16), 0x8a5a3a); ring.rotation.x = Math.PI / 2; ring.position.set(0, 2.5, 0); g.add(ring);
          cyl(0.24, 0.16, 0.1, 0x7a5030, 0, 2.45, 0, 12);
          spot = { x: 0, y: 2.5, z: 0 };
        }
        r = 0.55;
      }
      break;
    }
    case 'nest': {
      cyl(0.32, 0.25, 0.25, 0xc8905a, 0, 0.12, 0, 12);
      const ring = mesh(new THREE.TorusGeometry(0.36, 0.13, 8, 18), 0x9a6a44); ring.rotation.x = Math.PI / 2; ring.position.y = 0.32; g.add(ring);
      for (let k = 0; k < 10; k++) { const tw = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 3), 0x7a5030); tw.rotation.set(Math.PI / 2, 0, k * 0.63); tw.position.set(Math.cos(k * 0.63) * 0.36, 0.36, Math.sin(k * 0.63) * 0.36); g.add(tw); }
      cyl(0.3, 0.3, 0.03, 0xe8d2a8, 0, 0.27, 0, 14);
      spot = { x: 0, y: 0.3, z: 0 };
      r = 0.5; break;
    }
  }
  g.userData.spot = spot;
  g.userData.r = r; g.userData.walk = walk; g.userData.kind = id;
  return g;
}

export class House {
  constructor(profile, saveData, ctx) {
    this.ctx = ctx; // { onSave, toast }
    this.saveData = saveData;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffeef4);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffe8d8, 1.6);
    this.dir = new THREE.DirectionalLight(0xfff4e0, 1.0); this.dir.position.set(4, 12, 8);
    if (GFX.level === 'high') { const d = this.dir; d.castShadow = true; d.shadow.mapSize.set(1024, 1024); const c = d.shadow.camera; c.left = -14; c.right = 14; c.top = 12; c.bottom = -12; c.far = 40; d.shadow.mapSize.set(2048, 2048); d.shadow.bias = -0.001; d.shadow.normalBias = 0.03; d.shadow.radius = 3; }
    this.lamp = new THREE.PointLight(0xffc87a, 0, 16); this.lamp.position.set(0, 3.4, 3.5);
    this.lamp2 = new THREE.PointLight(0xffc87a, 0, 16); this.lamp2.position.set(-6, 3.4, -3.8);
    this.lamp3 = new THREE.PointLight(0xffc87a, 0, 16); this.lamp3.position.set(6, 3.4, -3.8);
    this.amb = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.hemi, this.dir, this.lamp, this.lamp2, this.lamp3, this.amb);
    this.shell = new THREE.Group(); this.scene.add(this.shell);
    this.furnGroup = new THREE.Group(); this.scene.add(this.furnGroup);
    this.buildShell(profile);
    this.items = [];
    if (!saveData.furniture.some(f => f.id === 'bed')) saveData.furniture.unshift({ id: 'bed', color: 0xffb3c8, x: -9.6, z: -5.6, rot: 0 });
    if (saveData.furniture.length === 1) saveData.furniture.push({ id: 'rug', color: 0xc9a7ff, x: 0.5, z: 3.5, rot: 0 });
    saveData.furniture.forEach(f => this.addItem(f, false));
    this.bowl = { x: 9.6, z: 6.0 };
    this.bowlMesh = null;
    this.selected = null;
    this.selRing = mesh(new THREE.TorusGeometry(1, 0.05, 6, 32), 0xff7aa8, { emissive: 0xff7aa8 });
    this.selRing.rotation.x = Math.PI / 2; this.selRing.visible = false; this.scene.add(this.selRing);
    this.t = 0;
  }

  buildShell(profile) {
    this.shell.clear();
    const wallHex = (COLORS7.find(c => c.id === profile.houseColor) || COLORS7[0]).hex;
    const wallC = new THREE.Color(wallHex).lerp(new THREE.Color(0xffffff), 0.55).getHex();
    const innerC = new THREE.Color(wallHex).lerp(new THREE.Color(0xffffff), 0.75).getHex();
    const D = ROOM.d;
    // 방마다 바닥 (그림 한 장씩)
    for (const r of ROOMS) {
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), toon({ color: 0xffffff, map: floorTexture(r, w, d) }));
      fl.rotation.x = -Math.PI / 2; fl.position.set((r.x0 + r.x1) / 2, 0.002, (r.z0 + r.z1) / 2);
      fl.userData.noOutline = true; this.shell.add(fl);
    }
    const under = mesh(new THREE.BoxGeometry(ROOM.w + 0.6, 0.2, D + 0.4), 0xd8b48a); under.position.set(0, -0.1, 0); this.shell.add(under);
    // 벽 (카메라와 나 사이에 있으면 흐려짐)
    this.walls = [];
    for (const w of WALLS) {
      const m = toon({ color: w.h > WALL_H ? wallC : innerC });
      const g = mesh(new THREE.BoxGeometry(w.x1 - w.x0, w.h, w.z1 - w.z0), m);
      g.position.set((w.x0 + w.x1) / 2, w.h / 2, (w.z0 + w.z1) / 2);
      g.userData.noOutline = true;
      const cap = mesh(new THREE.BoxGeometry(w.x1 - w.x0 + 0.04, 0.08, w.z1 - w.z0 + 0.04), toon({ color: 0xffffff }));
      cap.position.set(g.position.x, w.h, g.position.z); cap.userData.noOutline = true;
      this.shell.add(g, cap);
      this.walls.push({ box: w, mats: [m, cap.material], fade: 1 });
    }
    // 문틀 (거실 쪽 문)
    for (const [id, dr] of Object.entries(DOORS)) {
      for (const s of [-1, 1]) {
        const post = mesh(new THREE.BoxGeometry(0.26, WALL_H + 0.1, 0.26), 0xffffff);
        if (dr.axis === 'z') post.position.set(dr.c + s * dr.half, WALL_H / 2, dr.at); else post.position.set(dr.at, WALL_H / 2, dr.c + s * dr.half);
        this.shell.add(post);
      }
      const room = roomById(id);
      const lb = makeLabel(room.name, '#7a5a6a', 'rgba(255,255,255,0.9)');
      lb.position.set((room.x0 + room.x1) / 2, WALL_H + 0.55, room.z0 + 0.6);
      lb.scale.multiplyScalar(0.75); this.shell.add(lb);
    }
    // 창문 : 뒤 벽(b, 주방), 왼쪽 벽(l, 작은방), 오른쪽 벽(r, 작은방 2). 앞쪽 두 개(fl, fr)는 창문 버튼으로
    this.skyMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: viewTexture() });
    this.wins = {};
    const addWin = (key, x, z, rotY) => {
      const w = new THREE.Group(); w.position.set(x, 2.4, z); w.rotation.y = rotY;
      const frame = mesh(new THREE.BoxGeometry(1.9, 1.6, 0.1), 0xffffff); w.add(frame);
      const view = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.3), this.skyMat); view.position.z = 0.06; w.add(view);
      const sill = mesh(new THREE.BoxGeometry(2.0, 0.1, 0.35), 0xffffff); sill.position.set(0, -0.82, 0.15); w.add(sill);
      const panes = [-1, 1].map(s => {
        const hinge = new THREE.Group(); hinge.position.set(0.8 * s, 0, 0.1);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.3, 0.02), GLASS); glass.position.x = -0.4 * s; hinge.add(glass);
        const fr = mesh(new THREE.BoxGeometry(0.05, 1.3, 0.05), 0xffffff); fr.position.x = -0.78 * s; hinge.add(fr);
        const fr2 = mesh(new THREE.BoxGeometry(0.8, 0.05, 0.05), 0xffffff); fr2.position.set(-0.4 * s, 0, 0); hinge.add(fr2);
        w.add(hinge); return hinge;
      });
      const curs = [-1, 1].map(s => {
        const c = new THREE.Group(); c.position.set(0.5 * s, 0, 0.2);
        const m = mesh(new THREE.BoxGeometry(1.0, 1.8, 0.06), 0xffb3c8); m.position.x = 0; c.add(m);
        for (let k = -2; k <= 2; k++) { const fold = mesh(new THREE.BoxGeometry(0.06, 1.8, 0.08), 0xff9ec0); fold.position.x = k * 0.2; c.add(fold); }
        w.add(c); return c;
      });
      const rod = mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), 0xc8905a); rod.rotation.z = Math.PI / 2; rod.position.set(0, 0.95, 0.22); w.add(rod);
      w.userData.win = key;
      w.traverse(o => { o.userData.win = key; });
      this.shell.add(w);
      const inward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      this.wins[key] = { group: w, panes, curs, spot: new THREE.Vector3(x, 0, z).addScaledVector(inward, 0.6) };
    };
    addWin('b', 1.4, -D / 2 + 0.02, 0);
    addWin('l', -ROOM.w / 2 + 0.02, -3.75, Math.PI / 2);
    addWin('r', ROOM.w / 2 - 0.02, -3.75, -Math.PI / 2);
    if (this.saveData && this.saveData.windows) this.applyWindows(this.saveData.windows);
    // 액자 (작은방)
    const pic = mesh(new THREE.BoxGeometry(1.1, 0.8, 0.06), 0xffd84d); pic.position.set(-8, 2.6, -D / 2 + 0.03); this.shell.add(pic);
    const picIn = mesh(new THREE.PlaneGeometry(0.9, 0.6), 0x8fdc8f); picIn.position.set(-8, 2.6, -D / 2 + 0.07); this.shell.add(picIn);
    const sun = mesh(new THREE.CircleGeometry(0.1, 12), 0xff8a5a); sun.position.set(-7.75, 2.75, -D / 2 + 0.08); this.shell.add(sun);
    // 붙박이 (화장실, 주방, 육아실)
    this.fixtures = [];
    this.buildFixtures();
    // 현관 매트
    const mat_ = mesh(new THREE.BoxGeometry(2, 0.04, 0.9), 0xff8fb3); mat_.position.set(0, 0.02, D / 2 - 0.2); this.shell.add(mat_);
    const lb = makeLabel('나가는 문 ↓', '#ffffff', 'rgba(255,143,179,0.9)'); lb.position.set(0, 0.5, D / 2 - 0.2); lb.scale.multiplyScalar(0.8); this.shell.add(lb);
    // 집 이름 (거실 위)
    const nm = makeLabel(`${profile.houseName}`, '#b0507a', 'rgba(255,255,255,0.92)'); nm.position.set(0, 3.7, -D / 2 + 0.2); nm.scale.multiplyScalar(1.2); this.shell.add(nm);
    this.shell.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  }

  // 화장실 : 변기, 욕조, 세면대 / 주방 : 조리대, 가스레인지, 싱크대, 냉장고 / 육아실 : 울타리, 장난감
  buildFixtures() {
    const add = (g, box) => { outline(g, 0.018, 0x4a3048, 0.06); castAll(g, GFX.level === 'high', false); this.shell.add(g); if (box) this.fixtures.push(box); };
    const fixBox = (x, z, w, d) => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
    // 변기
    { const g = new THREE.Group(); g.position.set(-11.2, 0, 1.2); g.rotation.y = Math.PI / 2;
      const bowl = mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.45, 16), 0xffffff); bowl.position.y = 0.22; g.add(bowl);
      const seat = mesh(new THREE.TorusGeometry(0.28, 0.06, 6, 16), 0xffd6e7); seat.rotation.x = Math.PI / 2; seat.position.y = 0.47; g.add(seat);
      const tank = mesh(new THREE.BoxGeometry(0.7, 0.6, 0.25), 0xffffff); tank.position.set(0, 0.75, -0.35); g.add(tank);
      const btn = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8), 0x8fd3ff); btn.position.set(0, 1.07, -0.35); g.add(btn);
      add(g, fixBox(-11.2, 1.2, 0.9, 0.8)); }
    // 욕조 (거품)
    { const g = new THREE.Group(); g.position.set(-8.6, 0, 1.0);
      const tub = mesh(new THREE.BoxGeometry(2.6, 0.7, 1.3), 0xffffff); tub.position.y = 0.35; g.add(tub);
      const water = mesh(new THREE.BoxGeometry(2.3, 0.05, 1.0), 0x9fdcff, { emissive: 0x103040 }); water.position.y = 0.66; g.add(water);
      for (let k = 0; k < 9; k++) { const b = mesh(new THREE.SphereGeometry(0.12 + (k % 3) * 0.04, 8, 6), 0xffffff); b.position.set(-0.9 + k * 0.22, 0.74, Math.sin(k * 1.7) * 0.3); g.add(b); }
      const duck = mesh(new THREE.SphereGeometry(0.13, 10, 8), 0xffd84d); duck.position.set(0.6, 0.82, 0.1); g.add(duck);
      const tap = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), 0xc8d0dc); tap.position.set(-1.2, 0.9, 0); g.add(tap);
      add(g, fixBox(-8.6, 1.0, 2.6, 1.3)); }
    // 세면대와 거울
    { const g = new THREE.Group(); g.position.set(-11.55, 0, 5.2); g.rotation.y = Math.PI / 2;
      const stand = mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.8, 10), 0xffffff); stand.position.y = 0.4; g.add(stand);
      const sink = mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.2, 16), 0xffffff); sink.position.y = 0.88; g.add(sink);
      const mir = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20), 0xbfe8ff, { emissive: 0x203040 }); mir.rotation.x = Math.PI / 2; mir.position.set(0, 1.8, -0.3); g.add(mir);
      add(g, fixBox(-11.55, 5.2, 0.8, 0.9)); }
    // 주방 조리대 (뒤 벽), 가스레인지, 싱크대
    { const g = new THREE.Group(); g.position.set(-1.2, 0, -7.0);
      const body = mesh(new THREE.BoxGeometry(5, 0.9, 0.8), 0xffffff); body.position.y = 0.45; g.add(body);
      const top = mesh(new THREE.BoxGeometry(5.1, 0.08, 0.86), 0xc8905a); top.position.y = 0.94; g.add(top);
      for (let k = 0; k < 4; k++) { const d = mesh(new THREE.BoxGeometry(1.1, 0.7, 0.02), 0xffd6e7); d.position.set(-1.85 + k * 1.23, 0.45, 0.41); g.add(d); }
      for (const [x, z] of [[-1.7, -0.15], [-1.1, -0.15], [-1.7, 0.2], [-1.1, 0.2]]) { const f = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 14), 0x4a4a5a); f.position.set(x, 0.99, z); g.add(f); }
      const basin = mesh(new THREE.BoxGeometry(0.9, 0.06, 0.55), 0xbfd8e8); basin.position.set(1.2, 0.98, 0); g.add(basin);
      const faucet = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), 0xc8d0dc); faucet.position.set(1.2, 1.18, -0.3); g.add(faucet);
      const pot = mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.25, 14), 0xff8fb3); pot.position.set(-1.4, 1.13, 0); g.add(pot);
      add(g, fixBox(-1.2, -7.0, 5, 0.8)); }
    // 냉장고
    { const g = new THREE.Group(); g.position.set(3.0, 0, -6.9);
      const body = mesh(new THREE.BoxGeometry(1.1, 2.2, 0.9), 0xbfe8ff); body.position.y = 1.1; g.add(body);
      const line = mesh(new THREE.BoxGeometry(1.12, 0.04, 0.92), 0x9ac8e8); line.position.y = 1.45; g.add(line);
      for (const y of [1.0, 1.85]) { const h = mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), 0xffffff); h.position.set(-0.4, y, 0.48); g.add(h); }
      const mag = mesh(new THREE.SphereGeometry(0.08, 8, 6), 0xff7aa8); mag.position.set(0.2, 1.8, 0.46); g.add(mag);
      add(g, fixBox(3.0, -6.9, 1.1, 0.9)); }
    // 육아실 : 장난감 공
    { const g = new THREE.Group();
      for (const [x, z, c] of [[10.5, 2.5, 0xff7aa8], [8.0, 4.8, 0x8fd3ff], [11.4, 6.8, 0xffd84d]]) { const b = mesh(new THREE.SphereGeometry(0.2, 12, 10), c); b.position.set(x, 0.2, z); g.add(b); }
      add(g, null); }
  }

  addItem(f, isNew = true) {
    const g = makeFurniture(f.id, f.color, f);
    outline(g, 0.018, 0x4a3048, 0.06); castAll(g, GFX.level === 'high', false);
    g.position.set(f.x, 0, f.z); g.rotation.y = f.rot || 0;
    g.userData.data = f;
    this.furnGroup.add(g);
    this.items.push(g);
    if (isNew) { this.saveData.furniture.push(f); this.ctx.onSave(); }
    return g;
  }
  removeItem(g) {
    if (g.userData.kind === 'bed') { this.ctx.toast('침대는 꼭 있어야 해요'); return false; }
    this.furnGroup.remove(g);
    this.items = this.items.filter(i => i !== g);
    this.saveData.furniture = this.saveData.furniture.filter(f => f !== g.userData.data);
    this.ctx.onSave();
    return true;
  }
  // 모양이 바뀌면 (작은 나무가 자람 등) 다시 만들기
  rebuild(g) {
    const d = g.userData.data;
    this.furnGroup.remove(g);
    this.items = this.items.filter(i => i !== g);
    return this.addItem(d, false);
  }
  recolor(g, color) {
    const d = g.userData.data;
    d.color = color;
    this.furnGroup.remove(g);
    this.items = this.items.filter(i => i !== g);
    return this.addItem(d, false);
  }
  select(g) {
    this.selected = g;
    this.selRing.visible = !!g;
    if (g) { const r = g.userData.r + 0.15; this.selRing.scale.set(r, r, 1); }
  }
  freeSpot(near) {
    const r = (near && roomAt(near.x, near.z)) || roomById('living');
    for (let k = 0; k < 40; k++) {
      const x = rand(r.x0 + 1, r.x1 - 1), z = rand(r.z0 + 1, Math.min(r.z1, HZ) - 1);
      if (this.items.every(i => i.userData.walk || Math.hypot(i.position.x - x, i.position.z - z) > i.userData.r + 0.8) && !this.inFixture(x, z, 0.6)) return { x, z };
    }
    return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
  }

  // 반려동물 밥그릇 (여러 마리 몫)
  setPets(pets) {
    if (this.bowlMesh) this.scene.remove(this.bowlMesh);
    this.bowlMesh = null;
    if (!pets.length) return;
    const first = pets[0];
    const def = PETS.find(p => p.id === first.type);
    const g = new THREE.Group();
    const b = mesh(new THREE.CylinderGeometry(0.45, 0.32, 0.25, 20), 0xff8fb3); b.position.y = 0.12; g.add(b);
    const inner = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.02, 20), 0xffffff); inner.position.y = 0.25; g.add(inner);
    const food = new THREE.Group();
    const foodC = pets.map(p => ({ dog: 0xa0663e, cat: 0x8fb8d8, chick: 0xf2d27a, rabbit: 0xff9a3a, parrot: 0x6a5a4a, redpanda: 0x7fcf62, sloth: 0x5fb35a }[p.type]));
    for (let k = 0; k < 12; k++) { const a = k * 0.52, rr = (k % 3) * 0.1 + 0.05; const f = mesh(new THREE.SphereGeometry(0.08, 6, 5), foodC[k % foodC.length]); f.position.set(Math.cos(a) * rr, 0.3 + (k % 2) * 0.04, Math.sin(a) * rr); food.add(f); }
    g.add(food); this.foodMesh = food;
    const icon = emojiSprite(pets.length > 1 ? '🍽️' : def.food, 0.5); icon.position.y = 0.9; g.add(icon); this.bowlIcon = icon;
    g.position.set(this.bowl.x, 0, this.bowl.z);
    g.userData.kind = 'bowl';
    outline(g, 0.018, 0x4a3048, 0.06);
    this.scene.add(g); this.bowlMesh = g;
    this.refreshBowl();
  }
  get bowlFull() { return (this.saveData.bowl || 0) > 0; }
  refreshBowl() {
    if (!this.foodMesh) return;
    this.foodMesh.visible = this.bowlFull;
    this.bowlIcon.visible = !this.bowlFull;
  }
  fillBowl(n) { this.saveData.bowl = n; this.refreshBowl(); this.ctx.onSave(); }
  eat() { this.saveData.bowl = Math.max(0, (this.saveData.bowl || 0) - 1); this.refreshBowl(); this.ctx.onSave(); }

  // 펫 집 찾기 (가구 kind)
  findItem(kind) { return this.items.find(i => i.userData.kind === kind); }
  itemByUid(id) { return this.items.find(i => i.userData.data.uid === id); }
  // 가구 안 자리 → 방 좌표
  spotOf(item, key = 'spot') {
    const s = item.userData[key] || item.userData.spot;
    if (!s) return null;
    return new THREE.Vector3(s.x, s.y, s.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), item.rotation.y).add(item.position);
  }
  // 새가 앉을 곳 (가구 꼭대기, 창틀)
  perchSpots() {
    const out = [];
    const box = new THREE.Box3();
    for (const it of this.items) {
      if (it.userData.walk) continue;
      box.setFromObject(it);
      out.push(new THREE.Vector3(it.position.x, box.max.y, it.position.z));
    }
    for (const w of Object.values(this.wins)) out.push(w.spot.clone().setY(1.62));
    return out;
  }

  // 창문 상태 반영
  applyWindows(state) { this.winState = state; }
  animWindows(dt) {
    const st = this.winState; if (!st) return;
    const k = Math.min(1, dt * 6);
    for (const [key, w] of Object.entries(this.wins)) {
      const s = st[key];
      w.panes.forEach((p, i) => { const goal = s.open ? (i ? -1 : 1) * -1.55 : 0; p.rotation.y += (goal - p.rotation.y) * k; });
      w.curs.forEach((c, i) => {
        const sx = i ? 1 : -1;
        const gx = s.cur ? 1.08 * sx : 0.45 * sx, gs = s.cur ? 0.28 : 1;
        c.position.x += (gx - c.position.x) * k; c.scale.x += (gs - c.scale.x) * k;
      });
    }
  }
  anyOpen(needCurtain) {
    const st = this.winState; if (!st) return null;
    for (const [k, s] of Object.entries(st)) if (s.open && (!needCurtain || s.cur)) return k;
    return null;
  }
  // 앞 창문(fl, fr)은 방에서 보이지 않으므로 문 쪽 자리
  winSpot(key) { return this.wins[key] ? this.wins[key].spot.clone() : new THREE.Vector3(key === 'fl' ? -2.5 : 2.5, 0, ROOM.d / 2 - 0.9); }

  // 아무 방이나 빈 곳 (from을 주면 70%는 같은 방)
  randomSpot(from) {
    let r = from && Math.random() < 0.7 ? roomAt(from.x, from.z) : null;
    if (!r) r = ROOMS[Math.floor(Math.random() * ROOMS.length)];
    for (let k = 0; k < 20; k++) {
      const x = rand(r.x0 + 0.7, r.x1 - 0.7), z = rand(r.z0 + 0.7, Math.min(r.z1, HZ) - 0.6);
      if (!this.inFixture(x, z, 0.4)) return { x, z };
    }
    return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
  }
  inFixture(x, z, m = 0) { return (this.fixtures || []).some(b => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m); }
  bedItem() { return this.items.find(i => i.userData.kind === 'bed'); }
  roomOf(p) { return roomAt(p.x, p.z); }

  // 다른 방으로 갈 때 거쳐 갈 문 앞 자리 (모든 방은 거실과 이어짐)
  route(from, tx, tz) {
    const rf = roomAt(from.x, from.z), rt = roomAt(tx, tz);
    if (!rf || !rt || rf === rt) return null;
    const via = rf.id === 'living' ? rt.id : rf.id; // 지나갈 문
    const dr = DOORS[via]; if (!dr) return null;
    const room = roomById(via);
    const roomSide = dr.axis === 'z' ? Math.sign((room.z0 + room.z1) / 2 - dr.at) : Math.sign((room.x0 + room.x1) / 2 - dr.at);
    const pt = side => dr.axis === 'z' ? { x: dr.c, z: dr.at + side * 0.9 } : { x: dr.at + side * 0.9, z: dr.c };
    const along = dr.axis === 'z' ? from.x - dr.c : from.z - dr.c;
    const across = dr.axis === 'z' ? from.z - dr.at : from.x - dr.at;
    const inDoor = Math.abs(along) < dr.half - 0.2 && Math.abs(across) < 1.1;
    const near = rf.id !== 'living' ? roomSide : -roomSide; // 지금 있는 쪽
    return inDoor ? pt(-near * 1.3) : pt(near);
  }
  clampItem(p) { p.x = clamp(p.x, -HX + 0.4, HX - 0.4); p.z = clamp(p.z, -HZ + 0.4, HZ - 0.6); return p; }

  // 방 안 충돌 (가구, 밥그릇, 벽, 붙박이)
  collide(pos, rad, skip = null) {
    for (const it of this.items) {
      if (it.userData.walk || it === skip) continue;
      const dx = pos.x - it.position.x, dz = pos.z - it.position.z;
      const rr = it.userData.r * 0.85 + rad, d = Math.hypot(dx, dz);
      if (d < rr && d > 1e-5) { pos.x = it.position.x + dx / d * rr; pos.z = it.position.z + dz / d * rr; }
    }
    if (this.bowlMesh) {
      const dx = pos.x - this.bowl.x, dz = pos.z - this.bowl.z, d = Math.hypot(dx, dz), rr = 0.45 + rad;
      if (d < rr && d > 1e-5) { pos.x = this.bowl.x + dx / d * rr; pos.z = this.bowl.z + dz / d * rr; }
    }
    for (const b of WALLS) pushOut(pos, rad, b);
    for (const b of this.fixtures || []) pushOut(pos, rad, b);
    pos.x = clamp(pos.x, -HX, HX);
    pos.z = clamp(pos.z, -HZ, Math.abs(pos.x) < 1.6 ? HZ + 0.3 : HZ);
  }
  get env() { return { height: () => 0, collide: (p, r, a, b, skip) => this.collide(p, r, skip), route: (f, x, z) => this.route(f, x, z) }; }

  // 카메라와 나 사이를 가리는 벽은 흐리게
  fadeWalls(cam, target, dt) {
    const k = Math.min(1, dt * 8);
    for (const w of this.walls || []) {
      const b = w.box;
      const hit = segBox(cam.x, cam.z, target.x, target.z, b.x0 - 0.3, b.x1 + 0.3, b.z0 - 0.3, b.z1 + 0.3);
      const goal = hit ? 0.18 : 1;
      if (Math.abs(goal - w.fade) < 0.005) continue;
      w.fade += (goal - w.fade) * k;
      for (const m of w.mats) { m.opacity = w.fade; const tr = w.fade < 0.98; if (m.transparent !== tr) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true; } }
    }
  }

  update(dt, night, weather) {
    this.t += dt;
    this.animWindows(dt);
    if (weather) this.skyMat.color.setScalar(1 - weather.cloud * 0.35);
    if (night > 0.5) this.skyMat.color.setHex(0x2a3060); else if (!weather) this.skyMat.color.setHex(0xffffff);
    this.lamp.intensity = this.lamp2.intensity = this.lamp3.intensity = night > 0.5 ? 22 : 0;
    this.hemi.intensity = night > 0.5 ? 0.6 : 1.2;
    this.dir.intensity = night > 0.5 ? 0.3 : 1.0;
    this.amb.intensity = night > 0.5 ? 0.35 : 0.7;
    this.scene.background.setHex(night > 0.5 ? 0x3a3050 : 0xffeef4);
    for (const it of this.items) {
      if (it.userData.glow) it.userData.glow.emissive.setHex(night > 0.5 ? 0xffc87a : 0x000000);
      if (it.userData.pend) it.userData.pend.rotation.z = Math.sin(this.t * 3) * 0.3;
      if (it.userData.screen) it.userData.screen.color.setHSL((this.t * 0.05) % 1, 0.6, 0.7);
    }
    if (this.selected) { this.selRing.position.set(this.selected.position.x, 0.05, this.selected.position.z); }
    if (this.bowlIcon) this.bowlIcon.position.y = 0.9 + Math.sin(this.t * 3) * 0.06;
  }
}

// 원(pos, rad)을 상자 밖으로 밀어냄
function pushOut(pos, rad, b) {
  const cx = clamp(pos.x, b.x0, b.x1), cz = clamp(pos.z, b.z0, b.z1);
  const dx = pos.x - cx, dz = pos.z - cz, d = Math.hypot(dx, dz);
  if (d >= rad) return;
  if (d > 1e-5) { pos.x = cx + dx / d * rad; pos.z = cz + dz / d * rad; return; }
  const l = pos.x - b.x0, r = b.x1 - pos.x, t = pos.z - b.z0, bt = b.z1 - pos.z, m = Math.min(l, r, t, bt);
  if (m === l) pos.x = b.x0 - rad; else if (m === r) pos.x = b.x1 + rad; else if (m === t) pos.z = b.z0 - rad; else pos.z = b.z1 + rad;
}
// 선분이 상자와 만나는지 (2D)
function segBox(ax, az, bx, bz, x0, x1, z0, z1) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dz, az - z0], [dz, z1 - az]]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t0 <= t1;
}
// 바닥 그림 (나무, 타일, 카펫)
const floorCache = new Map();
const cssHex = h => '#' + h.toString(16).padStart(6, '0');
function floorTexture(r, w, d) {
  if (floorCache.has(r.id)) return floorCache.get(r.id);
  const px = 32, c = document.createElement('canvas'); c.width = Math.round(w * px); c.height = Math.round(d * px);
  const x = c.getContext('2d');
  if (r.floor === 'wood') {
    const n = Math.round(d * 1.6);
    for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? '#e8c49a' : '#dfb98c'; x.fillRect(0, i * c.height / n, c.width, c.height / n); }
    x.strokeStyle = 'rgba(150,100,60,0.25)'; x.lineWidth = 2;
    for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(0, i * c.height / n); x.lineTo(c.width, i * c.height / n); x.stroke(); }
  } else if (r.floor === 'tile') {
    const s = px * 0.75;
    for (let i = 0; i * s < c.width; i++) for (let j = 0; j * s < c.height; j++) { x.fillStyle = cssHex(r.tile[(i + j) % 2]); x.fillRect(i * s, j * s, s, s); }
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 2;
    for (let i = 0; i * s < c.width; i++) { x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, c.height); x.stroke(); }
    for (let j = 0; j * s < c.height; j++) { x.beginPath(); x.moveTo(0, j * s); x.lineTo(c.width, j * s); x.stroke(); }
  } else {
    x.fillStyle = cssHex(r.tile[0]); x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = cssHex(r.tile[1]);
    for (let i = 0; i < c.width; i += 14) for (let j = ((i / 14) % 2) * 7; j < c.height; j += 14) { x.beginPath(); x.arc(i, j, 2.2, 0, 7); x.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  floorCache.set(r.id, t);
  return t;
}

// 예전 작은 집(12×10) 가구를 넓은 집으로 옮기기 (한 번만)
export function migrateHouse(S) {
  if (S.houseV >= 2) return false;
  const petHomes = new Set(PET_HOMES.map(h => h.id));
  let ph = 0;
  for (const f of S.furniture) {
    if (f.id === 'bed') { f.x = -9.6; f.z = -5.6; f.rot = 0; continue; }
    if (petHomes.has(f.id)) { f.x = 7.4 + (ph % 3) * 1.8; f.z = 1.6 + Math.floor(ph / 3) * 2.2; ph++; continue; }
    f.x = clamp(f.x, -5.2, 5.2); f.z = clamp(1.2 + (f.z + 5) * 0.52, 0.9, 6.2);
  }
  S.houseV = 2;
  return true;
}
