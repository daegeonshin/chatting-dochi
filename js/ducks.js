import * as THREE from 'three';
import { makeDuck } from './wildlife.js';
import { angleLerp } from './utils.js';
import { uid } from './save.js';

// 집(비닐하우스) 연못에 사는 오리 가족
// S.ducks : { uid, babies, pond(연못 가구 uid) }
export class HomeDucks {
  constructor(house, S) {
    this.house = house; this.S = S;
    if (!S.ducks) S.ducks = [];
    this.views = new Map(); // uid → { fam, ducks: [{ m, a, yaw }] }
    this.t = 0;
  }
  pondOf(fam) { return this.house.itemByUid(fam.pond) || null; }
  ponds() { return this.house.items.filter(i => i.userData.kind === 'pond'); }
  nearestPond(pos, maxD = 3.5) {
    let best = null, bd = maxD;
    for (const p of this.ponds()) { const d = Math.hypot(p.position.x - pos.x, p.position.z - pos.z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  // 연못에 풀어 주기 (안고 온 오리 모델을 그대로 씀)
  add(pond, mom, babies) {
    const fam = { uid: uid(), babies: babies.length, pond: pond.userData.data.uid };
    this.S.ducks.push(fam);
    this.build(fam, mom, babies);
    return fam;
  }
  build(fam, mom = null, babies = null) {
    const list = [mom || makeDuck(false), ...(babies || Array.from({ length: fam.babies }, () => makeDuck(true)))];
    const ducks = list.map((m, i) => { m.scale.setScalar(i ? 0.5 : 1); this.house.scene.add(m); m.traverse(o => { o.userData.homeDuck = fam.uid; }); return { m, a: -i * 0.5, yaw: 0 }; });
    this.views.set(fam.uid, { fam, ducks });
  }
  take(famUid) {
    const v = this.views.get(famUid); if (!v) return null;
    this.views.delete(famUid);
    this.S.ducks = this.S.ducks.filter(f => f.uid !== famUid);
    v.ducks.forEach(d => { this.house.scene.remove(d.m); d.m.traverse(o => { delete o.userData.homeDuck; }); });
    return { mom: v.ducks[0].m, babies: v.ducks.slice(1).map(d => d.m) };
  }
  tapTargets() { return [...this.views.values()].flatMap(v => v.ducks.map(d => d.m)); }
  famOfMesh(m) { for (const [id, v] of this.views) if (v.ducks.some(d => d.m === m)) return id; return null; }
  update(dt) {
    this.t += dt;
    for (const f of this.S.ducks) if (!this.views.has(f.uid)) this.build(f);
    for (const [id, v] of this.views) {
      const pond = this.pondOf(v.fam);
      if (!pond) { // 연못을 치우면 오리도 상자로 (다시 놓으면 돌아옴)
        v.ducks.forEach(d => d.m.visible = false); continue;
      }
      const y = (pond.userData.water || 0.23) - 0.08;
      v.ducks.forEach((d, i) => {
        d.m.visible = true;
        if (i === 0) d.a += dt * 0.35;
        const a = v.ducks[0].a - i * 0.45, r = i === 0 ? 0.85 : 0.85 - Math.min(0.3, i * 0.04);
        const x = pond.position.x + Math.cos(a) * r, z = pond.position.z + Math.sin(a) * r;
        const yaw = Math.atan2(-Math.sin(a), Math.cos(a));
        d.yaw = angleLerp(d.yaw, yaw, Math.min(1, dt * 5));
        d.m.position.set(x, y + Math.sin(this.t * 2.4 + i) * 0.015, z);
        d.m.rotation.y = d.yaw;
        d.m.userData.wings.forEach(w => w.rotation.z = 0);
      });
    }
  }
}
