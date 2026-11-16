import * as THREE from 'three';
import { mesh, rand, pick, angleLerp, blobShadow } from './utils.js';
import { POND, WATER_Y, WORLD_R, VILLAGE, MEADOW, height, inPond } from './world.js';
import { sfx } from './audio.js';

const S = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
function eye2(g, y, z, x, r = 0.025) { for (const s of [-1, 1]) { const e = mesh(S(r, 6, 5), 0x1a1214); e.position.set(x * s, y, z); g.add(e); } }

function makeFish(color) {
  const g = new THREE.Group();
  const body = mesh(S(0.22, 12, 8), color); body.scale.set(0.55, 0.8, 1.3); g.add(body);
  const tail = mesh(new THREE.ConeGeometry(0.16, 0.22, 4), color); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.35; tail.scale.x = 0.3; g.add(tail);
  eye2(g, 0.05, 0.2, 0.08, 0.03);
  g.userData.tail = tail;
  return g;
}
function makeDuck(baby) {
  const g = new THREE.Group();
  const bodyC = baby ? 0xffe14d : 0xfaf8f0;
  const body = mesh(S(0.3, 14, 10), bodyC); body.scale.set(0.85, 0.7, 1.15); body.position.y = 0.28; g.add(body);
  const head = mesh(S(0.18, 12, 10), baby ? 0xffe14d : 0x3a9a5a); head.position.set(0, 0.6, 0.25); g.add(head);
  if (!baby) { const ring = mesh(new THREE.TorusGeometry(0.12, 0.025, 4, 12), 0xffffff); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.45, 0.22); g.add(ring); }
  const beak = mesh(S(0.08, 8, 6), 0xff9a3a); beak.scale.set(1, 0.4, 1.4); beak.position.set(0, 0.57, 0.43); g.add(beak);
  eye2(g, 0.65, 0.38, 0.1);
  const tail = mesh(new THREE.ConeGeometry(0.1, 0.2, 4), bodyC); tail.rotation.x = -2.2; tail.position.set(0, 0.38, -0.33); g.add(tail);
  const legs = [-1, 1].map(s => { const L = new THREE.Group(); L.position.set(0.1 * s, 0.12, 0); const l = mesh(new THREE.BoxGeometry(0.04, 0.14, 0.04), 0xff9a3a); l.position.y = -0.06; const f = mesh(new THREE.BoxGeometry(0.12, 0.02, 0.14), 0xff9a3a); f.position.set(0, -0.12, 0.04); L.add(l, f); g.add(L); return L; });
  g.userData.legs = legs; g.userData.head = head;
  if (baby) g.scale.setScalar(0.55);
  return g;
}
function makeSparrow() {
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
  return g;
}
function makeMagpie() {
  const g = new THREE.Group();
  const body = mesh(S(0.17, 12, 10), 0x1a1a24); body.scale.set(0.85, 0.85, 1.4); g.add(body);
  const belly = mesh(S(0.13, 10, 8), 0xffffff); belly.position.set(0, -0.05, 0.02); belly.scale.set(1, 0.8, 1.2); g.add(belly);
  const head = mesh(S(0.11, 10, 8), 0x1a1a24); head.position.set(0, 0.1, 0.24); g.add(head);
  const beak = mesh(new THREE.ConeGeometry(0.03, 0.1, 4), 0x2a2a2a); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.09, 0.37); g.add(beak);
  const tail = mesh(new THREE.BoxGeometry(0.09, 0.02, 0.55), 0x23305a); tail.position.set(0, 0.02, -0.45); g.add(tail);
  const wings = [-1, 1].map(s => {
    const w = new THREE.Group(); w.position.set(0.12 * s, 0.05, 0);
    const wm = mesh(new THREE.BoxGeometry(0.42, 0.02, 0.26), 0x1a1a24); wm.position.x = 0.21 * s; w.add(wm);
    const patch = mesh(new THREE.BoxGeometry(0.15, 0.025, 0.12), 0xffffff); patch.position.set(0.22 * s, 0, 0.02); w.add(patch);
    g.add(w); return w;
  });
  g.userData.wings = wings;
  g.scale.setScalar(1.3);
  return g;
}

