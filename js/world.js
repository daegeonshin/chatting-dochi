import * as THREE from 'three';
import { toon, outline, castAll, GFX, waterMat, TIME } from './look.js';
import { mat, mesh, seeded, makeLabel, clamp } from './utils.js';
import { COLORS7 } from './data.js';

export const WORLD_R = 112;
export const VILLAGE = { x: 0, z: 0, r: 24 };
export const MEADOW = { x: 58, z: -32, r: 28 };
export const POND = { x: -52, z: 30, r: 13 };
export const WATER_Y = -0.35;
export const HOUSE_POS = { x: 0, z: -13 }; // 내 집 (광장 쪽을 바라봄)
const ZONES = [VILLAGE, MEADOW, POND];

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const dZone = (z, x, y) => Math.hypot(x - z.x, y - z.z);
function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = clamp(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz), 0, 1);
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}
const PATHS = [[VILLAGE, MEADOW], [VILLAGE, POND]];
export function pathDist(x, z) {
  return Math.min(...PATHS.map(([a, b]) => segDist(x, z, a.x, a.z, b.x, b.z)));
}

// 땅 높이
export function height(x, z) {
  let flat = 1;
  for (const zn of ZONES) flat = Math.min(flat, smooth(zn.r, zn.r + 16, dZone(zn, x, z)));
  flat = Math.min(flat, smooth(2, 9, pathDist(x, z)));
  let h = (1.6 * Math.sin(x * 0.045 + 1) * Math.cos(z * 0.038) + 0.7 * Math.sin((x + z) * 0.07) + 0.9) * flat;
  const dp = dZone(POND, x, z);
  if (dp < POND.r + 2) h -= 1.5 * smooth(POND.r + 2, POND.r * 0.3, dp);
  const dc = Math.hypot(x, z);
  h += smooth(WORLD_R - 4, WORLD_R + 18, dc) * 9;
  return h;
}

export function inPond(x, z, margin = 0) { return dZone(POND, x, z) < POND.r - margin; }
export function inMeadow(x, z) { return dZone(MEADOW, x, z) < MEADOW.r; }

