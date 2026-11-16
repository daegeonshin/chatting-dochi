import * as THREE from 'three';
import { mesh } from './utils.js';

// 탈것 모델 (앞쪽이 +z)
export function makeVehicle(id) {
  const g = new THREE.Group();
  g.userData.spin = [];
  if (id === 'bike') {
    const pink = 0xff7aa8;
    for (const z of [-0.6, 0.6]) {
      const w = new THREE.Group(); w.position.set(0, 0.42, z);
      const tire = mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 20), 0x3a3a3a); tire.rotation.y = Math.PI / 2;
      const hub = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), 0xdddddd); hub.rotation.z = Math.PI / 2;
      for (let k = 0; k < 3; k++) { const sp = mesh(new THREE.BoxGeometry(0.02, 0.68, 0.02), 0xdddddd); sp.rotation.x = k * Math.PI / 3; w.add(sp); }
      w.add(tire, hub); g.add(w); g.userData.spin.push(w);
    }
    const bar = (len, x, y, z, rx) => { const b = mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), pink); b.position.set(x, y, z); b.rotation.x = rx; g.add(b); };
    bar(1.1, 0, 0.75, 0, Math.PI / 2);
    bar(0.6, 0, 0.6, -0.35, 0.6);
    bar(0.6, 0, 0.62, 0.45, -0.4);
    bar(0.5, 0, 0.95, 0.55, 0);
    const handle = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 6), 0x555555); handle.rotation.z = Math.PI / 2; handle.position.set(0, 1.2, 0.55); g.add(handle);
    const seat = mesh(new THREE.BoxGeometry(0.25, 0.08, 0.38), 0x5a3a2a); seat.position.set(0, 0.95, -0.3); g.add(seat);
    const basket = mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.25, 10, 1, true), 0xd9a066, { side: THREE.DoubleSide }); basket.position.set(0, 1.05, 0.78); g.add(basket);
    g.userData.seatY = 0.55; g.userData.seatZ = -0.25;
  } else if (id === 'skate') {
    const board = mesh(new THREE.CapsuleGeometry(0.22, 0.8, 4, 10), 0x8fd3ff); board.rotation.x = Math.PI / 2; board.scale.set(1, 1, 0.25); board.position.y = 0.16; g.add(board);
    const star = mesh(new THREE.CircleGeometry(0.12, 5), 0xffd84d); star.rotation.x = -Math.PI / 2; star.position.y = 0.21; g.add(star);
    for (const z of [-0.38, 0.38]) for (const x of [-0.15, 0.15]) {
      const wh = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 10), 0xff7aa8); wh.rotation.z = Math.PI / 2; wh.position.set(x, 0.07, z); g.add(wh);
    }
    g.userData.seatY = 0.2; g.userData.seatZ = 0;
  } else if (id === 'plane') {
    const body = mesh(new THREE.CapsuleGeometry(0.55, 1.8, 6, 14), 0xffd84d); body.rotation.x = Math.PI / 2; body.position.y = 0.9; g.add(body);
    const nose = mesh(new THREE.SphereGeometry(0.3, 12, 10), 0xff6b6b); nose.position.set(0, 0.9, 1.45); g.add(nose);
    const wing = mesh(new THREE.BoxGeometry(4.2, 0.12, 0.9), 0x8fd3ff); wing.position.set(0, 0.75, 0.2); g.add(wing);
    for (const s of [-1, 1]) { const tip = mesh(new THREE.SphereGeometry(0.2, 8, 6), 0xff6b6b); tip.position.set(2.1 * s, 0.75, 0.2); g.add(tip); }
    const tail = mesh(new THREE.BoxGeometry(1.5, 0.08, 0.5), 0x8fd3ff); tail.position.set(0, 1.0, -1.25); g.add(tail);
    const fin = mesh(new THREE.BoxGeometry(0.08, 0.7, 0.55), 0xff6b6b); fin.position.set(0, 1.35, -1.25); g.add(fin);
    const prop = new THREE.Group(); prop.position.set(0, 0.9, 1.65);
    const blade = mesh(new THREE.BoxGeometry(1.4, 0.14, 0.04), 0x6a5060); prop.add(blade);
    const blade2 = blade.clone(); blade2.rotation.z = Math.PI / 2; prop.add(blade2);
    g.add(prop); g.userData.prop = prop;
    const window_ = mesh(new THREE.SphereGeometry(0.42, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xbfe8ff, { transparent: true, opacity: 0.55 });
    window_.position.set(0, 1.35, 0.35); window_.scale.set(1, 0.7, 1.3); g.add(window_);
    for (const s of [-1, 1]) { const wl = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 10), 0x3a3a3a); wl.rotation.z = Math.PI / 2; wl.position.set(0.6 * s, 0.18, 0.4); g.add(wl); }
    g.userData.seatY = 0.75; g.userData.seatZ = -0.15;
  }
  return g;
}

export function animateVehicle(v, id, speed, dt) {
  if (id === 'bike') v.userData.spin.forEach(w => w.rotation.x += speed * dt / 0.36);
  if (id === 'plane' && v.userData.prop) v.userData.prop.rotation.z += dt * (8 + speed * 2);
}