export class Wildlife {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    this.group = new THREE.Group(); scene.add(this.group);
    this.t = 0;
    // 물고기 (항상 연못에)
    this.fish = [];
    for (let i = 0; i < 8; i++) {
      const f = makeFish(pick([0xff8a3a, 0xffd84d, 0xff6b6b, 0xffffff]));
      this.group.add(f);
      this.fish.push({ m: f, a: Math.random() * 6.28, r: rand(2, POND.r - 2.5), sp: rand(0.25, 0.5) * (Math.random() < 0.5 ? -1 : 1), d: rand(0.25, 0.6), jump: -1 });
    }
    // 오리
    this.ducks = []; this.duckTimer = rand(8, 20);
    // 참새
    this.sparrows = []; this.sparrowTimer = 2;
    // 까치
    this.magpies = [];
    for (let i = 0; i < 3; i++) {
      const m = makeMagpie(); this.group.add(m);
      const tr = pick(world.trees.filter(t => Math.hypot(t.x, t.z) < 70));
      const mp = { m, tree: tr, state: 'perch', timer: rand(4, 15), from: new THREE.Vector3(), to: new THREE.Vector3(), k: 0, dur: 1 };
      this.perchPos(tr, m.position);
      this.magpies.push(mp);
    }
  }
  perchPos(tr, out) { return out.set(tr.x + 0.3, tr.y + tr.h * 0.92, tr.z + 0.3); }

  // 가장 먼 곳 찾기
  farthestFrom(x, z) {
    let best = null, bd = -1;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * (WORLD_R - 10);
      const px = Math.cos(a) * r, pz = Math.sin(a) * r;
      if (inPond(px, pz, -1)) continue;
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d > bd) { bd = d; best = { x: px, z: pz }; }
    }
    return best;
  }

  spawnDucks() {
    const n = Math.random() < 0.5 ? 1 : Math.floor(rand(2, 5));
    const a = Math.random() * 6.28, r = rand(2, POND.r - 4);
    for (let i = 0; i < n; i++) {
      const m = makeDuck(i > 0); this.group.add(m);
      m.position.set(POND.x + Math.cos(a) * r - i * 0.8, WATER_Y - 0.05, POND.z + Math.sin(a) * r - i * 0.5);
      this.ducks.push({ m, state: 'swim', yaw: rand(0, 6.28), target: null, lead: i === 0, idx: i, life: 0 });
    }
  }

  spawnSparrows() {
    let x, z;
    const roll = Math.random();
    if (roll < 0.6) { const a = Math.random() * 6.28, r = rand(4, 10); x = VILLAGE.x + Math.cos(a) * r; z = VILLAGE.z + Math.sin(a) * r; }
    else if (roll < 0.85) { const a = Math.random() * 6.28, r = rand(0, MEADOW.r - 4); x = MEADOW.x + Math.cos(a) * r; z = MEADOW.z + Math.sin(a) * r; }
    else { const a = Math.random() * 6.28, r = rand(30, 90); x = Math.cos(a) * r; z = Math.sin(a) * r; if (inPond(x, z, -3)) return; }
    const n = Math.floor(rand(3, 7));
    for (let i = 0; i < n; i++) {
      const m = makeSparrow(); this.group.add(m);
      const px = x + rand(-1.6, 1.6), pz = z + rand(-1.6, 1.6);
      const gy = height(px, pz);
      m.position.set(px + rand(-6, 6), gy + 14, pz + rand(-6, 6));
      this.sparrows.push({ m, state: 'land', gx: px, gz: pz, gy, yaw: rand(0, 6.28), timer: rand(0.5, 2), vel: new THREE.Vector3(), life: 0 });
    }
  }

  update(dt, player) {
    this.t += dt;
    const t = this.t, px = player.pos.x, pz = player.pos.z;

    // 물고기
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

    // 오리 : 가끔 연못에 나타나고, 다가가면 가장 먼 곳으로 도망
    if (this.ducks.length === 0) { this.duckTimer -= dt; if (this.duckTimer <= 0) { this.spawnDucks(); this.duckTimer = rand(40, 100); } }
    const lead = this.ducks.find(d => d.lead);
    for (let i = this.ducks.length - 1; i >= 0; i--) {
      const d = this.ducks[i], m = d.m;
      d.life += dt;
      const dp = Math.hypot(px - m.position.x, pz - m.position.z);
      if (d.state === 'swim') {
        if (dp < 7 && !player.flying) {
          const far = (lead && lead !== d && lead.flee) ? lead.flee : this.farthestFrom(px, pz);
          d.flee = far; d.state = 'flee'; sfx.quack(0.12);
          this.ducks.forEach(o => { if (o.state === 'swim') { o.state = 'flee'; o.flee = far; } });
        } else {
          if (!d.target || Math.random() < dt * 0.1) { const a = Math.random() * 6.28, r = rand(1, POND.r - 3); d.target = { x: POND.x + Math.cos(a) * r, z: POND.z + Math.sin(a) * r }; }
          if (!d.lead && lead) d.target = { x: lead.m.position.x - Math.sin(lead.yaw) * 0.8 * d.idx, z: lead.m.position.z - Math.cos(lead.yaw) * 0.8 * d.idx };
          const dx = d.target.x - m.position.x, dz = d.target.z - m.position.z;
          if (Math.hypot(dx, dz) > 0.3) { d.yaw = angleLerp(d.yaw, Math.atan2(dx, dz), dt * 1.5); m.position.x += Math.sin(d.yaw) * 0.8 * dt; m.position.z += Math.cos(d.yaw) * 0.8 * dt; }
          m.position.y = WATER_Y - 0.12 + Math.sin(t * 2 + i) * 0.02;
          if (Math.random() < dt * 0.05 && dp < 30) sfx.quack(0.04);
        }
      } else if (d.state === 'flee') {
        const tx = d.flee.x + d.idx * 0.7, tz = d.flee.z + d.idx * 0.5;
        const dx = tx - m.position.x, dz = tz - m.position.z, dd = Math.hypot(dx, dz);
        d.yaw = angleLerp(d.yaw, Math.atan2(dx, dz), dt * 6);
        m.position.x += Math.sin(d.yaw) * 6.5 * dt; m.position.z += Math.cos(d.yaw) * 6.5 * dt;
        this.world.collide(m.position, 0.3, true);
        const onWater = inPond(m.position.x, m.position.z, 0.8);
        const gy = Math.max(height(m.position.x, m.position.z), onWater ? WATER_Y - 0.12 : -99);
        m.position.y = gy + (onWater ? 0 : Math.abs(Math.sin(t * 16 + i)) * 0.08);
        m.userData.legs.forEach((L, k) => L.rotation.x = onWater ? 0 : Math.sin(t * 18 + k * Math.PI) * 0.7);
        m.rotation.z = onWater ? 0 : Math.sin(t * 16 + i) * 0.12;
        if (Math.random() < dt * 0.8) sfx.quack(0.05);
        d.fleeT = (d.fleeT || 0) + dt;
        if (dd < 2 || d.fleeT > 35) d.state = 'gone';
      }
      if (d.state === 'gone') { this.group.remove(m); this.ducks.splice(i, 1); }
      else m.rotation.y = d.yaw;
    }

    // 참새 : 바닥에서 콕콕, 다가가면 날아서 사라지고 다른 곳에 다시
    if (this.sparrows.length === 0) { this.sparrowTimer -= dt; if (this.sparrowTimer <= 0) { this.spawnSparrows(); this.sparrowTimer = rand(15, 35); } }
    let scared = false;
    for (let i = this.sparrows.length - 1; i >= 0; i--) {
      const s = this.sparrows[i], m = s.m, W = m.userData.wings, H = m.userData.head;
      s.life += dt;
      if (s.state === 'land') {
        const dx = s.gx - m.position.x, dy = s.gy - m.position.y, dz = s.gz - m.position.z;
        const L = Math.hypot(dx, dy, dz);
        if (L < 0.2) { s.state = 'peck'; m.position.set(s.gx, s.gy, s.gz); }
        else { const k = Math.min(1, 8 * dt / L); m.position.x += dx * k; m.position.y += dy * k; m.position.z += dz * k; s.yaw = Math.atan2(dx, dz); }
        W.forEach((w, k) => w.rotation.z = (k ? -1 : 1) * Math.sin(t * 30) * 0.9);
      } else if (s.state === 'peck') {
        W.forEach(w => w.rotation.z = 0);
        s.timer -= dt;
        if (s.timer <= 0) {
          s.timer = rand(0.4, 1.6);
          if (Math.random() < 0.5) { s.hop = 0.25; s.yaw += rand(-1.5, 1.5); }
        }
        if (s.hop > 0) {
          s.hop -= dt;
          m.position.x += Math.sin(s.yaw) * dt * 1.6; m.position.z += Math.cos(s.yaw) * dt * 1.6;
          m.position.y = height(m.position.x, m.position.z) + Math.sin((0.25 - s.hop) / 0.25 * Math.PI) * 0.12;
        } else m.position.y = height(m.position.x, m.position.z);
        H.rotation.x = (Math.sin(t * 9 + i * 2) > 0.3) ? 0.9 : 0; // 콕콕
        const dp = Math.hypot(px - m.position.x, pz - m.position.z);
        if (dp < 5 && Math.abs(player.pos.y - m.position.y) < 6) scared = true;
        if (Math.random() < dt * 0.06 && dp < 30) sfx.tweet(0.03);
      } else if (s.state === 'fly') {
        m.position.addScaledVector(s.vel, dt);
        s.vel.y += dt * 2;
        W.forEach((w, k) => w.rotation.z = (k ? -1 : 1) * Math.sin(t * 35) * 1);
        s.flyT += dt;
        if (s.flyT > 3.5) s.state = 'gone';
      }
      if (s.state === 'gone') { this.group.remove(m); this.sparrows.splice(i, 1); continue; }
      m.rotation.y = s.yaw;
    }
    if (scared) {
      sfx.tweet(0.08);
      for (const s of this.sparrows) {
        if (s.state === 'fly') continue;
        const ax = s.m.position.x - px, az = s.m.position.z - pz, L = Math.hypot(ax, az) || 1;
        s.state = 'fly'; s.flyT = 0;
        s.vel.set(ax / L * rand(6, 9), rand(5, 8), az / L * rand(6, 9));
        s.yaw = Math.atan2(ax, az);
      }
    }

    // 까치 : 나무에서 나무로, 깍깍
    for (const mp of this.magpies) {
      const m = mp.m, W = m.userData.wings;
      if (mp.state === 'perch') {
        mp.timer -= dt;
        W.forEach((w, k) => w.rotation.z = 0);
        m.rotation.x = 0;
        if (mp.timer <= 0) {
          const cand = this.world.trees.filter(tr => { const d = Math.hypot(tr.x - mp.tree.x, tr.z - mp.tree.z); return d > 14 && d < 40 && Math.hypot(tr.x, tr.z) < WORLD_R - 6; });
          // 가끔은 플레이어 근처 나무로 와서 보이게
          let next = null;
          if (Math.random() < 0.5) next = cand.sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz))[0];
          else next = pick(cand);
          if (next) {
            mp.from.copy(m.position); this.perchPos(next, mp.to); mp.tree = next;
            mp.k = 0; mp.dur = mp.from.distanceTo(mp.to) / 9; mp.state = 'fly';
            const dpl = Math.hypot(px - m.position.x, pz - m.position.z);
            if (dpl < 60) sfx.magpie(0.13 * Math.max(0.15, 1 - dpl / 60));
          }
          mp.timer = rand(7, 18);
        }
      } else {
        mp.k += dt / mp.dur;
        const k = Math.min(1, mp.k);
        const prev = m.position.clone();
        m.position.lerpVectors(mp.from, mp.to, k);
        m.position.y += Math.sin(k * Math.PI) * 4;
        const dir = m.position.clone().sub(prev);
        if (dir.lengthSq() > 1e-6) m.rotation.y = Math.atan2(dir.x, dir.z);
        W.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * Math.sin(t * 18) * 0.8);
        if (k >= 1) {
          mp.state = 'perch';
          const dpl = Math.hypot(px - m.position.x, pz - m.position.z);
          if (dpl < 40 && Math.random() < 0.6) sfx.magpie(0.1 * Math.max(0.15, 1 - dpl / 40));
        }
      }
    }
  }
}
