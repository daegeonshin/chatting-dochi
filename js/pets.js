import * as THREE from 'three';
import { mesh, mat, blobShadow, makeLabel, emojiSprite, rand, angleLerp, clamp } from './utils.js';
import { PETS } from './data.js';
import { MEADOW, height, inMeadow } from './world.js';
import { sfx } from './audio.js';

const S = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const HOUR = 3600 * 1000;
const darker = (c, k = 0.75) => new THREE.Color(c).multiplyScalar(k).getHex();

function eyes(head, y, z, sx, r = 0.055) {
  for (const s of [-1, 1]) {
    const e = mesh(S(r, 10, 8), 0x1a1214); e.scale.set(0.9, 1.15, 0.6); e.position.set(sx * s, y, z); head.add(e);
    const h = mesh(S(r * 0.38, 6, 5), 0xffffff, { emissive: 0xffffff }); h.position.set(sx * s + r * 0.3, y + r * 0.4, z + r * 0.45); head.add(h);
  }
}
function legs4(g, c, y, sx, sz, r = 0.065, len = 0.2) {
  const list = [];
  for (const [x, z] of [[-sx, sz], [sx, sz], [-sx, -sz], [sx, -sz]]) {
    const L = new THREE.Group(); L.position.set(x, y, z);
    const l = mesh(new THREE.CylinderGeometry(r, r * 0.9, len, 8), c); l.position.y = -len / 2;
    const paw = mesh(S(r * 1.15, 8, 6), c); paw.position.y = -len; paw.scale.y = 0.7;
    L.add(l, paw); g.add(L); list.push(L);
  }
  return list;
}