export class World {
  constructor(scene, profile) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.circles = []; // { x, z, r }
    this.boxes = [];   // { x0, x1, z0, z1 }
    this.trees = [];   // { x, z, y, h, r, type }
    this.nightMats = [];
    this.treeMeshes = []; this.grassMeshes = [];
    this.rng = seeded(20261115);
    this.buildGround();
    this.buildPond();
    this.buildTrees();
    this.buildGrass();
    this.buildVillage(profile);
    this.buildSky();
    this.dressUp();
  }

  // 윤곽선과 그림자
  dressUp() {
    const hi = GFX.level === 'high';
    this.ground.userData.noOutline = true;
    this.grassMeshes.forEach(m => { m.userData.noOutline = true; });
    if (!hi) this.treeMeshes.forEach(m => { m.userData.noOutline = true; });
    outline(this.group, 0.05, 0x3a4a3a, 0.12);
    castAll(this.group, hi, false);
    this.grassMeshes.forEach(m => { m.castShadow = false; });
    this.ground.castShadow = false;
    this.ground.receiveShadow = true;
  }

  buildGround() {
    const size = 280, seg = 140;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const grass = new THREE.Color(0x8ed46b), grass2 = new THREE.Color(0x76c25a), meadowC = new THREE.Color(0xb2e27c);
    const sand = new THREE.Color(0xeedc9e), plaza = new THREE.Color(0xf0dcae), pathC = new THREE.Color(0xe8d4a0), hill = new THREE.Color(0x6fae55);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, height(x, z));
      const n = (Math.sin(x * 0.31) * Math.cos(z * 0.27) + Math.sin(x * 0.11 + z * 0.13)) * 0.25 + 0.5;
      c.copy(grass).lerp(grass2, n);
      const dm = dZone(MEADOW, x, z);
      if (dm < MEADOW.r + 6) c.lerp(meadowC, smooth(MEADOW.r + 6, MEADOW.r - 4, dm) * 0.85);
      const pd = pathDist(x, z);
      if (pd < 2.6) c.lerp(pathC, smooth(2.6, 1.4, pd));
      const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
      if (dv < 10) c.lerp(plaza, smooth(10, 8.5, dv));
      const dp = dZone(POND, x, z);
      if (dp < POND.r + 3) c.lerp(sand, smooth(POND.r + 3, POND.r + 1, dp));
      const dc = Math.hypot(x, z);
      if (dc > WORLD_R) c.lerp(hill, smooth(WORLD_R, WORLD_R + 10, dc));
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, toon({ vertexColors: true }));
    ground.name = 'ground';
    this.ground = ground;
    this.group.add(ground);
  }

  buildPond() {
    const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 1.6, 48),
      waterMat());
    water.rotation.x = -Math.PI / 2;
    water.position.set(POND.x, WATER_Y, POND.z);
    this.water = water;
    this.group.add(water);
    const r = this.rng;
    for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2, d = r() * (POND.r - 3) + 1;
      const pad = mesh(new THREE.CircleGeometry(0.7 + r() * 0.4, 12, 0.3, Math.PI * 1.8), 0x5bb35a);
      pad.rotation.x = -Math.PI / 2; pad.rotation.z = r() * 6;
      pad.position.set(POND.x + Math.cos(a) * d, WATER_Y + 0.03, POND.z + Math.sin(a) * d);
      this.group.add(pad);
      if (i % 3 === 0) { const fl = mesh(new THREE.SphereGeometry(0.18, 8, 6), 0xffb3d0); fl.position.copy(pad.position).y += 0.12; this.group.add(fl); }
    }
    // 연못가 돌
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + r() * 0.3, d = POND.r + 1.2 + r() * 1.2;
      const x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d;
      const s = 0.4 + r() * 0.6;
      const rock = mesh(new THREE.DodecahedronGeometry(s, 0), 0xb8b4ac);
      rock.position.set(x, height(x, z) + s * 0.3, z); rock.rotation.set(r() * 3, r() * 3, 0);
      this.group.add(rock);
    }
    // 물 안에는 못 들어감
    this.pondBlock = { x: POND.x, z: POND.z, r: POND.r - 0.5 };
  }

  okForTree(x, z, extra = 0) {
    if (Math.hypot(x, z) > WORLD_R + 14) return false;
    if (dZone(VILLAGE, x, z) < VILLAGE.r + 3 + extra) return false;
    if (dZone(MEADOW, x, z) < MEADOW.r + 1 + extra) return false;
    if (dZone(POND, x, z) < POND.r + 5 + extra) return false;
    if (pathDist(x, z) < 3.6) return false;
    return true;
  }

  buildTrees() {
    const r = this.rng;
    const spots = [];
    const grid = new Map();
    const key = (x, z) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
    const near = (x, z, d) => {
      const gx = Math.floor(x / 4), gz = Math.floor(z / 4);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const arr = grid.get(`${gx + i},${gz + j}`);
        if (arr && arr.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < d * d)) return true;
      }
      return false;
    };
    for (let tries = 0; tries < 9000 && spots.length < 520; tries++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (WORLD_R + 12);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!this.okForTree(x, z)) continue;
      const rim = d > WORLD_R - 6;
      if (near(x, z, rim ? 2.6 : 3.6)) continue;
      // 숲 안에 작은 빈터 몇 군데
      if (!rim && Math.sin(x * 0.09) * Math.cos(z * 0.08) > 0.72) continue;
      const p = { x, z };
      spots.push(p);
      const k = key(x, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p);
    }
    // 마을 가장자리 장식 나무
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      const x = Math.cos(a) * (VILLAGE.r + 0.5), z = Math.sin(a) * (VILLAGE.r + 0.5);
      if (pathDist(x, z) > 4) spots.push({ x, z, deco: true });
    }

    const pines = [], rounds = [], birches = [];
    for (const s of spots) {
      const t = s.deco ? 1 : r();
      (t < 0.58 ? pines : t < 0.88 ? rounds : birches).push(s);
    }
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const inst = (geo, count, color) => {
      const im = new THREE.InstancedMesh(geo, toon({ color: 0xffffff }), count);
      im.userData.base = color; this.group.add(im); this.treeMeshes.push(im); return im;
    };
    const place = (im, i, x, y, z, s, sy = s, rot = 0, color) => {
      dummy.position.set(x, y, z); dummy.scale.set(s, sy, s); dummy.rotation.set(0, rot, 0); dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (color !== undefined) im.setColorAt(i, col.set(color));
    };
    const vary = (base, k = 0.12) => col.set(base).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * k, (r() - 0.5) * k).getHex();

    // 소나무
    const pTrunk = inst(new THREE.CylinderGeometry(0.22, 0.32, 2, 7).translate(0, 1, 0), pines.length);
    const pLayers = [0, 1, 2].map(k => inst(new THREE.ConeGeometry(2.2 - k * 0.55, 2.6 - k * 0.3, 8).translate(0, 2.2 + k * 1.55, 0), pines.length));
    pines.forEach((p, i) => {
      const s = 0.8 + r() * 0.65, y = height(p.x, p.z) - 0.1, rot = r() * 6;
      place(pTrunk, i, p.x, y, p.z, s, s, rot, 0x8a5a3a);
      const g = vary(0x3f8f4f);
      pLayers.forEach((L, k) => place(L, i, p.x, y, p.z, s, s, rot + k, col.set(g).offsetHSL(0, 0, k * 0.04).getHex()));
      this.circles.push({ x: p.x, z: p.z, r: 0.55 * s });
      this.trees.push({ x: p.x, z: p.z, y, h: 6.6 * s, r: 0.3 * s, trunkY: 1.6 * s, type: 'pine', cy: 6.25 * s, cr: 0, cry: 0 });
    });
    // 둥근 나무
    const rTrunk = inst(new THREE.CylinderGeometry(0.25, 0.38, 2.8, 7).translate(0, 1.4, 0), rounds.length);
    const rTop = inst(new THREE.IcosahedronGeometry(1.9, 1).translate(0, 3.9, 0), rounds.length);
    const rTop2 = inst(new THREE.IcosahedronGeometry(1.3, 1).translate(1.1, 3.3, 0.4), rounds.length);
    const fruitPalette = [0x6cc35f, 0x7fcf62, 0x9ad468, 0xf3a6c4];
    rounds.forEach((p, i) => {
      const s = 0.85 + r() * 0.5, y = height(p.x, p.z) - 0.1, rot = r() * 6;
      const g = vary(fruitPalette[Math.floor(r() * (p.deco ? 4 : 3))]);
      place(rTrunk, i, p.x, y, p.z, s, s, rot, 0x9a6a44);
      place(rTop, i, p.x, y, p.z, s, s * 0.9, rot, g);
      place(rTop2, i, p.x, y, p.z, s, s * 0.9, rot, col.set(g).offsetHSL(0, 0, -0.05).getHex());
      this.circles.push({ x: p.x, z: p.z, r: 0.6 * s });
      this.trees.push({ x: p.x, z: p.z, y, h: 5.6 * s, r: 0.33 * s, trunkY: 1.4 * s, type: 'round', cy: 3.51 * s, cr: 1.9 * s, cry: 1.71 * s });
    });
    // 자작나무
    const bTrunk = inst(new THREE.CylinderGeometry(0.16, 0.22, 4.2, 7).translate(0, 2.1, 0), birches.length);
    const bTop = inst(new THREE.IcosahedronGeometry(1.4, 1).translate(0, 4.6, 0), birches.length);
    birches.forEach((p, i) => {
      const s = 0.85 + r() * 0.4, y = height(p.x, p.z) - 0.1, rot = r() * 6;
      place(bTrunk, i, p.x, y, p.z, s, s, rot, 0xf2efe6);
      place(bTop, i, p.x, y, p.z, s, s * 1.3, rot, vary(0xb6dd5c));
      this.circles.push({ x: p.x, z: p.z, r: 0.4 * s });
      this.trees.push({ x: p.x, z: p.z, y, h: 6.2 * s, r: 0.2 * s, trunkY: 2.2 * s, type: 'birch', cy: 5.98 * s, cr: 1.4 * s, cry: 1.82 * s });
    });
    this.group.children.forEach(o => { if (o.isInstancedMesh && o.instanceColor) o.instanceColor.needsUpdate = true; });
  }

  buildGrass() {
    const r = this.rng;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    // 풀 포기
    const blade = new THREE.ConeGeometry(0.09, 0.5, 4).translate(0, 0.25, 0);
    const tuft = new THREE.BufferGeometry();
    {
      const parts = [];
      for (let i = 0; i < 3; i++) { const b = blade.clone(); b.rotateZ((i - 1) * 0.35); b.translate((i - 1) * 0.08, 0, 0); parts.push(b); }
      tuft.copy(mergeGeos(parts));
    }
    const N = GFX.level === 'high' ? 4200 : 2200;
    const grass = new THREE.InstancedMesh(tuft, toon({ color: 0xffffff }), N);
    let n = 0;
    for (let tries = 0; tries < N * 4 && n < N; tries++) {
      let x, z;
      if (n < N * 0.45) { const a = r() * 6.283, d = Math.sqrt(r()) * MEADOW.r; x = MEADOW.x + Math.cos(a) * d; z = MEADOW.z + Math.sin(a) * d; }
      else { const a = r() * 6.283, d = Math.sqrt(r()) * WORLD_R; x = Math.cos(a) * d; z = Math.sin(a) * d; }
      if (dZone(POND, x, z) < POND.r + 1.5 || pathDist(x, z) < 1.8 || Math.hypot(x, z) < 11) continue;
      dummy.position.set(x, height(x, z), z);
      const s = 0.7 + r() * 0.8; dummy.scale.set(s, s, s); dummy.rotation.set(0, r() * 6, 0); dummy.updateMatrix();
      grass.setMatrixAt(n, dummy.matrix);
      grass.setColorAt(n, col.set(0x6dbb4f).offsetHSL((r() - 0.5) * 0.05, 0, (r() - 0.3) * 0.12));
      n++;
    }
    grass.count = n; grass.instanceColor.needsUpdate = true; this.grassMeshes.push(grass);
    this.group.add(grass);
    // 들판 꽃 (줄기 + 꽃잎 다섯 장)
    const stemGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.32, 4).translate(0, 0.16, 0);
    const petals = [];
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; petals.push(new THREE.SphereGeometry(0.075, 6, 4).scale(1, 0.45, 1).translate(Math.cos(a) * 0.08, 0.34, Math.sin(a) * 0.08)); }
    petals.push(new THREE.SphereGeometry(0.05, 6, 4).translate(0, 0.36, 0));
    const headGeo = mergeGeos(petals);
    const FN = GFX.level === 'high' ? 700 : 400;
    const stems = new THREE.InstancedMesh(stemGeo, toon({ color: 0x5fae4c }), FN);
    const flowers = new THREE.InstancedMesh(headGeo, toon({ color: 0xffffff }), FN);
    const fc = [0xffffff, 0xfff27a, 0xffa6c9, 0xc9a7ff, 0xff8a8a];
    for (let i = 0; i < FN; i++) {
      const inM = i < FN * 0.75;
      const a = r() * 6.283, d = Math.sqrt(r()) * (inM ? MEADOW.r : VILLAGE.r + 6);
      const cx = inM ? MEADOW.x : 0, cz = inM ? MEADOW.z : 0;
      let x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (!inM && Math.hypot(x, z) < 11) { x *= 1.8; z *= 1.8; }
      dummy.position.set(x, height(x, z), z); dummy.scale.setScalar(0.9 + r() * 0.7); dummy.rotation.set((r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3); dummy.updateMatrix();
      stems.setMatrixAt(i, dummy.matrix);
      flowers.setMatrixAt(i, dummy.matrix);
      flowers.setColorAt(i, col.set(fc[Math.floor(r() * fc.length)]));
    }
    flowers.instanceColor.needsUpdate = true;
    this.group.add(stems, flowers); this.grassMeshes.push(stems, flowers);
    // 덤불
    for (let i = 0; i < 40; i++) {
      const a = r() * 6.283, d = 30 + r() * 78;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!this.okForTree(x, z, -2)) continue;
      const b = mesh(new THREE.IcosahedronGeometry(0.8 + r() * 0.5, 1), 0x5fae4c);
      b.scale.y = 0.7; b.position.set(x, height(x, z) + 0.3, z);
      this.group.add(b);
      this.circles.push({ x, z, r: 0.9 });
    }
  }

  buildVillage(profile) {
    // 광장 분수
    const fountain = new THREE.Group();
    const basin = mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.6, 24), 0xe8e2d6); basin.position.y = 0.3;
    const water = mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.1, 24), 0x7fd0f5, { emissive: 0x103040 }); water.position.y = 0.55;
    const pillar = mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 10), 0xe8e2d6); pillar.position.y = 1.1;
    const top = mesh(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xe8e2d6); top.position.y = 1.9;
    const spout = mesh(new THREE.SphereGeometry(0.3, 10, 8), 0xaee6ff, { emissive: 0x204050, transparent: true, opacity: 0.8 }); spout.position.y = 2.2;
    this.spout = spout;
    fountain.add(basin, water, pillar, top, spout);
    this.group.add(fountain);
    this.circles.push({ x: 0, z: 0, r: 2.7 });

    // 가로등
    this.lampMat = toon({ color: 0xfff6cc, emissive: 0x000000 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * 11, z = Math.sin(a) * 11;
      const post = mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), 0x5a5a6a); post.position.set(x, 1.3, z);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), this.lampMat); bulb.position.set(x, 2.75, z);
      const cap = mesh(new THREE.ConeGeometry(0.34, 0.25, 8), 0x5a5a6a); cap.position.set(x, 3.05, z);
      this.group.add(post, bulb, cap);
      this.circles.push({ x, z, r: 0.25 });
    }
    // 벤치
    for (const a of [0.9, 2.3, 3.9, 5.4]) {
      const x = Math.cos(a) * 6.5, z = Math.sin(a) * 6.5;
      const b = new THREE.Group();
      const seat = mesh(new THREE.BoxGeometry(2, 0.12, 0.6), 0xc8905a); seat.position.y = 0.5;
      const back = mesh(new THREE.BoxGeometry(2, 0.5, 0.1), 0xc8905a); back.position.set(0, 0.85, -0.28);
      [-0.8, 0.8].forEach(lx => { const l = mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), 0x6a5a5a); l.position.set(lx, 0.25, 0); b.add(l); });
      b.add(seat, back); b.position.set(x, 0, z); b.lookAt(0, 0, 0);
      this.group.add(b);
      this.circles.push({ x, z, r: 0.8 });
    }

    // 내 집
    this.myHouse = this.makeHouse(profile.houseColor, profile.houseName);
    this.myHouse.position.set(HOUSE_POS.x, 0, HOUSE_POS.z);
    this.group.add(this.myHouse);
    this.boxes.push({ x0: HOUSE_POS.x - 2.7, x1: HOUSE_POS.x + 2.7, z0: HOUSE_POS.z - 2.4, z1: HOUSE_POS.z + 2.35 });
    this.door = new THREE.Vector3(HOUSE_POS.x, 0, HOUSE_POS.z + 3.2);

    // 친구 집터 (4단계에서 친구 집이 들어올 자리)
    this.lots = [];
    const lotAngles = [Math.PI * 0.12, Math.PI * 0.38, Math.PI * 0.62, Math.PI * 0.88, Math.PI * 1.75];
    for (const a of lotAngles) {
      const x = Math.cos(a) * 15.5, z = Math.sin(a) * 15.5;
      if (pathDist(x, z) < 4.5) continue;
      const lot = new THREE.Group();
      const base = mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.08, 20), 0xd9ecb0); base.position.y = 0.04;
      lot.add(base);
      for (let k = 0; k < 10; k++) {
        const fa = (k / 10) * Math.PI * 2;
        const fl = mesh(new THREE.SphereGeometry(0.16, 7, 5), [0xffa6c9, 0xfff27a, 0xffffff][k % 3]);
        fl.position.set(Math.cos(fa) * 2.3, 0.2, Math.sin(fa) * 2.3); lot.add(fl);
      }
      const sign = mesh(new THREE.BoxGeometry(0.08, 1, 0.08), 0x9a6a44); sign.position.y = 0.5; lot.add(sign);
      const label = makeLabel('친구 집 자리', '#7a5a3a', 'rgba(255,248,230,0.95)'); label.position.y = 1.25; label.scale.multiplyScalar(0.8); lot.add(label);
      lot.position.set(x, 0, z);
      this.group.add(lot);
      this.lots.push({ x, z, a });
    }
  }

  makeHouse(colorId, name) {
    const wall = (COLORS7.find(c => c.id === colorId) || COLORS7[0]).hex;
    const roofC = colorId === 'white' ? 0x8fb8ff : new THREE.Color(wall).offsetHSL(0.02, 0.05, -0.22).getHex();
    const g = new THREE.Group();
    const body = mesh(new THREE.BoxGeometry(5, 3.2, 4.4), wall); body.position.y = 1.6;
    const trim = mesh(new THREE.BoxGeometry(5.2, 0.3, 4.6), 0xffffff); trim.position.y = 0.15;
    const roof = mesh(new THREE.ConeGeometry(4.3, 2.4, 4, 1), roofC); roof.position.y = 4.4; roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.92);
    const chimney = mesh(new THREE.BoxGeometry(0.6, 1.3, 0.6), 0xd98a7a); chimney.position.set(1.4, 4.6, -0.6);
    const door = mesh(new THREE.BoxGeometry(1.2, 2, 0.12), 0xa0663e); door.position.set(0, 1.05, 2.22);
    const doorTop = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 16, 1, false, 0, Math.PI), 0xa0663e);
    doorTop.rotation.set(Math.PI / 2, Math.PI / 2, 0); doorTop.position.set(0, 2.05, 2.22);
    const knob = mesh(new THREE.SphereGeometry(0.07, 8, 6), 0xffd84d); knob.position.set(0.4, 1.0, 2.3);
    const step = mesh(new THREE.BoxGeometry(1.8, 0.15, 0.8), 0xd8d0c0); step.position.set(0, 0.08, 2.6);
    g.add(body, trim, roof, chimney, door, doorTop, knob, step);
    this.windowMat = this.windowMat || toon({ color: 0xbfe8ff, emissive: 0x000000 });
    // 창문 : 문 양쪽(fl, fr) + 왼쪽(l), 오른쪽(r), 뒤(b) 벽에 하나씩
    const wins = {};
    const makeWin = (key, x, y, z, rotY, flowers) => {
      const w = new THREE.Group(); w.position.set(x, y, z); w.rotation.y = rotY;
      const frame = mesh(new THREE.BoxGeometry(1.1, 1.1, 0.1), 0xffffff); w.add(frame);
      const hole = mesh(new THREE.BoxGeometry(0.86, 0.86, 0.05), 0x5a4060); hole.position.z = 0.04; w.add(hole);
      const curtain = mesh(new THREE.BoxGeometry(0.84, 0.84, 0.02), 0xffb3c8); curtain.position.z = 0.07; w.add(curtain);
      const panes = [-1, 1].map(s => {
        const hinge = new THREE.Group(); hinge.position.set(0.43 * s, 0, 0.1);
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.86, 0.04), this.windowMat); p.position.x = -0.215 * s; hinge.add(p);
        const bar = mesh(new THREE.BoxGeometry(0.04, 0.86, 0.05), 0xffffff); bar.position.x = -0.42 * s; hinge.add(bar);
        w.add(hinge); return hinge;
      });
      if (flowers) {
        const box = mesh(new THREE.BoxGeometry(1.2, 0.25, 0.35), 0x9a6a44); box.position.set(0, -0.65, 0.18); w.add(box);
        for (let k = 0; k < 3; k++) { const f = mesh(new THREE.SphereGeometry(0.12, 7, 5), [0xff7aa8, 0xfff27a, 0xffffff][k]); f.position.set((k - 1) * 0.35, -0.45, 0.18); w.add(f); }
      }
      g.add(w);
      wins[key] = { panes, curtain, hole };
    };
    makeWin('fl', -1.6, 1.9, 2.2, 0, true);
    makeWin('fr', 1.6, 1.9, 2.2, 0, true);
    makeWin('l', -2.5, 1.9, 0, -Math.PI / 2, false);
    makeWin('r', 2.5, 1.9, 0, Math.PI / 2, false);
    makeWin('b', 0, 1.9, -2.2, Math.PI, false);
    g.userData.wins = wins;
    if (this.winState) applyWindows(g, this.winState);
    outline(g, 0.045, 0x4a3048, 0.1);
    castAll(g, true, true);
    if (name) { const lb = makeLabel(name, '#ffffff', 'rgba(176,80,122,0.9)'); lb.position.set(0, 3.0, 2.5); lb.scale.multiplyScalar(1.3); g.add(lb); this.houseLabel = lb; }
    return g;
  }

  // 창문 열기, 커튼
  setWindows(state) { this.winState = state; applyWindows(this.myHouse, state); }

  // 집 색이나 이름이 바뀌면 다시 짓기
  rebuildHouse(profile) {
    this.group.remove(this.myHouse);
    this.myHouse = this.makeHouse(profile.houseColor, profile.houseName);
    this.myHouse.position.set(HOUSE_POS.x, 0, HOUSE_POS.z);
    this.group.add(this.myHouse);
  }

  buildSky() {
    // 별
    const N = 700, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.random() * 0.45 + 0.05;
      pos[i * 3] = Math.cos(u) * Math.cos(v * Math.PI) * 400;
      pos[i * 3 + 1] = Math.abs(Math.sin(v * Math.PI)) * 300 + 40;
      pos[i * 3 + 2] = Math.sin(u) * Math.cos(v * Math.PI) * 400;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff1a8, fog: false }));
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(10, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfdf6d8, fog: false }));
    this.scene.add(this.sunMesh, this.moonMesh);
    // 반딧불이 (밤)
    const FN = 140, fp = new Float32Array(FN * 3);
    this.fireflySeeds = [];
    for (let i = 0; i < FN; i++) {
      const inM = i < 70;
      const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * (inM ? MEADOW.r : 90);
      const x = (inM ? MEADOW.x : 0) + Math.cos(a) * d, z = (inM ? MEADOW.z : 0) + Math.sin(a) * d;
      this.fireflySeeds.push({ x, z, y: height(x, z) + 0.6 + Math.random() * 1.6, p: Math.random() * 10 });
    }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    this.fireflies = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xf6ff8a, size: 0.28, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(this.fireflies);
  }

  update(dt, t, night) {
    TIME.value = t;
    if (this.spout) this.spout.scale.y = 1 + Math.sin(t * 6) * 0.15;
    if (this.water) this.water.material.emissive.setHex(night > 0.5 ? 0x0a1a30 : 0x1a4a66);
    if (night > 0.01) {
      const p = this.fireflies.geometry.attributes.position;
      this.fireflySeeds.forEach((f, i) => {
        p.setXYZ(i, f.x + Math.sin(t * 0.7 + f.p) * 1.2, f.y + Math.sin(t * 1.3 + f.p * 2) * 0.4, f.z + Math.cos(t * 0.6 + f.p) * 1.2);
      });
      p.needsUpdate = true;
    }
    this.fireflies.material.opacity = night * (0.6 + Math.sin(t * 3) * 0.3);
    this.fireflies.visible = night > 0.01;
  }

  // 충돌 처리 (원 + 상자 + 연못 + 세계 경계)
  collide(pos, rad, allowWater = false, skipObstacles = false) {
    const near = skipObstacles ? [] : this.circles;
    for (let i = 0; i < near.length; i++) {
      const c = near[i];
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const rr = c.r + rad;
      if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) / d; pos.x += dx * k; pos.z += dz * k; }
    }
    for (const b of (skipObstacles ? [] : this.boxes)) {
      if (pos.x > b.x0 - rad && pos.x < b.x1 + rad && pos.z > b.z0 - rad && pos.z < b.z1 + rad) {
        const pl = pos.x - (b.x0 - rad), pr = (b.x1 + rad) - pos.x, pb = pos.z - (b.z0 - rad), pf = (b.z1 + rad) - pos.z;
        const m = Math.min(pl, pr, pb, pf);
        if (m === pl) pos.x = b.x0 - rad; else if (m === pr) pos.x = b.x1 + rad; else if (m === pb) pos.z = b.z0 - rad; else pos.z = b.z1 + rad;
      }
    }
    if (!allowWater) {
      const p = this.pondBlock, dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz), rr = p.r + rad;
      if (d < rr && d > 1e-6) { pos.x = p.x + dx / d * rr; pos.z = p.z + dz / d * rr; }
    }
    const dc = Math.hypot(pos.x, pos.z);
    if (dc > WORLD_R - 1) { pos.x *= (WORLD_R - 1) / dc; pos.z *= (WORLD_R - 1) / dc; }
  }

  height(x, z) { return height(x, z); }

  // 올라탈 나무 (잎이 낮은 소나무는 빼고)
  nearestTree(x, z, maxD = 30) {
    let best = null, bd = maxD * maxD;
    for (const t of this.trees) {
      if (t.type === 'pine') continue; const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (d < bd) { bd = d; best = t; } }
    return best;
  }
}

export function applyWindows(house, state) {
  const wins = house && house.userData.wins;
  if (!wins || !state) return;
  for (const [k, w] of Object.entries(wins)) {
    const st = state[k] || { open: false, cur: true };
    w.panes.forEach((p, i) => { p.rotation.y = st.open ? (i ? 1 : -1) * 1.9 : 0; });
    w.curtain.visible = !st.cur;
  }
}

// 여러 지오메트리를 하나로 합치기 (index 없는 형태)
export function mergeGeos(geos) {
  const ng = geos.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; ng.forEach(g => n += g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of ng) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
