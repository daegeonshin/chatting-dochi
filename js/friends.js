import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { makePetModel } from './pets.js';
import { makeVehicle, animateVehicle } from './vehicles.js';
import { PETS, VEHICLES, HAIR_STYLES, HAIR_COLORS, EYE_COLORS, COLORS7 } from './data.js';
import { makeLabel, angleLerp, clamp } from './utils.js';
import { height } from './world.js';
import { cleanName, cleanChat } from './chatfilter.js';

const STALE = 20000; // 20초 동안 소식이 없으면 안 보이게
const has = (list, id) => list.some(c => c.id === id);
// 서버에서 온 꾸미기 값은 목록에 있는 것만 씀
function safeLook(l = {}) {
  return {
    hair: has(HAIR_STYLES, l.hair) ? l.hair : 'twin', hairColor: has(HAIR_COLORS, l.hairColor) ? l.hairColor : 'brown',
    eye: has(EYE_COLORS, l.eye) ? l.eye : 'darkbrown', cloth: has(COLORS7, l.cloth) ? l.cloth : 'lilac',
    houseColor: has(COLORS7, l.houseColor) ? l.houseColor : 'sky',
  };
}
const num = (v, a = -300, b = 300) => (typeof v === 'number' && isFinite(v)) ? clamp(v, a, b) : 0;

// 내 위치를 보내는 모양 (짧게)
export function packMe(G, walkers) {
  const p = G.player;
  const r2 = v => Math.round(v * 100) / 100;
  const pets = walkers.slice(0, 4).map(w => [w.data.type, w.data.color, r2(w.pos.x), r2(w.pos.y), r2(w.pos.z), r2(w.yaw || 0)].join(',')).join(';');
  return { m: G.mode === 'house' ? 'house' : 'forest', x: r2(p.pos.x), y: r2(p.pos.y), z: r2(p.pos.z), a: r2(p.yaw), r: p.riding || '', s: G.sleeping ? 1 : 0, pt: pets };
}

class Friend {
  constructor(uid, member, scene) {
    this.uid = uid; this.scene = scene;
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.target = new THREE.Vector3(); this.yaw = 0; this.goalYaw = 0;
    this.pets = []; this.vehicle = null; this.ride = '';
    this.bubble = null; this.bubbleT = 0;
    this.visible = false; this.root.visible = false;
    this.setMember(member);
    scene.add(this.root);
  }
  setMember(m) {
    const key = JSON.stringify([m.name, m.look]);
    if (key === this.key) return;
    this.key = key;
    this.name = cleanName(m.name);
    const look = safeLook(m.look);
    if (this.avatar) this.body.remove(this.avatar.root);
    this.avatar = new Avatar(look);
    this.body.add(this.avatar.root);
    if (this.label) this.root.remove(this.label);
    this.label = makeLabel(this.name, '#ffffff', 'rgba(90,150,110,0.9)');
    this.label.position.y = 2.15; this.label.scale.multiplyScalar(0.85);
    this.root.add(this.label);
    if (this.ride) { const r = this.ride; this.ride = ''; this.setRide(r); }
  }
  setRide(id) {
    if (!VEHICLES.some(v => v.id === id)) id = '';
    if (id === this.ride) return;
    this.ride = id;
    if (this.vehicle) { this.body.remove(this.vehicle); this.vehicle = null; }
    this.avatar.root.position.set(0, 0, 0);
    this.avatar.pose = 'stand';
    if (id) {
      this.vehicle = makeVehicle(id); this.body.add(this.vehicle);
      this.avatar.root.position.set(0, this.vehicle.userData.seatY, this.vehicle.userData.seatZ);
      this.avatar.pose = id === 'skate' ? 'skate' : id === 'plane' ? 'plane' : 'sit';
    }
  }
  setPets(str) {
    const list = String(str || '').split(';').filter(Boolean).slice(0, 4).map(s => s.split(','));
    const want = list.map(a => a[0] + ':' + a[1]).join('|');
    if (want !== this.petKey) {
      this.petKey = want;
      this.pets.forEach(p => this.scene.remove(p.m));
      this.pets = list.filter(a => PETS.some(d => d.id === a[0])).map(a => {
        const m = makePetModel(a[0], a[1]); this.scene.add(m);
        return { m, target: new THREE.Vector3(), yaw: 0, goal: 0, first: true };
      });
    }
    this.pets.forEach((p, i) => {
      const a = list[i]; if (!a) return;
      p.target.set(num(+a[2]), num(+a[3], -20, 80), num(+a[4])); p.goal = num(+a[5], -50, 50);
      if (p.first) { p.m.position.copy(p.target); p.first = false; }
    });
  }
  setPos(st) {
    const k = JSON.stringify(st || null);
    if (k !== this.stKey) { this.stKey = k; this.rx = Date.now(); } // 폰 시계가 달라도 되게, 받은 시각으로 판단
    this.st = st;
    this.visible = !!(st && st.m === 'forest');
    if (!this.visible) return;
    const wasHidden = !this.root.visible;
    this.target.set(num(st.x), num(st.y, -20, 80), num(st.z));
    this.goalYaw = num(st.a, -50, 50);
    if (wasHidden) { this.root.position.copy(this.target); this.yaw = this.goalYaw; }
    this.setRide(st.r || '');
    this.setPets(st.pt);
  }
  isOnline() { return !!this.st && Date.now() - this.rx < STALE; }
  say(text) {
    if (this.bubble) this.root.remove(this.bubble);
    this.bubble = makeLabel('💬 ' + text, '#5a4050', 'rgba(255,255,255,0.95)');
    this.bubble.position.y = 2.75; this.bubble.scale.multiplyScalar(0.8);
    this.root.add(this.bubble);
    this.bubbleT = 6;
  }
  update(dt) {
    const show = this.visible && this.isOnline();
    this.root.visible = show;
    this.pets.forEach(p => p.m.visible = show);
    if (!show) return;
    const before = this.root.position.clone();
    this.root.position.lerp(this.target, 1 - Math.exp(-dt * 9));
    if (this.root.position.distanceTo(this.target) > 12) this.root.position.copy(this.target);
    this.yaw = angleLerp(this.yaw, this.goalYaw, 1 - Math.exp(-dt * 10));
    this.body.rotation.y = this.yaw;
    const sp = before.distanceTo(this.root.position) / Math.max(dt, 1e-3);
    const ground = height(this.root.position.x, this.root.position.z);
    const air = !this.ride && this.root.position.y > ground + 0.25;
    this.avatar.update(dt, clamp(sp / 5, 0, 1.4), air);
    if (this.vehicle) animateVehicle(this.vehicle, this.ride, sp, dt);
    this.pets.forEach(p => {
      const b = p.m.position.clone();
      p.m.position.lerp(p.target, 1 - Math.exp(-dt * 8));
      if (p.m.position.distanceTo(p.target) > 12) p.m.position.copy(p.target);
      p.yaw = angleLerp(p.yaw, p.goal, 1 - Math.exp(-dt * 8)); p.m.rotation.y = p.yaw;
      const moving = b.distanceTo(p.m.position) > dt * 0.3;
      const legs = p.m.userData.parts && p.m.userData.parts.legs;
      if (legs) legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(performance.now() / 90 + i * Math.PI) * 0.6 : 0);
    });
    if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0 && this.bubble) { this.root.remove(this.bubble); this.bubble = null; } }
  }
  dispose() { this.scene.remove(this.root); this.pets.forEach(p => this.scene.remove(p.m)); }
}