// 반려동물 모델 (앞쪽이 +z, 발이 원점)
export function makePetModel(type, colorId) {
  const def = PETS.find(p => p.id === type);
  const c = (def.colors.find(k => k[0] === colorId) || def.colors[0])[2];
  const g = new THREE.Group();
  const parts = { legs: [], tail: null, wings: [], head: null, ears: [] };
  const head = new THREE.Group(); parts.head = head; g.add(head);

  if (type === 'dog') {
    const accent = colorId === 'black' ? 0x5a4a44 : 0xf0d2a8;
    const body = mesh(S(0.3), c); body.scale.set(0.95, 0.8, 1.25); body.position.y = 0.36; g.add(body);
    head.position.set(0, 0.66, 0.3);
    head.add(mesh(S(0.26, 18, 14), c));
    const snout = mesh(S(0.13), colorId === 'black' ? 0x6a5a54 : 0xffffff); snout.scale.set(1.1, 0.8, 1); snout.position.set(0, -0.07, 0.2); head.add(snout);
    const nose = mesh(S(0.05, 8, 6), 0x1a1214); nose.position.set(0, -0.03, 0.32); head.add(nose);
    eyes(head, 0.05, 0.21, 0.1);
    for (const s of [-1, 1]) { const ear = mesh(S(0.12), accent); ear.scale.set(0.55, 1.2, 0.8); ear.position.set(0.22 * s, -0.02, -0.02); ear.rotation.z = 0.3 * s; head.add(ear); parts.ears.push(ear); }
    const tongue = mesh(S(0.04, 8, 6), 0xff7a9a); tongue.scale.set(1, 0.4, 1.2); tongue.position.set(0, -0.15, 0.27); head.add(tongue);
    parts.legs = legs4(g, c, 0.24, 0.15, 0.2);
    const tail = new THREE.Group(); tail.position.set(0, 0.48, -0.36);
    const tm = mesh(new THREE.CapsuleGeometry(0.05, 0.18, 4, 6), c); tm.position.y = 0.1; tm.rotation.x = -0.5; tail.add(tm);
    g.add(tail); parts.tail = tail;
    const collar = mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 16), 0xff6b9a); collar.position.set(0, 0.52, 0.25); collar.rotation.x = 1.2; g.add(collar);
  } else if (type === 'cat') {
    const body = mesh(S(0.28), c); body.scale.set(0.85, 0.8, 1.25); body.position.y = 0.34; g.add(body);
    head.position.set(0, 0.64, 0.27);
    head.add(mesh(S(0.25, 18, 14), c));
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.09, 0.17, 4), c); ear.position.set(0.14 * s, 0.22, -0.02); ear.rotation.z = -0.25 * s; head.add(ear); parts.ears.push(ear);
      const inner = mesh(new THREE.ConeGeometry(0.05, 0.1, 4), 0xffb3c8); inner.position.set(0.14 * s, 0.21, 0.03); inner.rotation.z = -0.25 * s; head.add(inner);
      for (const k of [-1, 1]) { const w = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 3), 0x6a5a5a); w.rotation.z = Math.PI / 2 + k * 0.15; w.position.set(0.17 * s, -0.06 + k * 0.02, 0.2); head.add(w); }
    }
    eyes(head, 0.04, 0.21, 0.1, 0.06);
    const nose = mesh(S(0.03, 6, 5), 0xff8aa8); nose.position.set(0, -0.04, 0.25); head.add(nose);
    if (colorId === 'yellow') for (let i = 0; i < 3; i++) { const st = mesh(new THREE.TorusGeometry(0.2, 0.025, 4, 12, Math.PI), darker(c, 0.8)); st.position.set(0, 0.42, -0.1 + i * 0.12); st.rotation.y = Math.PI / 2; g.add(st); }
    parts.legs = legs4(g, c, 0.22, 0.13, 0.19, 0.055);
    const tail = new THREE.Group(); tail.position.set(0, 0.4, -0.34);
    for (let i = 0; i < 6; i++) { const b = mesh(S(0.05, 8, 6), c); b.position.set(0, i * 0.08, -Math.sin(i * 0.5) * 0.12); tail.add(b); }
    g.add(tail); parts.tail = tail;
  } else if (type === 'chick') {
    const body = mesh(S(0.24, 18, 14), c); body.position.y = 0.28; body.scale.set(1, 0.95, 1.05); g.add(body);
    head.position.set(0, 0.52, 0.06);
    head.add(mesh(S(0.17, 16, 12), c));
    const beak = mesh(new THREE.ConeGeometry(0.05, 0.1, 6), 0xff9a3a); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.02, 0.18); head.add(beak);
    eyes(head, 0.04, 0.14, 0.075, 0.035);
    const tuft = mesh(S(0.05, 6, 5), c); tuft.position.set(0, 0.18, 0); tuft.scale.set(0.6, 1.4, 0.6); head.add(tuft);
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(0.22 * s, 0.3, 0);
      const wm = mesh(S(0.1), darker(c, 0.93)); wm.scale.set(0.35, 0.8, 1); wm.position.y = -0.04; w.add(wm); g.add(w); parts.wings.push(w);
      const L = new THREE.Group(); L.position.set(0.08 * s, 0.08, 0);
      const l = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 4), 0xff9a3a); l.position.y = -0.04; L.add(l);
      const f = mesh(S(0.04, 6, 4), 0xff9a3a); f.scale.set(1, 0.4, 1.4); f.position.set(0, -0.08, 0.02); L.add(f);
      g.add(L); parts.legs.push(L);
    }
  } else if (type === 'rabbit') {
    const body = mesh(S(0.27, 18, 14), c); body.scale.set(0.95, 0.85, 1.1); body.position.y = 0.3; g.add(body);
    head.position.set(0, 0.58, 0.22);
    head.add(mesh(S(0.23, 18, 14), c));
    for (const s of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(0.09 * s, 0.17, -0.02);
      const e = mesh(new THREE.CapsuleGeometry(0.06, 0.28, 4, 8), c); e.position.y = 0.17; ear.add(e);
      const inner = mesh(new THREE.CapsuleGeometry(0.03, 0.22, 4, 6), 0xffb3c8); inner.position.set(0, 0.17, 0.035); ear.add(inner);
      ear.rotation.z = -0.15 * s; head.add(ear); parts.ears.push(ear);
    }
    eyes(head, 0.04, 0.19, 0.1, 0.05);
    const nose = mesh(S(0.025, 6, 5), 0xff8aa8); nose.position.set(0, -0.04, 0.23); head.add(nose);
    parts.legs = legs4(g, c, 0.16, 0.13, 0.15, 0.06, 0.12);
    const tail = mesh(S(0.08, 10, 8), 0xffffff); tail.position.set(0, 0.3, -0.3); g.add(tail); parts.tail = tail;
  } else if (type === 'parrot') {
    let bodyC = c, wingC = darker(c, 0.85), headC = c, tailC = darker(c, 0.8);
    if (colorId === 'rainbow') { bodyC = 0xe8433f; headC = 0xe8433f; wingC = 0x3a6bd5; tailC = 0xffd84d; }
    if (colorId === 'green') { headC = 0x7fd96a; }
    if (colorId === 'white') { wingC = 0xeeeeee; tailC = 0xe0e0e0; }
    const body = mesh(S(0.18, 16, 12), bodyC); body.scale.set(0.9, 1.25, 1); body.position.y = 0.32; body.rotation.x = 0.25; g.add(body);
    head.position.set(0, 0.6, 0.06);
    head.add(mesh(S(0.15, 16, 12), headC));
    if (colorId === 'white') { const crest = mesh(new THREE.ConeGeometry(0.05, 0.2, 6), 0xffe14d); crest.position.set(0, 0.17, -0.05); crest.rotation.x = -0.6; head.add(crest); }
    const beak = mesh(new THREE.ConeGeometry(0.055, 0.12, 8), colorId === 'rainbow' ? 0x2a2a2a : 0xf2c94c); beak.rotation.x = 2.2; beak.position.set(0, -0.03, 0.15); head.add(beak);
    eyes(head, 0.03, 0.11, 0.085, 0.035);
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(0.15 * s, 0.4, 0);
      const wm = mesh(S(0.12), wingC); wm.scale.set(0.3, 1.1, 0.8); wm.position.set(0.02 * s, -0.08, -0.03); w.add(wm);
      if (colorId === 'rainbow') { const tip = mesh(S(0.07, 8, 6), 0xffd84d); tip.scale.set(0.3, 1, 0.8); tip.position.set(0.03 * s, -0.17, -0.05); w.add(tip); }
      g.add(w); parts.wings.push(w);
      const L = new THREE.Group(); L.position.set(0.06 * s, 0.12, 0.02);
      const l = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 4), 0x8a8a8a); l.position.y = -0.06; L.add(l);
      g.add(L); parts.legs.push(L);
    }
    const tail = new THREE.Group(); tail.position.set(0, 0.2, -0.12);
    const tm = mesh(new THREE.BoxGeometry(0.1, 0.03, 0.34), tailC); tm.position.set(0, -0.05, -0.15); tm.rotation.x = -0.5; tail.add(tm);
    g.add(tail); parts.tail = tail;
  } else if (type === 'redpanda') {
    const dark = 0x5a2a1a;
    const body = mesh(S(0.28), c); body.scale.set(0.95, 0.8, 1.2); body.position.y = 0.34; g.add(body);
    head.position.set(0, 0.62, 0.28);
    head.add(mesh(S(0.25, 18, 14), c));
    const muzzle = mesh(S(0.12), 0xffffff); muzzle.scale.set(1.2, 0.8, 0.9); muzzle.position.set(0, -0.07, 0.17); head.add(muzzle);
    const nose = mesh(S(0.04, 8, 6), 0x1a1214); nose.position.set(0, -0.03, 0.28); head.add(nose);
    for (const s of [-1, 1]) {
      const brow = mesh(S(0.05, 8, 6), 0xffffff); brow.scale.set(1.3, 0.8, 0.5); brow.position.set(0.1 * s, 0.12, 0.2); head.add(brow);
      const tear = mesh(S(0.05, 8, 6), darker(c, 0.6)); tear.scale.set(0.6, 1.3, 0.5); tear.position.set(0.13 * s, -0.05, 0.18); head.add(tear);
      const ear = mesh(S(0.08, 10, 8), c); ear.scale.set(1, 1, 0.5); ear.position.set(0.17 * s, 0.18, -0.02); head.add(ear); parts.ears.push(ear);
      const rim = mesh(new THREE.TorusGeometry(0.07, 0.015, 4, 12), 0xffffff); rim.position.set(0.17 * s, 0.18, 0.02); head.add(rim);
    }
    eyes(head, 0.04, 0.2, 0.1, 0.05);
    parts.legs = legs4(g, dark, 0.22, 0.15, 0.19, 0.06);
    const tail = new THREE.Group(); tail.position.set(0, 0.36, -0.32);
    for (let i = 0; i < 7; i++) { const b = mesh(S(0.11 - i * 0.004, 10, 8), i % 2 ? darker(c, 0.7) : c); b.position.set(0, i * 0.035, -i * 0.08); tail.add(b); }
    g.add(tail); parts.tail = tail;
  } else if (type === 'sloth') {
    const face = 0xe8d6b8;
    const body = mesh(S(0.3), c); body.scale.set(1, 0.95, 1.05); body.position.y = 0.36; g.add(body);
    head.position.set(0, 0.68, 0.18);
    head.add(mesh(S(0.24, 18, 14), c));
    const mask = mesh(S(0.19, 16, 12), face); mask.scale.set(1.15, 0.85, 0.6); mask.position.set(0, -0.01, 0.12); head.add(mask);
    for (const s of [-1, 1]) { const patch = mesh(S(0.06, 8, 6), 0x5a4030); patch.scale.set(1.6, 0.8, 0.5); patch.position.set(0.09 * s, 0.01, 0.2); patch.rotation.z = -0.4 * s; head.add(patch); }
    eyes(head, 0.02, 0.23, 0.09, 0.035);
    const nose = mesh(S(0.035, 8, 6), 0x3a2a20); nose.position.set(0, -0.05, 0.24); head.add(nose);
    const smile = mesh(new THREE.TorusGeometry(0.04, 0.008, 4, 10, Math.PI), 0x3a2a20); smile.rotation.z = Math.PI; smile.position.set(0, -0.08, 0.23); head.add(smile);
    // 긴 팔과 발톱
    for (const s of [-1, 1]) for (const z of [0.12, -0.12]) {
      const L = new THREE.Group(); L.position.set(0.24 * s, 0.4, z);
      const arm = mesh(new THREE.CapsuleGeometry(0.06, 0.26, 4, 6), c); arm.position.y = -0.15; L.add(arm);
      for (let k = -1; k <= 1; k++) { const cl = mesh(new THREE.ConeGeometry(0.012, 0.06, 4), 0xf4f0e0); cl.position.set(k * 0.025, -0.33, 0.02); cl.rotation.x = Math.PI; L.add(cl); }
      L.rotation.z = 0.3 * s; g.add(L); parts.legs.push(L);
    }
  }
  const shadow = blobShadow(0.38); shadow.position.y = 0.02; g.add(shadow);
  parts.shadow = shadow;
  g.userData.parts = parts;
  return g;
}

