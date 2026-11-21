import * as THREE from 'three';
import { toon, outline, castAll } from './look.js';
import { mat, mesh, blobShadow } from './utils.js';
import { HAIR_COLORS, EYE_COLORS, COLORS7 } from './data.js';

const SKIN = 0xffe1cf;
const S = (r, w = 18, h = 14) => new THREE.SphereGeometry(r, w, h);
const hex = (list, id) => (list.find(c => c.id === id) || list[0]).hex;

// 꾸민 내 캐릭터 (발바닥이 원점)
export class Avatar {
  constructor(profile) {
    this.root = new THREE.Group();
    this.model = new THREE.Group();
    this.root.add(this.model);
    this.shadow = blobShadow(0.55);
    this.shadow.position.y = 0.03;
    this.root.add(this.shadow);
    this.t = 0;
    this.pose = 'stand'; // stand | sit | skate | sleep | plane
    this.perch = false;
    this.build(profile);
  }

  build(p) {
    this.model.clear();
    const cloth = hex(COLORS7, p.cloth);
    const hairC = hex(HAIR_COLORS, p.hairColor);
    const eyeC = hex(EYE_COLORS, p.eye);
    const clothDark = new THREE.Color(cloth).multiplyScalar(0.8).getHex();
    const m = this.model;

    // 다리
    this.legs = [-1, 1].map(s => {
      const g = new THREE.Group(); g.position.set(0.12 * s, 0.42, 0);
      const leg = mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.36, 10), SKIN); leg.position.y = -0.2;
      const shoe = mesh(S(0.11), 0xd9668f); shoe.scale.set(1, 0.7, 1.35); shoe.position.set(0, -0.37, 0.03);
      g.add(leg, shoe); m.add(g); return g;
    });
    // 원피스
    const dress = mesh(new THREE.CylinderGeometry(0.22, 0.37, 0.52, 18), cloth);
    dress.position.y = 0.62; m.add(dress);
    const hem = mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 24), clothDark);
    hem.rotation.x = Math.PI / 2; hem.position.y = 0.37; m.add(hem);
    const collar = mesh(new THREE.TorusGeometry(0.17, 0.045, 8, 20), 0xffffff);
    collar.rotation.x = Math.PI / 2; collar.position.y = 0.88; m.add(collar);
    const btn = mesh(S(0.035, 8, 6), 0xffffff); btn.position.set(0, 0.74, 0.28); m.add(btn);
    // 팔
    this.arms = [-1, 1].map(s => {
      const g = new THREE.Group(); g.position.set(0.26 * s, 0.84, 0);
      const sleeve = mesh(S(0.1), cloth); sleeve.position.y = -0.03;
      const arm = mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.32, 8), SKIN); arm.position.y = -0.2;
      const hand = mesh(S(0.08, 10, 8), SKIN); hand.position.y = -0.38;
      g.add(sleeve, arm, hand); g.rotation.z = 0.25 * s; m.add(g); return g;
    });
    // 앵무새가 앉는 자리 (왼팔)
    this.perchAnchor = new THREE.Object3D();
    this.perchAnchor.position.set(0, -0.3, 0);
    this.arms[0].add(this.perchAnchor);

    // 머리
    const head = new THREE.Group(); head.position.y = 1.3; this.head = head; m.add(head);
    head.add(mesh(S(0.5, 28, 22), SKIN));
    // 눈
    for (const s of [-1, 1]) {
      const eye = mesh(S(0.1, 14, 12), eyeC); eye.scale.set(0.85, 1.25, 0.5); eye.position.set(0.17 * s, 0.0, 0.455);
      const pupil = mesh(S(0.05, 10, 8), 0x1a1214); pupil.scale.set(1, 1.2, 0.5); pupil.position.set(0.17 * s, -0.01, 0.49);
      const hi = mesh(S(0.028, 8, 6), 0xffffff, { emissive: 0xffffff }); hi.position.set(0.17 * s + 0.03, 0.05, 0.5);
      const lash = mesh(new THREE.TorusGeometry(0.085, 0.012, 4, 10, Math.PI), 0x3a2a2a);
      lash.position.set(0.17 * s, 0.03, 0.47); lash.scale.set(1, 1.3, 1);
      for (const e of [eye, pupil, hi]) { e.userData.eye = true; e.userData.sy = e.scale.y; }
      head.add(eye, pupil, hi, lash);
      const cheek = mesh(S(0.08, 10, 8), 0xffa3b8); cheek.scale.set(1.3, 0.75, 0.4); cheek.position.set(0.3 * s, -0.12, 0.385);
      cheek.userData.noOutline = true; lash.userData.noOutline = true;
      head.add(cheek);
    }
    const smile = mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI), 0xb0405a);
    smile.userData.noOutline = true; smile.rotation.z = Math.PI; smile.position.set(0, -0.13, 0.485); head.add(smile);

    // 머리카락
    this.hairBits = [];
    if (p.hair !== 'bald') {
      const cap = mesh(new THREE.SphereGeometry(0.535, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.56), hairC);
      cap.rotation.x = -0.5; head.add(cap);
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.32;
        const bang = mesh(S(0.12, 10, 8), hairC);
        bang.scale.set(1.1, 0.75, 0.6);
        bang.position.set(Math.sin(a) * 0.45, 0.2 - Math.abs(i) * 0.03, Math.cos(a) * 0.45);
        head.add(bang);
      }
      if (p.hair === 'long') {
        const back = mesh(new THREE.CylinderGeometry(0.52, 0.44, 0.95, 22, 1, true, Math.PI * 0.5, Math.PI), toon({ color: hairC, side: THREE.DoubleSide }));
        back.position.y = -0.4; head.add(back);
        for (const s of [-1, 1]) {
          const lock = mesh(new THREE.CapsuleGeometry(0.09, 0.45, 4, 8), hairC);
          lock.position.set(0.44 * s, -0.33, 0.12); lock.rotation.z = -0.08 * s; head.add(lock);
        }
      } else if (p.hair === 'pony') {
        const tie = mesh(new THREE.TorusGeometry(0.08, 0.035, 6, 12), 0xff8fb3);
        tie.position.set(0, 0.2, -0.5); head.add(tie);
        const tail = new THREE.Group(); tail.position.set(0, 0.2, -0.55);
        [[0, -0.05, -0.08, 0.17], [0, -0.25, -0.12, 0.15], [0, -0.45, -0.1, 0.12], [0, -0.62, -0.06, 0.08]].forEach(([x, y, z, r]) => {
          const b = mesh(S(r, 12, 10), hairC); b.position.set(x, y, z); tail.add(b);
        });
        head.add(tail); this.hairBits.push(tail);
      } else if (p.hair === 'twin') {
        for (const s of [-1, 1]) {
          const braid = new THREE.Group(); braid.position.set(0.43 * s, -0.08, -0.08);
          for (let i = 0; i < 6; i++) {
            const b = mesh(S(0.095 - i * 0.004, 10, 8), hairC);
            b.scale.set(1, 0.85, 1);
            b.position.set(0.04 * s * Math.min(i, 2), -i * 0.13, 0);
            b.rotation.z = (i % 2 ? 0.4 : -0.4);
            braid.add(b);
          }
          const ribbon = mesh(S(0.07, 8, 6), 0xff8fb3); ribbon.scale.set(1.8, 0.8, 0.8);
          ribbon.position.set(0.08 * s, -0.7, 0); braid.add(ribbon);
          head.add(braid); this.hairBits.push(braid);
        }
      }
    }
    outline(this.model, 0.022);
  }

  // speed : 0~1, air : 공중 여부
  update(dt, speed = 0, air = false) {
    this.t += dt;
    const t = this.t;
    const L = this.legs, A = this.arms;
    let bob = 0;
    if (this.pose === 'sleep') {
      this.model.rotation.set(-Math.PI / 2, 0, 0);
      this.model.position.set(0, 1.2, 0.2);
      L.forEach(l => l.rotation.x = 0); A.forEach((a, i) => { a.rotation.x = 0; a.rotation.z = (i ? 1 : -1) * 0.15; });
      this.shadow.visible = false;
      return;
    }
    this.model.rotation.set(0, 0, 0);
    this.shadow.visible = true;
    if (this.pose === 'sit' || this.pose === 'plane') {
      L.forEach((l, i) => l.rotation.x = -1.3 + (this.pose === 'sit' ? Math.sin(t * 10 + i * Math.PI) * 0.35 * speed : 0));
      A.forEach((a, i) => { a.rotation.x = -1.1; a.rotation.z = (i ? 1 : -1) * 0.1; });
    } else if (this.pose === 'skate') {
      L[0].rotation.x = -0.25; L[1].rotation.x = 0.25;
      A.forEach((a, i) => { a.rotation.x = 0; a.rotation.z = (i ? 1 : -1) * (0.9 + Math.sin(t * 2) * 0.1); });
      this.model.rotation.y = 0.5;
    } else if (air) {
      L[0].rotation.x = -0.6; L[1].rotation.x = 0.3;
      A.forEach((a, i) => { a.rotation.x = -0.4; a.rotation.z = (i ? 1 : -1) * 1.3; });
    } else if (speed > 0.05) {
      const w = t * (8 + speed * 6);
      const amp = 0.35 + speed * 0.45;
      L[0].rotation.x = Math.sin(w) * amp; L[1].rotation.x = -Math.sin(w) * amp;
      A[0].rotation.x = -Math.sin(w) * amp * 0.9; A[1].rotation.x = Math.sin(w) * amp * 0.9;
      A.forEach((a, i) => a.rotation.z = (i ? 1 : -1) * 0.25);
      bob = Math.abs(Math.sin(w)) * 0.07 * (0.5 + speed);
    } else {
      L.forEach(l => l.rotation.x *= 0.8);
      A.forEach((a, i) => { a.rotation.x *= 0.8; a.rotation.z = (i ? 1 : -1) * (0.22 + Math.sin(t * 2) * 0.03); });
      bob = Math.sin(t * 2) * 0.015;
    }
    if (this.perch) { A[0].rotation.x = -0.2; A[0].rotation.z = -1.35; }
    if (this.holding) A.forEach((a, i) => { a.rotation.x = -1.25; a.rotation.z = (i ? -1 : 1) * 0.35; });
    this.model.position.set(0, bob, 0);
    this.head.rotation.z = Math.sin(t * 1.3) * 0.03;
    // 머리카락 흔들림
    this.hairBits.forEach((h, i) => { h.rotation.x = Math.sin(t * 6 + i) * 0.06 * (speed + 0.2) + (air ? -0.3 : 0); });
    // 눈 깜빡임
    const blink = (t % 3.7) < 0.12 ? 0.15 : 1;
    this.head.children.forEach(c => { if (c.userData.eye) c.scale.y = c.userData.sy * blink; });
  }
}

