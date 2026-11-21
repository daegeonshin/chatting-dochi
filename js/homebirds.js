import * as THREE from 'three';
import { makeMagpie, makeSparrow, makeEgg, poseMagpie } from './wildlife.js';
import { makeLabel, rand, pick, angleLerp } from './utils.js';
import { EGG_HATCH_MIN, MAGPIE_GROW_MIN, HOME_LAY_MIN, breedColor } from './data.js';
import { uid } from './save.js';
import { sfx } from './audio.js';

const MIN = 60000;

// 집 안의 새 : 내가 키우는 까치(알 → 아기 → 어른), 들어와서 갇힌 참새나 비 피한 손님
// S.birds : { uid, kind, color, name, stage, placedAt, bornAt, nest, away, awayAt, guest }
export class HomeBirds {
  constructor(house, S, ctx) {
    this.house = house; this.S = S; this.ctx = ctx; // ctx : { toast, onSave, inHouse(), raining() }
    this.views = new Map(); // uid → { root, model, label, state, ... }
    this.t = 0; this.checkT = 0;
  }
  list() { return this.S.birds; }
  mine() { return this.S.birds.filter(b => b.kind === 'magpie' && !b.guest); }

  addEgg(color, nestUid) {
    const b = { uid: uid(), kind: 'magpie', color, name: '', stage: 'egg', placedAt: Date.now(), nest: nestUid };
    this.S.birds.push(b); this.ctx.onSave(); return b;
  }
  addBird(kind, color, opts = {}) {
    const b = { uid: uid(), kind, color, name: opts.name || '', stage: 'adult', bornAt: Date.now() - MAGPIE_GROW_MIN * MIN, guest: !!opts.guest };
    this.S.birds.push(b); this.ctx.onSave(); return b;
  }
  remove(b) { this.S.birds = this.S.birds.filter(x => x !== b); this.drop(b); this.ctx.onSave(); }
  drop(b) { const v = this.views.get(b.uid); if (v) { this.house.scene.remove(v.root); this.views.delete(b.uid); } }

  // 나이에 따라 단계 바꾸기 (실제 시간 기준, 앱을 꺼도 흐름)
  grow() {
    const now = Date.now();
    const msgs = [];
    for (const b of this.S.birds) {
      if (b.stage === 'egg' && now - b.placedAt >= EGG_HATCH_MIN * MIN) {
        b.stage = 'baby'; b.bornAt = b.placedAt + EGG_HATCH_MIN * MIN; b.name = b.name || '아기 까치';
        this.drop(b); msgs.push('🐣 둥지의 알에서 아기 까치가 태어났어요! 꾹 눌러 이름을 지어 줘요');
      }
      if (b.stage === 'baby' && now - b.bornAt >= MAGPIE_GROW_MIN * MIN) {
        b.stage = 'adult'; if (b.name === '아기 까치') b.name = '까치';
        this.drop(b); msgs.push(`🐦 ${b.name}(이)가 어른 까치가 되어 날 수 있어요!`);
      }
    }
    if (msgs.length) { this.ctx.onSave(); if (this.ctx.inHouse()) msgs.forEach((m, i) => setTimeout(() => this.ctx.toast(m, 3500), i * 3600)); else this.pending = (this.pending || []).concat(msgs); }
  }
  // 집에 들어왔을 때 밀린 소식
  flushNews() { (this.pending || []).forEach((m, i) => setTimeout(() => this.ctx.toast(m, 3500), 800 + i * 3600)); this.pending = []; }

  buildView(b) {
    const root = new THREE.Group();
    let model;
    if (b.stage === 'egg') model = makeEgg();
    else if (b.kind === 'magpie') model = makeMagpie(b.color, b.stage === 'baby');
    else model = makeSparrow();
    root.add(model);
    const v = { root, model, b, state: 'idle', timer: rand(1, 3), from: new THREE.Vector3(), to: new THREE.Vector3(), k: 0, dur: 1, yaw: rand(0, 6), ph: Math.random() * 6 };
    if (b.name && b.stage !== 'egg') { v.label = makeLabel(b.name, '#ffffff', 'rgba(90,110,160,0.85)'); v.label.scale.multiplyScalar(0.6); v.label.position.y = 0.75; root.add(v.label); }
    root.userData.bird = b;
    this.house.scene.add(root);
    // 시작 자리
    if (b.stage === 'egg') this.placeEgg(v);
    else if (b.justIn) { root.position.copy(this.house.winSpot(b.justIn)).setY(1.6); delete b.justIn; }
    else { const s = this.house.randomSpot(); root.position.set(s.x, 0, s.z); }
    this.views.set(b.uid, v);
    return v;
  }
  placeEgg(v) {
    const nest = this.house.itemByUid(v.b.nest);
    if (!nest) { const s = this.house.randomSpot(); v.root.position.set(s.x, 0.1, s.z); return; }
    const eggsHere = this.S.birds.filter(x => x.stage === 'egg' && x.nest === v.b.nest);
    const i = eggsHere.indexOf(v.b);
    const p = this.house.spotOf(nest);
    v.root.position.set(p.x + (i - (eggsHere.length - 1) / 2) * 0.18, p.y + 0.08, p.z + (i % 2) * 0.06);
  }
  rename(b, name) { b.name = name; this.drop(b); this.ctx.onSave(); }
  dye(b, color) { b.color = color; this.drop(b); this.ctx.onSave(); }