export class Pet {
  constructor(data, ctx) {
    this.data = data; // 저장되는 정보
    this.ctx = ctx;   // { world, player, floaters, onSave }
    this.def = PETS.find(p => p.id === data.type);
    this.root = new THREE.Group();
    this.model = makePetModel(data.type, data.color);
    this.root.add(this.model);
    this.parts = this.model.userData.parts;
    this.label = null; this.setName(data.name || this.def.name);
    this.pos = this.root.position;
    this.yaw = 0; this.speed = 0; this.t = Math.random() * 10;
    this.mode = 'home'; // home | walk
    this.sub = 'idle';  // idle | wander | follow | eat | run | climbGo | climb | perch | fly
    this.target = null; this.timer = 0; this.happy = 0;
    this.icon = null; this.iconTimer = 0;
    this.scene = null;
  }

  setName(name) {
    this.data.name = name;
    if (this.label) this.root.remove(this.label);
    this.label = makeLabel(name, '#ffffff', 'rgba(110,150,220,0.85)');
    this.label.position.y = this.def.id === 'rabbit' ? 1.25 : 1.1;
    this.label.scale.multiplyScalar(0.75);
    this.root.add(this.label);
  }
  setScene(scene) { if (this.scene) this.scene.remove(this.root); this.scene = scene; scene.add(this.root); }

