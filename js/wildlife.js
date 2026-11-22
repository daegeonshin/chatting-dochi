import * as THREE from 'three';
import { mesh, rand, pick, angleLerp } from './utils.js';
import { outline } from './look.js';
import { POND, WATER_Y, WORLD_R, VILLAGE, MEADOW, height, inPond } from './world.js';
import { MAGPIE_COLORS, breedColor } from './data.js';
import { sfx } from './audio.js';

const S = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
function eye2(g, y, z, x, r = 0.025) {
  for (const s of [-1, 1]) {
    const e = mesh(S(r, 6, 5), 0x1a1214); e.position.set(x * s, y, z); g.add(e);
    const h = mesh(S(r * 0.4, 4, 3), 0xffffff, { emissive: 0xffffff }); h.position.set(x * s + r * 0.3, y + r * 0.4, z + r * 0.5); g.add(h);
  }
}
const ease = k => k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;

// ───────── 모델 ─────────
function makeFish(color) {
  const g = new THREE.Group();
  const body = mesh(S(0.22, 12, 8), color); body.scale.set(0.55, 0.8, 1.3); g.add(body);
  const tail = mesh(new THREE.ConeGeometry(0.16, 0.22, 4), color); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.35; tail.scale.x = 0.3; g.add(tail);
  eye2(g, 0.05, 0.2, 0.08, 0.03);
  g.userData.tail = tail;
  return g;
}
const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
export function makeDuck(baby) {
  const g = new THREE.Group();
  const bodyC = baby ? 0xffe14d : 0xfaf8f0;
  const body = mesh(S(0.3, 14, 10), bodyC); body.scale.set(0.85, 0.7, 1.15); body.position.y = 0.28; g.add(body);
  const head = mesh(S(0.18, 12, 10), baby ? 0xffe14d : 0x3a9a5a); head.position.set(0, 0.6, 0.25); g.add(head);
  if (!baby) { const ring = mesh(new THREE.TorusGeometry(0.12, 0.025, 4, 12), 0xffffff); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.45, 0.22); g.add(ring); }
  const beak = mesh(S(0.08, 8, 6), 0xff9a3a); beak.scale.set(1, 0.4, 1.4); beak.position.set(0, 0.57, 0.43); g.add(beak);
  eye2(g, 0.65, 0.38, 0.1);
  const tail = mesh(new THREE.ConeGeometry(0.1, 0.2, 4), bodyC); tail.rotation.x = -2.2; tail.position.set(0, 0.38, -0.33); g.add(tail);
  const legs = [-1, 1].map(s => { const L = new THREE.Group(); L.position.set(0.1 * s, 0.12, 0); const l = mesh(new THREE.BoxGeometry(0.04, 0.14, 0.04), 0xff9a3a); l.position.y = -0.06; const f = mesh(new THREE.BoxGeometry(0.12, 0.02, 0.14), 0xff9a3a); f.position.set(0, -0.12, 0.04); L.add(l, f); g.add(L); return L; });
  const wings = [-1, 1].map(s => {
    const w = new THREE.Group(); w.position.set(0.22 * s, 0.36, 0);
    const wm = mesh(S(0.2, 10, 8), baby ? 0xffd83a : 0xd8d4c8); wm.scale.set(0.25, 0.55, 1); wm.position.set(0.04 * s, 0, -0.03); w.add(wm);
    g.add(w); return w;
  });
  g.userData.legs = legs; g.userData.head = head; g.userData.wings = wings;
  outline(g, 0.014, 0x4a3048, 0.05);
  // 누르기 쉽게 보이지 않는 큰 공 (작은 오리도 톡 누르기 쉽게)
  const hitBall = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), HIT_MAT); hitBall.position.y = 0.35; hitBall.userData.noOutline = true; g.add(hitBall);
  if (baby) g.scale.setScalar(0.5);
  return g;
}
export function makeSparrow() {
  const g = new THREE.Group();
  const body = mesh(S(0.11, 10, 8), 0xa07850); body.scale.set(0.9, 0.85, 1.3); body.position.y = 0.12; g.add(body);
  const belly = mesh(S(0.09, 8, 6), 0xf0e0c8); belly.position.set(0, 0.1, 0.03); g.add(belly);
  const head = new THREE.Group(); head.position.set(0, 0.21, 0.09); g.add(head);
  head.add(mesh(S(0.075, 10, 8), 0x8a5a3a));
  const cheek = mesh(S(0.05, 6, 5), 0xffffff); cheek.position.set(0, -0.02, 0.03); head.add(cheek);
  const beak = mesh(new THREE.ConeGeometry(0.02, 0.05, 4), 0x3a3a3a); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0, 0.08); head.add(beak);
  eye2(head, 0.015, 0.055, 0.04, 0.015);
  const tail = mesh(new THREE.BoxGeometry(0.06, 0.015, 0.12), 0x6a4a2a); tail.position.set(0, 0.14, -0.16); tail.rotation.x = -0.4; g.add(tail);
  const wings = [-1, 1].map(s => { const w = new THREE.Group(); w.position.set(0.09 * s, 0.15, 0); const wm = mesh(S(0.07, 6, 5), 0x7a5030); wm.scale.set(0.3, 0.7, 1.2); wm.position.set(0.02 * s, -0.02, -0.02); w.add(wm); g.add(w); return w; });
  g.userData.head = head; g.userData.wings = wings;
  outline(g, 0.01, 0x4a3048, 0.05);
  g.scale.setScalar(1.25);
  return g;
}
// 까치 (발이 원점). colorId는 검정 부분 색, 흰 무늬는 그대로
export function makeMagpie(colorId = 'black', baby = false) {
  const c = (MAGPIE_COLORS[colorId] || MAGPIE_COLORS.black).hex;
  const tailC = colorId === 'black' ? 0x23305a : new THREE.Color(c).multiplyScalar(0.85).getHex();
  const g = new THREE.Group();
  const bodyG = new THREE.Group(); bodyG.position.y = 0.2; g.add(bodyG);
  const body = mesh(S(0.17, 12, 10), c); body.scale.set(0.85, 0.85, 1.4); bodyG.add(body);
  const belly = mesh(S(0.13, 10, 8), 0xffffff); belly.position.set(0, -0.05, 0.03); belly.scale.set(1, 0.8, 1.2); bodyG.add(belly);
  const head = new THREE.Group(); head.position.set(0, 0.12, 0.22); bodyG.add(head);
  head.add(mesh(S(0.11, 12, 10), c));
  const beak = mesh(new THREE.ConeGeometry(0.03, 0.1, 5), 0x2a2a2a); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.01, 0.14); head.add(beak);
  eye2(head, 0.03, 0.09, 0.06, 0.022);
  const tail = new THREE.Group(); tail.position.set(0, 0.02, -0.2); bodyG.add(tail);
  const tm = mesh(new THREE.BoxGeometry(0.09, 0.025, 0.5), tailC); tm.position.z = -0.24; tail.add(tm);
  const wings = [-1, 1].map(s => {
    const w = new THREE.Group(); w.position.set(0.12 * s, 0.05, 0);
    const wm = mesh(new THREE.BoxGeometry(0.4, 0.025, 0.26), c); wm.position.x = 0.2 * s; w.add(wm);
    const patch = mesh(new THREE.BoxGeometry(0.15, 0.03, 0.12), 0xffffff); patch.position.set(0.2 * s, 0, 0.02); w.add(patch);
    w.rotation.z = -1.25 * s;
    bodyG.add(w); return w;
  });
  const legs = [-1, 1].map(s => {
    const L = new THREE.Group(); L.position.set(0.05 * s, 0.1, 0.02);
    const l = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 4), 0x3a3a3a); l.position.y = -0.04; L.add(l);
    const f = mesh(new THREE.BoxGeometry(0.05, 0.012, 0.08), 0x3a3a3a); f.position.set(0, -0.1, 0.02); L.add(f);
    g.add(L); return L;
  });
  g.userData = { wings, legs, body: bodyG, tail, head, color: colorId };
  outline(g, 0.012, 0x2a2030, 0.06);
  g.scale.setScalar(baby ? 0.75 : 1.3);
  return g;
}
export function makeEgg() {
  const e = mesh(S(0.09, 10, 8), 0xdfeee6);
  e.scale.set(1, 1.3, 1);
  for (let i = 0; i < 5; i++) { const d = mesh(S(0.018, 4, 3), 0x6a8a7a); const a = i * 1.3; d.position.set(Math.cos(a) * 0.085, (i % 3 - 1) * 0.05, Math.sin(a) * 0.085); e.add(d); }
  return e;
}
export function makeNestMesh() {
  const g = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(0.32, 0.12, 8, 16), 0x8a5a3a); ring.rotation.x = Math.PI / 2; g.add(ring);
  const bottom = mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.12, 12), 0x7a5030); bottom.position.y = -0.06; g.add(bottom);
  for (let k = 0; k < 8; k++) { const tw = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 3), 0x6a4528); tw.rotation.set(Math.PI / 2, 0, k * 0.8); tw.position.set(Math.cos(k * 0.8) * 0.33, 0.04, Math.sin(k * 0.8) * 0.33); g.add(tw); }
  outline(g, 0.012, 0x3a2a20, 0.1);
  return g;
}