  // 다 자란 작은 나무 + 어른 까치 두 마리 → 둥지를 틀고 알을 낳음
  breed() {
    const adults = this.S.birds.filter(b => b.kind === 'magpie' && !b.guest && b.stage === 'adult' && !b.away);
    if (adults.length < 2) return;
    const trees = this.house.items.filter(i => i.userData.kind === 'sapling' && i.userData.data.grown);
    const now = Date.now();
    for (const tr of trees) {
      const d = tr.userData.data;
      if (this.S.birds.some(b => b.stage === 'egg' && b.nest === d.uid)) continue;
      if (!d.nest) {
        d.nest = true; d.lastLay = now - (HOME_LAY_MIN - 1) * 60000; // 둥지를 틀고 1분 뒤 알
        this.house.rebuild(tr); this.ctx.onSave();
        this.say('🪺 까치들이 작은 나무에 둥지를 틀었어요!');
        return;
      }
      if (now - (d.lastLay || 0) < HOME_LAY_MIN * 60000) continue;
      d.lastLay = now;
      const a = adults[Math.floor(Math.random() * adults.length)];
      const others = adults.filter(x => x !== a);
      const b = others[Math.floor(Math.random() * others.length)];
      const cnt = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < cnt; i++) this.S.birds.push({ uid: uid(), kind: 'magpie', color: breedColor(a.color, b.color), name: '', stage: 'egg', placedAt: now, nest: d.uid, parents: [a.uid, b.uid] });
      this.ctx.onSave();
      const an = a.name || '까치', bn = b.name || '까치';
      const wa = (an.charCodeAt(an.length - 1) - 0xac00) % 28 ? '과' : '와';
      this.say(`🥚 ${an}${wa} ${bn}(이)가 알을 ${cnt}개 낳았어요! 10분 뒤에 태어나요`);
      return;
    }
  }
  say(msg) { if (this.ctx.inHouse()) this.ctx.toast(msg, 3500); else this.pending = (this.pending || []).concat([msg]); }

  tapTargets() { return [...this.views.values()].filter(v => v.state !== 'carried').map(v => v.root); }
  viewOfRoot(root) { return [...this.views.values()].find(v => v.root === root); }
  groundCircles() {
    const out = [];
    for (const v of this.views.values()) if (v.b.stage !== 'egg' && v.state !== 'carried' && v.root.position.y < 0.1) out.push({ x: v.root.position.x, z: v.root.position.z, r: v.b.kind === 'magpie' ? 0.28 : 0.18 });
    return out;
  }

  // 들기 : 이 새를 화면에서 떼어 냄 (main이 안고 다님)
  take(v) { v.state = 'carried'; return v; }
  putBack(v, pos) { v.state = 'idle'; v.timer = rand(1, 2); v.root.position.copy(pos); v.root.position.y = 0; }

  flyOut(v, key) {
    v.state = 'out'; v.k = 0; v.from.copy(v.root.position); v.to.copy(this.house.winSpot(key)).setY(1.7);
    v.dur = Math.max(0.8, v.from.distanceTo(v.to) / 4);
    v.outKey = key;
  }

  update(dt) {
    this.t += dt; this.checkT -= dt;
    const inHouse = this.ctx.inHouse();
    if (this.checkT <= 0) {
      this.checkT = 2;
      this.grow();
      this.breed();
      // 날아간 까치가 가끔 창가로 돌아옴 (창문이 열려 있으면 들어옴)
      for (const b of this.S.birds) {
        if (!b.away) continue;
        if (Date.now() - b.awayAt > 3 * MIN && Math.random() < 0.04) {
          const key = this.house.anyOpen();
          if (key || !inHouse) {
            b.away = false; b.justIn = key || 'b'; this.ctx.onSave();
            const msg = `🐦 ${b.name || '까치'}(이)가 창가로 돌아왔어요!`;
            if (inHouse) this.ctx.toast(msg, 3200); else this.pending = (this.pending || []).concat([msg]);
          }
        }
      }
    }
    // 보이게 만들기
    for (const b of this.S.birds) if (!b.away && !this.views.has(b.uid)) this.buildView(b);
    for (const [id, v] of this.views) if (!this.S.birds.includes(v.b) || v.b.away) { this.house.scene.remove(v.root); this.views.delete(id); }

    const perches = this.house.perchSpots();
    const openKey = this.house.anyOpen();          // 창문만 열림
    const openFull = this.house.anyOpen(true);     // 창문 + 커튼 열림
    for (const v of this.views.values()) {
      const b = v.b, m = v.model, R = v.root;
      if (b.stage === 'egg') { m.rotation.z = Math.sin(this.t * 3 + v.ph) * (Date.now() - b.placedAt > (EGG_HATCH_MIN - 1) * MIN ? 0.25 : 0.03); continue; }
      if (v.state === 'carried') { if (b.kind === 'magpie') poseMagpie(m, 'perch', this.t + v.ph); continue; }
      const canFly = b.stage === 'adult';
      // 손님 새(참새, 비 피한 까치)는 내가 집에 있을 때 창문이 열리면 날아감
      if ((b.kind === 'sparrow' || b.guest) && inHouse && openKey && v.state !== 'out' && !(b.guest && this.ctx.raining())) { this.flyOut(v, openKey); }
      // 내 까치 : 창문과 커튼이 다 열려 있으면 가끔 밖으로
      else if (b.kind === 'magpie' && !b.guest && canFly && openFull && v.state !== 'out' && Math.random() < dt / 40) { this.flyOut(v, openFull); }

      if (v.state === 'out') {
        v.k += dt / v.dur; const k = Math.min(1, v.k);
        R.position.lerpVectors(v.from, v.to, k); R.position.y += Math.sin(k * Math.PI) * 0.6;
        R.rotation.y = Math.atan2(v.to.x - v.from.x, v.to.z - v.from.z);
        this.flap(v, 'fly');
        if (k >= 1) {
          if (b.kind === 'sparrow' || b.guest) { if (inHouse) this.ctx.toast(b.kind === 'sparrow' ? '🐦 참새가 창문으로 날아갔어요' : '🐦 까치가 창문으로 날아갔어요'); this.remove(b); }
          else { b.away = true; b.awayAt = Date.now(); this.ctx.onSave(); if (inHouse) this.ctx.toast(`🐦 ${b.name || '까치'}(이)가 창밖으로 날아갔어요. 가끔 돌아와요`, 3200); }
        }
        continue;
      }
      if (v.state === 'idle') {
        v.timer -= dt;
        this.flap(v, 'perch');
        if (R.position.y > 0.05 && !canFly && b.kind === 'magpie') R.position.y = Math.max(0, R.position.y - dt * 2);
        if (v.timer <= 0) {
          v.timer = rand(2, 6);
          v.from.copy(R.position);
          if (canFly && Math.random() < 0.6 && perches.length) { v.to.copy(pick(perches)); v.state = 'fly'; }
          else { const s = this.house.randomSpot(); v.to.set(s.x, 0, s.z); v.state = canFly ? 'fly' : 'hop'; if (R.position.y > 0.05 && canFly) v.state = 'fly'; }
          v.k = 0; v.dur = Math.max(0.6, v.from.distanceTo(v.to) / (v.state === 'fly' ? 4 : 0.9));
          if (b.kind === 'sparrow' && Math.random() < 0.5) sfx.tweet(0.04);
          if (b.kind === 'magpie' && Math.random() < 0.15) sfx.magpie(0.06);
        }
      } else if (v.state === 'fly' || v.state === 'hop') {
        v.k += dt / v.dur; const k = Math.min(1, v.k);
        R.position.lerpVectors(v.from, v.to, k);
        if (v.state === 'fly') R.position.y += Math.sin(k * Math.PI) * 0.9;
        else R.position.y = Math.abs(Math.sin(k * Math.PI * Math.max(2, Math.round(v.dur * 3)))) * 0.08;
        const yaw = Math.atan2(v.to.x - v.from.x, v.to.z - v.from.z);
        R.rotation.y = angleLerp(R.rotation.y, yaw, Math.min(1, dt * 8));
        this.flap(v, v.state === 'fly' ? (k > 0.8 ? 'flare' : 'fly') : 'perch');
        if (k >= 1) { v.state = 'idle'; v.timer = rand(2, 6); }
      }
    }
  }
  flap(v, mode) {
    if (v.b.kind === 'magpie') { poseMagpie(v.model, mode, this.t + v.ph, v.ph); return; }
    const W = v.model.userData.wings;
    W.forEach((w, i) => w.rotation.z = mode === 'perch' ? 0 : (i ? -1 : 1) * Math.sin(this.t * 35) * 1);
  }
}