  // 실제 시간 기준 상태
  get hoursSinceFed() { return (Date.now() - this.data.lastFed) / HOUR; }
  get hoursSincePet() { return (Date.now() - this.data.lastPetted) / HOUR; }
  get hungry() { return this.hoursSinceFed > 3; }
  get sick() { return !!this.data.sick; }
  checkHealth() {
    const d = this.data;
    if (!d.sick && (this.hoursSinceFed > 30 || this.hoursSincePet > 30)) { d.sick = true; this.ctx.onSave(); }
    if (d.sick && this.hoursSinceFed < 1 && this.hoursSincePet < 1) {
      d.sick = false; this.ctx.onSave();
      this.ctx.floaters.add('✨', this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0.7);
      this.ctx.toast(`${d.name}(이)가 다 나았어요!`);
    }
  }

  // 쓰다듬기
  pat() {
    this.data.lastPetted = Date.now();
    this.happy = 1.2;
    sfx.happy();
    if (this.def.id === 'dog') sfx.bark(); else if (this.def.id === 'cat') sfx.meow();
    for (let i = 0; i < 3; i++) setTimeout(() => this.ctx.floaters.add('💗', this.pos.clone().add(new THREE.Vector3(rand(-0.3, 0.3), 0.9, rand(-0.3, 0.3))), 0.45), i * 150);
    this.checkHealth();
    this.ctx.onSave();
  }

