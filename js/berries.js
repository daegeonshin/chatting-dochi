import * as THREE from 'three';
import { mesh } from './utils.js';
import { outline, castAll, GFX } from './look.js';
import { height } from './world.js';
import { BERRY_COLORS, BERRY_REGROW_MIN, MAGPIE_COLORS } from './data.js';

// 열매 색 (까치 색표와 같은 색)
export const berryHex = c => (MAGPIE_COLORS[c] || MAGPIE_COLORS.red).hex;
export const BERRY_NAMES = { green: '초록', blue: '파랑', white: '하양', yellow: '노랑', pink: '핑크', purple: '보라', red: '빨강' };

// 마을 둘레의 열매 나무 3그루 (친구 집터, 길과 겹치지 않는 자리)
const SPOTS = [[1.35, 19], [0.25, 20], [1.05, 19]];

export function makeBerryMesh(color) {
  const g = new THREE.Group();
  const b = mesh(new THREE.SphereGeometry(0.23, 12, 10), berryHex(color), { emissive: new THREE.Color(berryHex(color)).multiplyScalar(0.12).getHex() });
  g.add(b);
  const hi = mesh(new THREE.SphereGeometry(0.05, 6, 5), 0xffffff, { emissive: 0xffffff }); hi.position.set(0.08, 0.1, 0.15); g.add(hi);
  const leaf = mesh(new THREE.SphereGeometry(0.07, 6, 4), 0x4fa85c); leaf.scale.set(1.4, 0.4, 0.8); leaf.position.set(0, 0.23, 0); g.add(leaf);
  outline(g, 0.012, 0x4a3048, 0.05);
  return g;
}

// S.berries : { "나무-번호": 딴 시각 }
export class BerryTrees {
  constructor(world, S) {
    this.world = world; this.S = S;
    if (!S.berries) S.berries = {};
    this.trees = [];
    this.berries = [];
    SPOTS.forEach(([a, r], ti) => {
      const x = Math.cos(a * Math.PI) * r, z = Math.sin(a * Math.PI) * r;
      const y = height(x, z) - 0.05;
      const g = new THREE.Group(); g.position.set(x, y, z);
      const trunk = mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.6, 8), 0x9a6a44); trunk.position.y = 1.3; g.add(trunk);
      const top = mesh(new THREE.IcosahedronGeometry(2.1, 2), 0x6cc35f); top.position.y = 3.7; top.scale.set(1, 0.85, 1); g.add(top);
      const top2 = mesh(new THREE.IcosahedronGeometry(1.3, 1), 0x7fcf62); top2.position.set(1.2, 3.2, 0.5); g.add(top2);
      const top3 = mesh(new THREE.IcosahedronGeometry(1.2, 1), 0x5fb35a); top3.position.set(-1.1, 3.3, -0.4); g.add(top3);
      const sign = mesh(new THREE.BoxGeometry(0.9, 0.5, 0.06), 0xfff4e0); sign.position.set(0, 1.0, 0.45); g.add(sign);
      const dot = mesh(new THREE.SphereGeometry(0.09, 8, 6), 0xff6b9a); dot.position.set(0, 1.0, 0.5); g.add(dot);
      outline(g, 0.05, 0x3a4a3a, 0.12);
      castAll(g, GFX.level === 'high', false);
      world.group.add(g);
      world.circles.push({ x, z, r: 0.6 });
      const rec = { x, z, y, h: 5.6, r: 0.35, trunkY: 1.6, type: 'round', cy: 3.7, cr: 2.1, cry: 1.8, berry: true };
      world.trees.push(rec);
      this.trees.push({ g, rec });
      // 색마다 2개씩, 잎 아랫부분 둘레에 (손이 닿는 높이 느낌)
      BERRY_COLORS.forEach((c, ci) => {
        for (let k = 0; k < 2; k++) {
          const ang = (ci * 2 + k) / 14 * Math.PI * 2 + ti;
          const m = makeBerryMesh(c);
          const ry = 2.6 + (k ? 0.5 : 0) + (ci % 3) * 0.25;
          const rr = 2.1 * Math.sqrt(Math.max(0.1, 1 - ((ry - 3.7) / 1.8) ** 2)) + 0.05;
          m.position.set(Math.cos(ang) * rr, ry, Math.sin(ang) * rr);
          m.userData.berry = { key: `${ti}-${ci}-${k}`, color: c };
          g.add(m);
          this.berries.push(m);
        }
      });
    });
    this.refresh();
  }
  ripe(m) {
    const t = this.S.berries[m.userData.berry.key];
    return !t || Date.now() - t >= BERRY_REGROW_MIN * 60000;
  }
  refresh() { for (const m of this.berries) m.visible = this.ripe(m); }
  tapTargets() { return this.berries.filter(m => m.visible); }
  pick(m) {
    if (!this.ripe(m)) return null;
    this.S.berries[m.userData.berry.key] = Date.now();
    m.visible = false;
    return m.userData.berry.color;
  }
  update(dt, t) {
    this.tick = (this.tick || 0) - dt;
    if (this.tick <= 0) { this.tick = 2; this.refresh(); }
    for (const m of this.berries) if (m.visible) m.rotation.y = Math.sin(t * 1.5 + m.position.x) * 0.3;
  }
}