// 같은 방 친구들 (숲에 보이는 모습과 친구 집)
export class Friends {
  constructor(scene, world, myUid) {
    this.scene = scene; this.world = world; this.myUid = myUid;
    this.list = new Map(); // uid → Friend
    this.houseKeys = {};   // slot → 집 모양 키
  }
  setMembers(members) {
    const seen = new Set();
    for (const [uid, m] of Object.entries(members || {})) {
      if (uid === this.myUid || !m || typeof m !== 'object') continue;
      seen.add(uid);
      let f = this.list.get(uid);
      if (!f) { f = new Friend(uid, m, this.scene); this.list.set(uid, f); } else f.setMember(m);
      f.slot = m.slot;
    }
    for (const [uid, f] of this.list) if (!seen.has(uid)) { f.dispose(); this.list.delete(uid); }
    // 친구 집
    const slots = {};
    for (const [uid, m] of Object.entries(members || {})) {
      if (uid === this.myUid || !m || typeof m.slot !== 'number') continue;
      slots[m.slot] = { color: safeLook(m.look).houseColor, name: (typeof m.house === 'string' && cleanChat(m.house).slice(0, 10)) || cleanName(m.name) + '네 집', uid };
    }
    for (const s of Object.keys(this.houseKeys)) if (!slots[s]) { this.world.removeFriendHouse(+s); delete this.houseKeys[s]; }
    for (const [s, h] of Object.entries(slots)) {
      const key = h.color + '|' + h.name;
      if (this.houseKeys[s] === key) continue;
      this.world.setFriendHouse(+s, h.color, h.name);
      this.houseKeys[s] = key;
    }
  }
  setPos(pos) { for (const [uid, f] of this.list) f.setPos(pos && pos[uid]); }
  say(uid, text) { const f = this.list.get(uid); if (f) f.say(text); }
  online() { return [...this.list.values()].filter(f => f.isOnline()); }
  update(dt, night) {
    for (const f of this.list.values()) f.update(dt);
    for (const h of Object.values(this.world.friendHouses)) if (h.winMat) h.winMat.emissive.setHex(night > 0.4 ? 0xffc86a : 0x000000);
  }
  clear() { for (const f of this.list.values()) f.dispose(); this.list.clear(); for (const s of Object.keys(this.houseKeys)) this.world.removeFriendHouse(+s); this.houseKeys = {}; }
}