  showIcon(emo, sec = 2.5) {
    if (this.icon) this.root.remove(this.icon);
    this.icon = emojiSprite(emo, 0.5);
    this.icon.position.y = 1.5;
    this.root.add(this.icon);
    this.iconTimer = sec;
  }

  moveTo(tx, tz, spd, dt, env) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.15) { this.speed *= 0.8; return true; }
    const s = Math.min(spd, d * 4);
    this.speed += (s - this.speed) * Math.min(1, dt * 6);
    this.yaw = angleLerp(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8));
    this.pos.x += Math.sin(this.yaw) * this.speed * dt;
    this.pos.z += Math.cos(this.yaw) * this.speed * dt;
    if (env) env.collide(this.pos, 0.3);
    return false;
  }

  // 산책 특수 버튼
  special() {
    const sp = this.def.special;
    const { player, world } = this.ctx;
    if (sp === 'fly') {
      if (this.sub === 'fly') return null;
      // 플레이어와 가까운 지점부터 숲을 한 바퀴
      const a0 = Math.atan2(player.pos.z, player.pos.x);
      this.path = [];
      for (let i = 0; i <= 28; i++) {
        const a = a0 + (i / 28) * Math.PI * 2, R = 82;
        const x = Math.cos(a) * R, z = Math.sin(a) * R;
        this.path.push(new THREE.Vector3(x, height(x, z) + 15 + Math.sin(i * 0.9) * 3, z));
      }
      this.pathI = 0; this.sub = 'fly'; this.flyT = 0;
      sfx.tweet(0.1);
      return `${this.data.name}(이)가 숲 한 바퀴 날아가요!`;
    }
    if (sp === 'run') {
      if (this.sub === 'run') { this.sub = 'follow'; return `${this.data.name}, 이리 와!`; }
      this.sub = 'run'; this.target = null;
      return `${this.data.name}(이)가 들판으로 뛰어가요!`;
    }
    if (sp === 'climb') {
      if (this.sub === 'climb' || this.sub === 'climbGo') { this.sub = 'follow'; this.climbing = 0; return `${this.data.name}, 내려와!`; }
      const tr = world.nearestTree(player.pos.x, player.pos.z, 30);
      if (!tr) return '근처에 나무가 없어요';
      this.tree = tr; this.sub = 'climbGo'; this.climbing = 0;
      return `${this.data.name}(이)가 나무에 올라가요!`;
    }
  }
  specialLabel() {
    const sp = this.def.special;
    if (sp === 'fly') return this.sub === 'fly' ? '🦜 나는 중' : '🦜 날아라';
    if (sp === 'run') return this.sub === 'run' ? '📣 이리 와' : '🏃 뛰어놀기';
    return (this.sub === 'climb' || this.sub === 'climbGo') ? '📣 내려와' : '🌳 나무 타기';
  }

  startWalk() {
    this.mode = 'walk';
    this.sub = this.def.special === 'fly' ? 'perch' : 'follow';
    this.climbing = 0;
  }
  goHome() { this.ctx.player.avatar.perch = false; this.mode = 'home'; this.sub = 'idle'; this.climbing = 0; this.model.rotation.set(0, 0, 0); this.model.position.set(0, 0, 0); }

  update(dt, env, home) {
    this.t += dt;
    this.happy = Math.max(0, this.happy - dt);
    if (this.iconTimer > 0) { this.iconTimer -= dt; if (this.iconTimer <= 0 && this.icon) { this.root.remove(this.icon); this.icon = null; } }
    const { player } = this.ctx;
    let air = 0;
    const sick = this.sick;
    const isBird = this.def.id === 'parrot';
    const slow = this.def.id === 'sloth' ? 0.45 : 1;

    if (this.mode === 'home') {
      // 집 안 : 돌아다니다 배고프면 밥그릇으로
      if (home.bowlFull && this.hungry && this.sub !== 'eat') { this.sub = 'toBowl'; }
      if (this.sub === 'toBowl') {
        if (this.moveTo(home.bowl.x, home.bowl.z - 0.85, 2.2 * slow, dt, env)) { this.sub = 'eat'; this.timer = 3; this.yaw = 0; sfx.eat(); }
      } else if (this.sub === 'eat') {
        this.timer -= dt;
        this.parts.head.rotation.x = 0.4 + Math.sin(this.t * 14) * 0.15;
        if (this.timer <= 0) { home.eat(); this.data.lastFed = Date.now(); this.sub = 'idle'; this.parts.head.rotation.x = 0; this.showIcon('😋'); this.checkHealth(); this.ctx.onSave(); }
      } else {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = sick ? rand(6, 10) : rand(2, 5);
          if (!sick && Math.random() < 0.65) { const p = home.randomSpot(); this.target = p; this.sub = 'wander'; }
          else { this.sub = 'idle'; this.target = null; }
          if (sick) this.showIcon('🤒', 3);
          else if (this.hungry && Math.random() < 0.5) this.showIcon('🍽️');
          else if (this.hoursSincePet > 12 && Math.random() < 0.4) this.showIcon('🥺');
        }
        if (this.sub === 'wander' && this.target && this.moveTo(this.target.x, this.target.z, 1.6 * slow, dt, env)) this.sub = 'idle';
        else if (this.sub === 'idle') this.speed *= 0.85;
      }
      this.pos.y = 0;
    } else {
      // 산책 중
      const pp = player.pos;
      const dPlayer = Math.hypot(pp.x - this.pos.x, pp.z - this.pos.z);
      if (this.sub === 'perch') {
        const a = player.avatar.perchAnchor.getWorldPosition(new THREE.Vector3());
        this.pos.copy(a); this.pos.y += 0.02;
        this.yaw = player.yaw; this.speed = 0;
        player.avatar.perch = true;
      } else {
        player.avatar.perch = false;
      }
      if (this.sub === 'follow') {
        const behind = 1.6;
        const tx = pp.x - Math.sin(player.yaw) * behind + Math.cos(player.yaw) * 0.9;
        const tz = pp.z - Math.cos(player.yaw) * behind - Math.sin(player.yaw) * 0.9;
        if (dPlayer > 35) { this.pos.set(tx, height(tx, tz), tz); }
        const fast = player.riding ? 1.6 : 1;
        if (Math.hypot(tx - this.pos.x, tz - this.pos.z) > 0.8) this.moveTo(tx, tz, (dPlayer > 4 ? 8 : 5) * fast * slow, dt, env);
        else this.speed *= 0.8;
        this.pos.y = height(this.pos.x, this.pos.z);
        if (isBird && dPlayer < 1.5 && !player.riding) this.sub = 'perch';
      } else if (this.sub === 'run') {
        if (!this.target || this.moveTo(this.target.x, this.target.z, inMeadow(this.pos.x, this.pos.z) ? 6 : 8, dt, env)) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (MEADOW.r - 3);
          this.target = { x: MEADOW.x + Math.cos(a) * r, z: MEADOW.z + Math.sin(a) * r };
          if (inMeadow(this.pos.x, this.pos.z) && Math.random() < 0.3) this.showIcon(['🎵', '💕', '✨'][Math.floor(Math.random() * 3)], 1.5);
        }
        this.pos.y = height(this.pos.x, this.pos.z);
        if (this.def.id === 'rabbit' || this.def.id === 'chick') air = Math.abs(Math.sin(this.t * 9)) * 0.25;
      } else if (this.sub === 'climbGo') {
        const tr = this.tree;
        const ang = Math.atan2(this.pos.x - tr.x, this.pos.z - tr.z);
        const sx = tr.x + Math.sin(ang) * (tr.r + 0.35), sz = tr.z + Math.cos(ang) * (tr.r + 0.35);
        this.climbAng = ang;
        if (this.climbing > 0 || this.moveTo(sx, sz, 4 * slow, dt)) {
          this.climbing = Math.min(1, (this.climbing || 0) + dt * 0.35 * slow);
          this.pos.x = sx; this.pos.z = sz;
          this.pos.y = tr.y + this.climbing * tr.trunkY;
          this.yaw = ang + Math.PI;
          if (this.climbing >= 1) this.sub = 'climb';
        } else this.pos.y = height(this.pos.x, this.pos.z);
      } else if (this.sub === 'climb') {
        // 나무에 꼭 매달려 그대로 있음
        this.speed = 0;
        this.pos.y = this.tree.y + this.tree.trunkY + Math.sin(this.t * 1.2) * 0.02;
      } else if (this.sub === 'fly') {
        const flyTarget = this.pathI < this.path.length ? this.path[this.pathI]
          : player.avatar.perchAnchor.getWorldPosition(new THREE.Vector3());
        const d = flyTarget.clone().sub(this.pos);
        const L = d.length();
        const spd = 19;
        if (L < 2.5 && this.pathI < this.path.length) this.pathI++;
        else if (this.pathI >= this.path.length && L < 0.6) { this.sub = 'perch'; sfx.tweet(0.1); this.ctx.toast(`${this.data.name}(이)가 돌아왔어요!`); }
        else {
          d.normalize();
          this.pos.addScaledVector(d, Math.min(L, spd * dt));
          this.yaw = angleLerp(this.yaw, Math.atan2(d.x, d.z), Math.min(1, dt * 5));
          this.model.rotation.z = clamp(-d.y * 0.4, -0.4, 0.4);
        }
        this.speed = 0;
        air = 1;
        if (Math.random() < dt * 0.4) sfx.tweet(0.04);
      }
      if (this.sub !== 'fly') this.model.rotation.z = 0;
    }

    // 모양 움직임
    this.root.rotation.y = this.yaw;
    const P = this.parts;
    const spdN = clamp(this.speed / 4, 0, 1.5);
    const w = this.t * (6 + spdN * 8);
    const climbingNow = this.sub === 'climb' || (this.sub === 'climbGo' && this.climbing > 0);
    P.legs.forEach((L, i) => {
      if (climbingNow) L.rotation.x = -1.2 + Math.sin(this.t * 4 + i) * (this.sub === 'climb' ? 0.05 : 0.4);
      else L.rotation.x = Math.sin(w + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6 * spdN;
    });
    if (climbingNow) { this.model.rotation.x = -1.2; this.model.position.set(0, 0, 0.2); }
    else if (sick && this.mode === 'home' && this.speed < 0.3) { this.model.rotation.x = 0; this.model.position.y = -0.08; }
    else { this.model.rotation.x = 0; this.model.position.set(0, air + (this.happy > 0 ? Math.abs(Math.sin(this.happy * 9)) * 0.3 : Math.abs(Math.sin(w)) * 0.04 * spdN), 0); }
    if (P.tail) P.tail.rotation.y = Math.sin(this.t * (this.happy > 0 ? 18 : 4)) * (this.happy > 0 ? 0.7 : 0.25);
    const flap = this.sub === 'fly' ? Math.sin(this.t * 22) * 1.1 : (this.happy > 0 ? Math.sin(this.t * 20) * 0.6 : 0);
    P.wings.forEach((wg, i) => wg.rotation.z = (i ? -1 : 1) * (flap > 0 ? flap : flap * 0.3) * (i ? 1 : 1));
    P.head.rotation.y = this.sub === 'eat' ? 0 : Math.sin(this.t * 0.7) * 0.25;
    if (this.sub !== 'eat') P.head.rotation.x = sick ? 0.3 : 0;
    P.shadow.visible = this.sub !== 'fly' && this.sub !== 'perch' && !climbingNow;
    const s = this.sub === 'fly' ? 1.4 : 1;
    this.model.scale.setScalar(s);
    this.label.visible = this.sub !== 'fly';
  }
}