// 까치 자세 (perch : 앉음 / fly : 날기 / flare : 착지 직전)
export function poseMagpie(m, mode, t, k = 0) {
  const U = m.userData;
  if (mode === 'fly' || mode === 'flare') {
    const flap = mode === 'flare' ? Math.sin(t * 26) * 0.35 + 0.2 : Math.sin(t * 18) * 0.85;
    U.wings.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * flap);
    U.body.rotation.x = mode === 'flare' ? -0.55 : 0.05;
    U.tail.rotation.x = mode === 'flare' ? 0.5 : 0;
    U.legs.forEach(L => { L.visible = mode === 'flare'; L.rotation.x = 0.3; });
  } else {
    U.wings.forEach((w, i) => w.rotation.z = (i ? 1 : -1) * 1.25);
    U.body.rotation.x = -0.28 + Math.sin(t * 2) * 0.02;
    U.tail.rotation.x = 0.55 + Math.max(0, Math.sin(t * 3.1)) * 0.25;
    U.legs.forEach(L => { L.visible = true; L.rotation.x = 0; });
    U.head.rotation.y = Math.sin(t * 0.9 + k) * 0.6;
  }
}

// ───────── 길가 동물 ─────────
// ctx : { isNight(), nightLevel(), weather, house : { anyOpen(), doorPos }, onBirdEnter(kind, color) }
export class Wildlife {
  constructor(scene, world, ctx) {
    this.scene = scene; this.world = world; this.ctx = ctx;
    this.group = new THREE.Group(); scene.add(this.group);
    this.t = 0;
    this.fish = [];
    for (let i = 0; i < 8; i++) {
      const f = makeFish(pick([0xff8a3a, 0xffd84d, 0xff6b6b, 0xffffff]));
      this.group.add(f);
      this.fish.push({ m: f, a: Math.random() * 6.28, r: rand(2, POND.r - 2.5), sp: rand(0.25, 0.5) * (Math.random() < 0.5 ? -1 : 1), d: rand(0.25, 0.6), jump: -1 });
    }
    this.families = []; this.duckTimer = 6;
    this.sparrows = []; this.sparrowTimer = 2; this.flockId = 0;
    this.magpies = []; this.nests = [];
    const trees = world.trees.filter(t => Math.hypot(t.x, t.z) < 75 && t.type !== 'pine');
    for (let i = 0; i < 5; i++) {
      const m = makeMagpie('black'); this.group.add(m);
      const tr = pick(trees);
      const mp = { m, tree: tr, state: 'perch', timer: rand(3, 10), from: new THREE.Vector3(), to: new THREE.Vector3(), k: 0, dur: 1, partner: null, leader: false, paired: 0, color: 'black', ph: Math.random() * 6 };
      this.perchSpot(tr, m.position);
      this.magpies.push(mp);
    }
  }

