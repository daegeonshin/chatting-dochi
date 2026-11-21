import * as THREE from 'three';
import { toon, outline, castAll, GFX } from './look.js';
import { mesh, mat, makeLabel, emojiSprite, clamp, rand } from './utils.js';
import { COLORS7, PETS } from './data.js';

export const ROOM = { w: 12, d: 10 }; // x : -6~6, z : -5~5
const HX = ROOM.w / 2 - 0.4, HZ = ROOM.d / 2 - 0.4;

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
    this.dir = new THREE.DirectionalLight(0xfff4e0, 1.0); this.dir.position.set(3, 8, 6);
    if (GFX.level === 'high') { const d = this.dir; d.castShadow = true; d.shadow.mapSize.set(1024, 1024); const c = d.shadow.camera; c.left = -8; c.right = 8; c.top = 8; c.bottom = -8; c.far = 30; d.shadow.bias = -0.001; d.shadow.normalBias = 0.03; d.shadow.radius = 3; }
    this.lamp = new THREE.PointLight(0xffc87a, 0, 18); this.lamp.position.set(0, 3.5, 0);
    this.amb = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.hemi, this.dir, this.lamp, this.amb);
    this.shell = new THREE.Group(); this.scene.add(this.shell);
    this.furnGroup = new THREE.Group(); this.scene.add(this.furnGroup);
    this.buildShell(profile);
    this.items = [];
    if (!saveData.furniture.some(f => f.id === 'bed')) saveData.furniture.unshift({ id: 'bed', color: 0xffb3c8, x: -4.2, z: -2.9, rot: 0 });
    if (saveData.furniture.length === 1) saveData.furniture.push({ id: 'rug', color: 0xc9a7ff, x: 0.5, z: 0.5, rot: 0 });
    saveData.furniture.forEach(f => this.addItem(f, false));
    this.bowl = { x: 4.6, z: 3.6 };
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
    const W = ROOM.w, D = ROOM.d, H = 4.2;
    // 나무 바닥
    for (let i = 0; i < 12; i++) {
      const plank = mesh(new THREE.BoxGeometry(W, 0.1, D / 12 - 0.03), i % 2 ? 0xe8c49a : 0xdfb98c);
      plank.position.set(0, -0.05, -D / 2 + (i + 0.5) * D / 12); this.shell.add(plank);
    }
    const back = mesh(new THREE.BoxGeometry(W, H, 0.2), wallC); back.position.set(0, H / 2, -D / 2 - 0.1); this.shell.add(back);
    for (const s of [-1, 1]) { const side = mesh(new THREE.BoxGeometry(0.2, H, D), wallC); side.position.set((W / 2 + 0.1) * s, H / 2, 0); this.shell.add(side); }
    const base = mesh(new THREE.BoxGeometry(W, 0.3, 0.05), 0xffffff); base.position.set(0, 0.15, -D / 2 + 0.01); this.shell.add(base);
    // 창문 : 뒤 벽(b), 왼쪽 벽(l), 오른쪽 벽(r). 앞쪽 두 개(fl, fr)는 창문 버튼으로
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
    addWin('b', 2.2, -D / 2 + 0.02, 0);
    addWin('l', -W / 2 + 0.02, -0.8, Math.PI / 2);
    addWin('r', W / 2 - 0.02, -0.8, -Math.PI / 2);
    if (this.saveData && this.saveData.windows) this.applyWindows(this.saveData.windows);
    // 액자
    const pic = mesh(new THREE.BoxGeometry(1.1, 0.8, 0.06), 0xffd84d); pic.position.set(-2.2, 2.6, -D / 2 + 0.03); this.shell.add(pic);
    const picIn = mesh(new THREE.PlaneGeometry(0.9, 0.6), 0x8fdc8f); picIn.position.set(-2.2, 2.6, -D / 2 + 0.07); this.shell.add(picIn);
    const sun = mesh(new THREE.CircleGeometry(0.1, 12), 0xff8a5a); sun.position.set(-1.95, 2.75, -D / 2 + 0.08); this.shell.add(sun);
    // 현관 매트
    const mat_ = mesh(new THREE.BoxGeometry(2, 0.04, 0.9), 0xff8fb3); mat_.position.set(0, 0.02, D / 2 - 0.2); this.shell.add(mat_);
    const lb = makeLabel('나가는 문 ↓', '#ffffff', 'rgba(255,143,179,0.9)'); lb.position.set(0, 0.5, D / 2 - 0.2); lb.scale.multiplyScalar(0.8); this.shell.add(lb);
    // 집 이름
    const nm = makeLabel(`${profile.houseName}`, '#b0507a', 'rgba(255,255,255,0.92)'); nm.position.set(0, 3.7, -D / 2 + 0.2); nm.scale.multiplyScalar(1.2); this.shell.add(nm);
    this.shell.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
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
  freeSpot() {
    for (let k = 0; k < 40; k++) {
      const x = rand(-3.5, 3.5), z = rand(-2.5, 3);
      if (this.items.every(i => i.userData.walk || Math.hypot(i.position.x - x, i.position.z - z) > i.userData.r + 0.8)) return { x, z };
    }
    return { x: 0, z: 1 };
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
  winSpot(key) { return this.wins[key] ? this.wins[key].spot.clone() : new THREE.Vector3(key === 'fl' ? -2.5 : 2.5, 0, ROOM.d / 2 - 0.6); }

  randomSpot() { return { x: rand(-HX + 0.5, HX - 0.5), z: rand(-HZ + 0.8, HZ - 0.5) }; }
  bedItem() { return this.items.find(i => i.userData.kind === 'bed'); }

  // 방 안 충돌
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
    pos.x = clamp(pos.x, -HX, HX);
    pos.z = clamp(pos.z, -HZ, HZ + 0.3);
  }
  get env() { return { height: () => 0, collide: (p, r, a, b, skip) => this.collide(p, r, skip) }; }

  update(dt, night, weather) {
    this.t += dt;
    this.animWindows(dt);
    if (weather) this.skyMat.color.setScalar(1 - weather.cloud * 0.35);
    if (night > 0.5) this.skyMat.color.setHex(0x2a3060); else if (!weather) this.skyMat.color.setHex(0xffffff);
    this.lamp.intensity = night > 0.5 ? 26 : 0;
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