  // 나뭇잎 표면 위에 앉는 자리 (나무에 꽂히지 않게)
  perchSpot(tr, out, side = Math.random() * 6.28, frac = rand(0.15, 0.5)) {
    if (!tr.cr) return out.set(tr.x, tr.y + tr.cy + 0.02, tr.z);
    const d = tr.cr * frac;
    const y = tr.y + tr.cy + tr.cry * Math.sqrt(Math.max(0, 1 - frac * frac));
    return out.set(tr.x + Math.cos(side) * d, y - 0.04, tr.z + Math.sin(side) * d);
  }
  nearestTree(x, z, maxD = 20, noPine = false) {
    let best = null, bd = maxD * maxD;
    for (const t of this.world.trees) { if (noPine && t.type === 'pine') continue; const d = (t.x - x) ** 2 + (t.z - z) ** 2; if (d < bd) { bd = d; best = t; } }
    return best;
  }

  // ── 오리 ──
  pondFarthest(x, z) {
    let best = null, bd = -1;
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * Math.PI * 2, r = POND.r - 2.2 - (i % 2) * 2;
      const px = POND.x + Math.cos(a) * r, pz = POND.z + Math.sin(a) * r;
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d > bd) { bd = d; best = { x: px, z: pz }; }
    }
    return best;
  }
  spawnFamily() {
    const babies = Math.random() < 0.4 ? 0 : Math.min(8, 1 + Math.floor(Math.random() * 4 + Math.random() * 4));
    const a = Math.random() * 6.28;
    const from = new THREE.Vector3(POND.x + Math.cos(a) * 75, 26, POND.z + Math.sin(a) * 75);
    const la = Math.random() * 6.28, lr = rand(1, POND.r - 4);
    const to = new THREE.Vector3(POND.x + Math.cos(la) * lr, -0.47, POND.z + Math.sin(la) * lr);
    const dir = to.clone().sub(from).setY(0).normalize();
    const fam = { ducks: [], state: 'arrive', life: 0, maxLife: rand(300, 540), fleeCool: 0 };
    for (let i = 0; i <= babies; i++) {
      const m = makeDuck(i > 0); this.group.add(m);
      const off = dir.clone().multiplyScalar(-i * 0.9);
      const d = { m, baby: i > 0, yaw: Math.atan2(dir.x, dir.z), from: from.clone().add(off).setY(from.y + i * 0.2), to: to.clone().add(off), k: -i * 0.06, dur: 7 };
      m.position.copy(d.from);
      fam.ducks.push(d);
    }
    this.families.push(fam);
  }
  updateDucks(dt, px, pz, player) {
    const night = this.ctx.isNight() || this.ctx.nightLevel() > 0.35;
    if (!night && this.families.length < 3) {
      this.duckTimer -= dt;
      if (this.duckTimer <= 0) { this.spawnFamily(); this.duckTimer = rand(30, 75); }
    }
    const t = this.t;
    for (let fi = this.families.length - 1; fi >= 0; fi--) {
      const fam = this.families[fi];
      fam.life += dt; fam.fleeCool -= dt;
      const mom = fam.ducks[0];
      if ((night || fam.life > fam.maxLife) && fam.state === 'swim') {
        fam.state = 'leave';
        const a = Math.random() * 6.28;
        fam.ducks.forEach((d, i) => { d.from = d.m.position.clone(); d.to = new THREE.Vector3(POND.x + Math.cos(a) * 80 - i * 0.6, 28, POND.z + Math.sin(a) * 80); d.k = -i * 0.05; d.dur = 7; });
        sfx.quack(0.08);
      }
      if (fam.state === 'arrive' || fam.state === 'leave') {
        let done = true;
        fam.ducks.forEach((d, i) => {
          d.k += dt / d.dur;
          const k = Math.max(0, Math.min(1, d.k));
          if (k < 1) done = false;
          const kk = fam.state === 'arrive' ? 1 - (1 - k) ** 2 : k * k;
          d.m.position.lerpVectors(d.from, d.to, kk);
          d.yaw = Math.atan2(d.to.x - d.from.x, d.to.z - d.from.z);
          const flying = fam.state === 'leave' ? d.k > 0.02 : k < 0.97;
          d.m.userData.wings.forEach((w, s) => w.rotation.z = (s ? -1 : 1) * (flying ? Math.sin(t * 20 + i) * 1.1 : 0));
          d.m.userData.legs.forEach(L => L.rotation.x = flying ? 0.9 : 0);
          if (fam.state === 'arrive' && k >= 1 && !d.landed) { d.landed = true; if (Math.hypot(px - d.m.position.x, pz - d.m.position.z) < 40) sfx.splash(); }
          d.m.rotation.y = d.yaw;
        });
        if (done) {
          if (fam.state === 'arrive') { fam.state = 'swim'; fam.target = null; if (Math.hypot(px - mom.m.position.x, pz - mom.m.position.z) < 40) sfx.quack(0.1); }
          else { fam.ducks.forEach(d => this.group.remove(d.m)); this.families.splice(fi, 1); }
        }
        continue;
      }
      // 헤엄 : 엄마가 앞장서고 아기들은 줄줄이. 다가가면 연못 안에서 가장 먼 곳으로
      const dp = Math.hypot(px - mom.m.position.x, pz - mom.m.position.z);
      if (dp < 7 && !player.flying && fam.fleeCool <= 0) { fam.target = this.pondFarthest(px, pz); fam.fast = true; fam.fleeCool = 2.5; sfx.quack(0.12); }
      if (!fam.target || (!fam.fast && Math.random() < dt * 0.08)) {
        const a = Math.random() * 6.28, r = rand(1, POND.r - 3.5);
        fam.target = { x: POND.x + Math.cos(a) * r, z: POND.z + Math.sin(a) * r }; fam.fast = false;
      }
      const spd = fam.fast ? 3.4 : 0.8;
      fam.ducks.forEach((d, i) => {
        const m = d.m;
        let tx, tz;
        if (i === 0) { tx = fam.target.x; tz = fam.target.z; }
        else { const prev = fam.ducks[i - 1]; const gap = i === 1 ? 0.7 : 0.45; tx = prev.m.position.x - Math.sin(prev.yaw) * gap; tz = prev.m.position.z - Math.cos(prev.yaw) * gap; }
        const dx = tx - m.position.x, dz = tz - m.position.z, dd = Math.hypot(dx, dz);
        if (dd > 0.15) {
          d.yaw = angleLerp(d.yaw, Math.atan2(dx, dz), dt * (fam.fast ? 6 : 2.5));
          const sp = i === 0 ? spd : Math.min(spd * 1.4 + dd, dd * 3);
          m.position.x += Math.sin(d.yaw) * sp * dt; m.position.z += Math.cos(d.yaw) * sp * dt;
        } else if (i === 0 && fam.fast) fam.fast = false;
        const ox = m.position.x - POND.x, oz = m.position.z - POND.z, od = Math.hypot(ox, oz), lim = POND.r - 1.6;
        if (od > lim) { m.position.x = POND.x + ox / od * lim; m.position.z = POND.z + oz / od * lim; }
        m.position.y = WATER_Y - 0.12 * (d.baby ? 0.5 : 1) + Math.sin(t * 2.4 + i) * 0.02;
        m.userData.wings.forEach(w => w.rotation.z = 0);
        m.userData.legs.forEach(L => L.rotation.x = 0);
        m.rotation.y = d.yaw;
      });
      if (Math.random() < dt * 0.05 && dp < 30) sfx.quack(0.04);
    }
  }

  // ── 참새 ──
  spawnSparrows(px, pz) {
    let x, z;
    const roll = Math.random();
    if (roll < 0.5) { const a = Math.random() * 6.28, r = rand(10, 26); x = px + Math.cos(a) * r; z = pz + Math.sin(a) * r; }
    else if (roll < 0.75) { const a = Math.random() * 6.28, r = rand(4, 12); x = VILLAGE.x + Math.cos(a) * r; z = VILLAGE.z + Math.sin(a) * r; }
    else { const a = Math.random() * 6.28, r = rand(0, MEADOW.r - 4); x = MEADOW.x + Math.cos(a) * r; z = MEADOW.z + Math.sin(a) * r; }
    if (inPond(x, z, -3) || Math.hypot(x, z) > WORLD_R - 4) return;
    const n = Math.floor(rand(3, 7));
    const flock = ++this.flockId;
    for (let i = 0; i < n; i++) {
      const m = makeSparrow(); this.group.add(m);
      const gx = x + rand(-1.8, 1.8), gz = z + rand(-1.8, 1.8);
      const gy = height(gx, gz);
      m.position.set(gx + rand(-6, 6), gy + 14, gz + rand(-6, 6));
      this.sparrows.push({ m, flock, state: 'land', gx, gz, gy, yaw: rand(0, 6.28), timer: rand(0.5, 2), vel: new THREE.Vector3(), life: 0, hop: 0 });
    }
  }
  flyAway(s, px, pz) {
    const ax = s.m.position.x - px, az = s.m.position.z - pz, L = Math.hypot(ax, az) || 1;
    s.state = 'fly'; s.flyT = 0;
    s.vel.set(ax / L * rand(6, 9), rand(5, 8), az / L * rand(6, 9));
    s.yaw = Math.atan2(ax, az);
  }
  updateSparrows(dt, px, pz, player) {
    const night = this.ctx.isNight() || this.ctx.nightLevel() > 0.35;
    const rain = this.ctx.weather.raining;
    const t = this.t;
    const flocks = new Set(this.sparrows.filter(s => s.state !== 'fly').map(s => s.flock));
    if (!night && !rain && flocks.size < 3 && this.sparrows.length < 16) {
      this.sparrowTimer -= dt;
      if (this.sparrowTimer <= 0) { this.spawnSparrows(px, pz); this.sparrowTimer = rand(5, 13); }
    }
    const scaredFlocks = new Set();
    const win = rain ? this.ctx.house.anyOpen() : null;
    for (let i = this.sparrows.length - 1; i >= 0; i--) {
      const s = this.sparrows[i], m = s.m, W = m.userData.wings, H = m.userData.head;
      s.life += dt;
      const dp = Math.hypot(px - m.position.x, pz - m.position.z);
      if (night && s.state !== 'fly' && s.state !== 'toHouse') this.flyAway(s, px + rand(-3, 3), pz + rand(-3, 3));
      // 비가 오면 열린 창문으로 집에 들어가거나 나무 밑으로
      if (rain && (s.state === 'peck' || s.state === 'land') && !s.shelter) {
        const hp = this.ctx.house.doorPos;
        if (win && Math.hypot(hp.x - m.position.x, hp.z - m.position.z) < 30 && Math.random() < 0.5) {
          s.state = 'toHouse'; s.from = m.position.clone(); s.k = 0;
          s.to = this.ctx.house.windowWorld(win);
          s.dur = Math.max(1, s.from.distanceTo(s.to) / 8);
        } else {
          const tr = this.nearestTree(m.position.x, m.position.z, 25);
          s.shelter = true;
          if (tr) { const a = Math.random() * 6.28, rr = tr.r + 0.35 + Math.random() * 0.4; s.gx = tr.x + Math.cos(a) * rr; s.gz = tr.z + Math.sin(a) * rr; s.gy = height(s.gx, s.gz); s.state = 'land'; m.position.y = Math.max(m.position.y, s.gy + 3); }
        }
      }
      if (!rain) s.shelter = false;
      if (s.state === 'land') {
        const dx = s.gx - m.position.x, dy = s.gy - m.position.y, dz = s.gz - m.position.z;
        const L = Math.hypot(dx, dy, dz);
        if (L < 0.2) { s.state = 'peck'; m.position.set(s.gx, s.gy, s.gz); }
        else { const k = Math.min(1, 8 * dt / L); m.position.x += dx * k; m.position.y += dy * k; m.position.z += dz * k; s.yaw = Math.atan2(dx, dz); }
        W.forEach((w, k) => w.rotation.z = (k ? -1 : 1) * Math.sin(t * 30) * 0.9);
      } else if (s.state === 'peck') {
        W.forEach(w => w.rotation.z = 0);
        s.timer -= dt;
        if (s.timer <= 0) { s.timer = rand(0.4, 1.6); if (Math.random() < 0.5 && !s.shelter) { s.hop = 0.25; s.yaw += rand(-1.5, 1.5); } }
        if (s.hop > 0) {
          s.hop -= dt;
          m.position.x += Math.sin(s.yaw) * dt * 1.6; m.position.z += Math.cos(s.yaw) * dt * 1.6;
          m.position.y = height(m.position.x, m.position.z) + Math.sin((0.25 - s.hop) / 0.25 * Math.PI) * 0.12;
        } else m.position.y = height(m.position.x, m.position.z);
        H.rotation.x = (!s.shelter && Math.sin(t * 9 + i * 2) > 0.3) ? 0.9 : 0;
        if (dp < 4.5 && Math.abs(player.pos.y - m.position.y) < 6) scaredFlocks.add(s.flock);
        if (Math.random() < dt * 0.06 && dp < 30) sfx.tweet(0.03);
      } else if (s.state === 'toHouse') {
        s.k += dt / s.dur;
        const k = Math.min(1, s.k);
        m.position.lerpVectors(s.from, s.to, k); m.position.y += Math.sin(k * Math.PI) * 2;
        s.yaw = Math.atan2(s.to.x - s.from.x, s.to.z - s.from.z);
        W.forEach((w, k2) => w.rotation.z = (k2 ? -1 : 1) * Math.sin(t * 35) * 1);
        if (k >= 1) { s.state = 'gone'; this.ctx.onBirdEnter('sparrow', 'brown'); }
      } else if (s.state === 'fly') {
        m.position.addScaledVector(s.vel, dt);
        s.vel.y += dt * 2;
        W.forEach((w, k) => w.rotation.z = (k ? -1 : 1) * Math.sin(t * 35) * 1);
        s.flyT += dt;
        if (s.flyT > 3.5) s.state = 'gone';
      }
      if (dp > 75 && s.state !== 'toHouse') s.state = 'gone';
      if (s.state === 'gone') { this.group.remove(m); this.sparrows.splice(i, 1); continue; }
      m.rotation.y = s.yaw;
    }
    if (scaredFlocks.size) {
      sfx.tweet(0.08);
      for (const s of this.sparrows) if (scaredFlocks.has(s.flock) && s.state !== 'fly' && s.state !== 'toHouse') this.flyAway(s, px, pz);
    }
  }

  // ── 까치 ──
  flyMagpie(mp, tree, spot) {
    mp.from.copy(mp.m.position);
    mp.tree = tree;
    if (spot) mp.to.copy(spot); else this.perchSpot(tree, mp.to);
    mp.k = 0; mp.dur = Math.max(1.2, mp.from.distanceTo(mp.to) / 8.5); mp.state = 'fly';
  }
  updateMagpies(dt, px, pz) {
    const t = this.t;
    const night = this.ctx.isNight() || this.ctx.nightLevel() > 0.45;
    const rain = this.ctx.weather.raining;
    for (const mp of this.magpies) {
      const m = mp.m;
      m.visible = !night; // 밤에는 길가 새가 안 보임
      if (night) continue;
      const dpl = Math.hypot(px - m.position.x, pz - m.position.z);
      // 비 : 나무 밑 땅으로 숨음
      if (rain && mp.state === 'perch' && !mp.sheltered) {
        const tr = mp.tree || this.nearestTree(m.position.x, m.position.z, 30);
        const a = Math.random() * 6.28;
        const spot = new THREE.Vector3(tr.x + Math.cos(a) * (tr.r + 0.4), 0, tr.z + Math.sin(a) * (tr.r + 0.4));
        spot.y = height(spot.x, spot.z);
        this.flyMagpie(mp, tr, spot); mp.sheltered = true;
        continue;
      }
      if (!rain && mp.sheltered && mp.state === 'perch') { mp.sheltered = false; this.flyMagpie(mp, mp.tree); continue; }
      if (mp.state === 'perch') {
        mp.timer -= dt;
        poseMagpie(m, 'perch', t + mp.ph, mp.ph);
        if (mp.sheltered) continue;
        // 짝 : 혼자인 까치끼리 만나면 한 마리가 따라다님
        if (!mp.partner && mp.timer < 1 && Math.random() < dt * 0.5) {
          const other = this.magpies.find(o => o !== mp && !o.partner && o.state === 'perch' && !o.sheltered && o.m.position.distanceTo(m.position) < 35);
          if (other && Math.random() < 0.4) { mp.partner = other; other.partner = mp; mp.leader = true; other.leader = false; mp.paired = 0; other.paired = 0; }
        }
        if (mp.partner) mp.paired += dt;
        // 둥지 : 짝이 된 지 오래되면 나무에 둥지를 틀고 알을 낳음
        if (mp.leader && !mp.nest && mp.paired > 70 && this.nests.length < 2 && mp.tree && mp.tree.type !== 'pine' && !this.nests.some(n => n.tree === mp.tree)) this.buildNest(mp);
        if (mp.timer <= 0) {
          mp.timer = mp.nest ? rand(5, 10) : rand(6, 16);
          if (!mp.leader && mp.partner) continue; // 따라가는 까치는 리더를 따라감
          let next = null;
          if (mp.nest) {
            const near = this.world.trees.filter(tr => tr.type !== 'pine' && tr !== mp.tree && Math.hypot(tr.x - mp.nest.tree.x, tr.z - mp.nest.tree.z) < 14);
            next = Math.random() < 0.5 || !near.length ? mp.nest.tree : pick(near);
          } else {
            const cand = this.world.trees.filter(tr => { if (tr.type === 'pine') return false; const d = Math.hypot(tr.x - mp.tree.x, tr.z - mp.tree.z); return d > 10 && d < 38 && Math.hypot(tr.x, tr.z) < WORLD_R - 8; });
            next = Math.random() < 0.5 ? cand.sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz))[0] : pick(cand);
          }
          if (next) {
            const spot = (mp.nest && next === mp.nest.tree) ? mp.nest.perch.clone() : null;
            this.flyMagpie(mp, next, spot);
            if (dpl < 60) sfx.magpie(0.13 * Math.max(0.15, 1 - dpl / 60));
            const p = mp.partner;
            if (p) setTimeout(() => { if (p.state === 'perch' && !p.sheltered && this.magpies.includes(p)) this.flyMagpie(p, next, spot ? spot.clone().add(new THREE.Vector3(-0.7, 0, 0.3)) : this.perchSpot(next, new THREE.Vector3(), Math.random() * 6.28, 0.55)); }, 600);
          }
        }
      } else {
        mp.k += dt / mp.dur;
        const k = Math.min(1, mp.k);
        const prev = m.position.clone();
        m.position.lerpVectors(mp.from, mp.to, ease(k)); // 천천히 출발, 착지 때 속도 줄임
        m.position.y += Math.sin(k * Math.PI) * Math.min(4, mp.dur * 1.2);
        const dir = m.position.clone().sub(prev);
        if (dir.lengthSq() > 1e-7) m.rotation.y = angleLerp(m.rotation.y, Math.atan2(dir.x, dir.z), Math.min(1, dt * 10));
        poseMagpie(m, k > 0.82 ? 'flare' : 'fly', t);
        if (k >= 1) {
          mp.state = 'perch'; mp.timer = Math.max(mp.timer, rand(3, 8));
          if (dpl < 40 && Math.random() < 0.5) sfx.magpie(0.1 * Math.max(0.15, 1 - dpl / 40));
        }
      }
    }
    for (const n of this.nests) {
      n.group.visible = true;
      if (n.built < 1) { n.built = Math.min(1, n.built + dt / 25); n.group.scale.setScalar(0.3 + n.built * 0.7); if (n.built >= 1) n.layAt = this.t + rand(15, 30); }
      else if (n.eggs.length === 0 && this.t > n.layAt) {
        const cnt = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < cnt; i++) {
          const e = makeEgg(); e.position.set((i - (cnt - 1) / 2) * 0.17, 0.06, (i % 2) * 0.06);
          e.userData.wildEgg = n; n.group.add(e); n.eggs.push(e);
        }
        n.layAt = Infinity;
      }
    }
  }
  buildNest(mp) {
    const tr = mp.tree;
    const g = makeNestMesh();
    const pos = this.perchSpot(tr, new THREE.Vector3(), Math.random() * 6.28, 0.25);
    g.position.copy(pos).y += 0.05;
    g.scale.setScalar(0.3);
    this.group.add(g);
    const n = { tree: tr, group: g, eggs: [], built: 0, layAt: Infinity, color: breedColor(mp.color, mp.partner.color), perch: pos.clone().add(new THREE.Vector3(0.45, 0, 0)) };
    this.nests.push(n);
    mp.nest = n; mp.partner.nest = n;
    return n;
  }

  update(dt, player) {
    this.t += dt;
    const t = this.t, px = player.pos.x, pz = player.pos.z;
    for (const f of this.fish) {
      f.a += f.sp * dt / (f.r * 0.25 + 0.5);
      f.r += Math.sin(t * 0.3 + f.d * 10) * dt * 0.3;
      f.r = Math.max(1.5, Math.min(POND.r - 2.2, f.r));
      const x = POND.x + Math.cos(f.a) * f.r, z = POND.z + Math.sin(f.a) * f.r;
      let y = WATER_Y - f.d;
      if (f.jump < 0 && Math.random() < dt * 0.02) f.jump = 0;
      if (f.jump >= 0) { f.jump += dt; y = WATER_Y - 0.2 + Math.sin(f.jump * Math.PI / 0.9) * 1.1; if (f.jump > 0.9) { f.jump = -1; if (Math.hypot(px - x, pz - z) < 25) sfx.splash(); } }
      f.m.position.set(x, y, z);
      f.m.rotation.y = f.a + (f.sp > 0 ? 0 : Math.PI);
      f.m.rotation.x = f.jump >= 0 ? Math.cos(f.jump * Math.PI / 0.9) * -0.8 : 0;
      f.m.userData.tail.rotation.y = Math.sin(t * 8 + f.a) * 0.4;
    }
    this.updateDucks(dt, px, pz, player);
    this.updateSparrows(dt, px, pz, player);
    this.updateMagpies(dt, px, pz);
  }

  // ── 터치와 들기 ──
  tapTargets() {
    const out = [];
    for (const s of this.sparrows) if (s.state === 'peck') out.push(s.m);
    for (const mp of this.magpies) if (mp.m.visible && mp.state === 'perch') out.push(mp.m);
    for (const n of this.nests) out.push(...n.eggs);
    for (const f of this.families) if (f.state === 'swim') for (const d of f.ducks) out.push(d.m);
    return out;
  }
  isDuck(m) { return this.families.some(f => f.ducks.some(d => d.m === m)); }
  // 오리 안기 : 엄마든 아기든 누르면 가족 전체 (엄마는 품에, 아기들은 뒤따라옴)
  takeDuck(m) {
    const fi = this.families.findIndex(f => f.state === 'swim' && f.ducks.some(d => d.m === m));
    if (fi < 0) return null;
    const fam = this.families[fi];
    this.families.splice(fi, 1);
    fam.ducks.forEach(d => this.group.remove(d.m));
    return { mom: fam.ducks[0].m, babies: fam.ducks.slice(1).map(d => d.m) };
  }
  // 숲 연못에 오리 가족 풀어 주기
  releaseDucks(mom, babies, at) {
    const ox = at.x - POND.x, oz = at.z - POND.z, od = Math.hypot(ox, oz) || 1, r = POND.r - 2;
    const sx = POND.x + ox / od * r, sz = POND.z + oz / od * r;
    const fam = { ducks: [], state: 'swim', life: 0, maxLife: rand(600, 900), fleeCool: 3, target: null };
    [mom, ...babies].forEach((m, i) => {
      m.scale.setScalar(i ? 0.5 : 1); m.position.set(sx - ox / od * i * 0.5, WATER_Y, sz - oz / od * i * 0.5);
      this.group.add(m);
      fam.ducks.push({ m, baby: i > 0, yaw: Math.atan2(-ox, -oz), from: m.position.clone(), to: m.position.clone(), k: 1, dur: 1, landed: true });
    });
    this.families.push(fam);
    sfx.splash();
  }
  groundCircles() {
    const out = [];
    for (const mp of this.magpies) if (mp.sheltered && mp.state === 'perch' && mp.m.visible) out.push({ x: mp.m.position.x, z: mp.m.position.z, r: 0.25 });
    return out;
  }
  takeEgg(e) {
    const n = e.userData.wildEgg; if (!n) return null;
    n.group.remove(e); n.eggs = n.eggs.filter(x => x !== e);
    if (n.eggs.length === 0) n.layAt = this.t + rand(200, 320); // 다 가져가면 몇 분 뒤 또 낳음
    return { kind: 'magpie', color: n.color };
  }
  takeBird(m) {
    const si = this.sparrows.findIndex(s => s.m === m);
    if (si >= 0) { this.group.remove(m); this.sparrows.splice(si, 1); return { kind: 'sparrow', color: 'brown' }; }
    const mi = this.magpies.findIndex(x => x.m === m);
    if (mi >= 0) {
      const mp = this.magpies[mi];
      if (mp.partner) { mp.partner.partner = null; mp.partner.leader = false; }
      this.group.remove(m); this.magpies.splice(mi, 1);
      if (mp.mine) return { kind: 'magpie', color: mp.color, mine: mp.mine, name: mp.name };
      setTimeout(() => this.addMagpie(), 60000); // 숲의 까치 수 유지
      return { kind: 'magpie', color: mp.color };
    }
    return null;
  }
  addMagpie(color = 'black', at = null) {
    const m = makeMagpie(color); this.group.add(m);
    const trees = this.world.trees.filter(t => Math.hypot(t.x, t.z) < 75 && t.type !== 'pine');
    const mp = { m, tree: pick(trees), state: 'perch', timer: 1, from: new THREE.Vector3(), to: new THREE.Vector3(), k: 0, dur: 1, partner: null, leader: false, paired: 0, color, ph: Math.random() * 6 };
    if (at) m.position.copy(at); else m.position.set(mp.tree.x + 60, 30, mp.tree.z);
    this.flyMagpie(mp, mp.tree);
    this.magpies.push(mp);
    return mp;
  }
  // 열매로 까치 색 바꾸기 (검정 부분만 열매 색, 흰 무늬는 그대로)
  dye(m, color) {
    const mp = this.magpies.find(x => x.m === m); if (!mp) return false;
    const nm = makeMagpie(color);
    nm.position.copy(m.position); nm.rotation.copy(m.rotation);
    this.group.remove(m); this.group.add(nm);
    if (mp.label) nm.add(mp.label);
    mp.m = nm; mp.color = color;
    return true;
  }
  // 밖에서 내려놓은 새는 날아감
  release(kind, color, pos) {
    if (kind === 'magpie') return this.addMagpie(color, pos);
    const m = makeSparrow(); this.group.add(m); m.position.copy(pos);
    const s = { m, flock: ++this.flockId, state: 'fly', yaw: 0, vel: new THREE.Vector3(), life: 0, flyT: 0 };
    this.sparrows.push(s); this.flyAway(s, pos.x - 1, pos.z - 1);
  }
}
