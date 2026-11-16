import * as THREE from 'three';
import { angleLerp, clamp } from './utils.js';
import { makeVehicle, animateVehicle } from './vehicles.js';
import { VEHICLES } from './data.js';
import { sfx } from './audio.js';

const GRAV = 24, WALK = 6.5;

export class Player {
  constructor(avatar) {
    this.avatar = avatar;
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // 방향 회전
    this.root.add(this.body);
    this.body.add(avatar.root);
    this.pos = this.root.position;
    this.vy = 0; this.onGround = true; this.jumps = 0; this.airBoost = 1;
    this.yaw = 0; this.speed = 0;
    this.vehicle = null; // { id, mesh, def }
    this.landing = false;
    this.lift = 0; // 비행기 상승(+1)/하강(-1)
  }

  get riding() { return this.vehicle ? this.vehicle.id : null; }
  get flying() { return this.riding === 'plane' && this.pos.y - this._ground > 0.6; }

  jump() {
    if (this.riding === 'bike' || this.riding === 'plane') return;
    if (this.onGround) { this.vy = 8.6; this.onGround = false; this.jumps = 1; this.airBoost = 1; sfx.jump(); return true; }
    if (this.jumps === 1 && !this.riding) { this.vy = 11; this.jumps = 2; this.airBoost = 1.75; sfx.jump2(); return true; }
    return false;
  }

  mount(id) {
    if (this.vehicle) this.removeVehicle();
    const def = VEHICLES.find(v => v.id === id);
    const m = makeVehicle(id);
    this.body.add(m);
    this.vehicle = { id, mesh: m, def };
    this.avatar.root.position.set(0, m.userData.seatY, m.userData.seatZ);
    this.avatar.pose = id === 'skate' ? 'skate' : id === 'plane' ? 'plane' : 'sit';
    this.landing = false;
  }
  removeVehicle() {
    if (!this.vehicle) return;
    this.body.remove(this.vehicle.mesh);
    this.vehicle = null;
    this.avatar.root.position.set(0, 0, 0);
    this.avatar.pose = 'stand';
    this.body.rotation.set(0, this.yaw, 0);
  }
  // 내리기 (하늘이면 먼저 착륙)
  dismount() {
    if (!this.vehicle) return;
    if (this.riding === 'plane' && this.pos.y - this._ground > 0.6) { this.landing = true; return 'landing'; }
    this.removeVehicle();
    return 'done';
  }

  update(dt, mv, camYaw, env) {
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let dx = fx * mv.y + rx * mv.x, dz = fz * mv.y + rz * mv.x;
    const mag = mv.mag;
    const maxSpd = this.vehicle ? this.vehicle.def.speed : WALK;
    let spd = maxSpd * mag;
    if (!this.onGround && !this.riding) spd *= this.airBoost;
    this.speed += (spd - this.speed) * Math.min(1, dt * (this.vehicle ? 3 : 10));
    if (mag > 0.05) {
      const want = Math.atan2(dx, dz);
      this.yaw = angleLerp(this.yaw, want, Math.min(1, dt * (this.riding === 'plane' ? 3 : 12)));
    }
    // 탈것은 바라보는 방향으로 진행, 걷기는 입력 방향
    let mx, mz;
    if (this.vehicle) { mx = Math.sin(this.yaw) * this.speed; mz = Math.cos(this.yaw) * this.speed; }
    else if (mag > 0.05) { const l = Math.hypot(dx, dz) || 1; mx = dx / l * this.speed; mz = dz / l * this.speed; }
    else { mx = Math.sin(this.yaw) * this.speed * 0.3; mz = Math.cos(this.yaw) * this.speed * 0.3; this.speed *= 0.7; }
    this.pos.x += mx * dt; this.pos.z += mz * dt;

    const ground = env.height(this.pos.x, this.pos.z);
    this._ground = ground;
    const isPlane = this.riding === 'plane';
    const highUp = isPlane && this.pos.y - ground > 9;
    env.collide(this.pos, this.vehicle ? 0.7 : 0.4, isPlane && this.pos.y - ground > 1, highUp);

    if (isPlane) {
      let lift = this.lift * 7;
      if (this.landing) lift = -9;
      this.vy += (lift - this.vy) * Math.min(1, dt * 4);
      this.pos.y += this.vy * dt;
      const g2 = env.height(this.pos.x, this.pos.z);
      if (this.pos.y < g2) { this.pos.y = g2; this.vy = 0; }
      if (this.pos.y > g2 + 45) this.pos.y = g2 + 45;
      this.onGround = this.pos.y - g2 < 0.05;
      if (this.landing && this.onGround) { this.landing = false; this.removeVehicle(); }
    } else {
      this.vy -= GRAV * dt;
      this.pos.y += this.vy * dt;
      const g2 = env.height(this.pos.x, this.pos.z);
      if (this.pos.y <= g2) {
        // 내리막에서는 땅에 붙어 다니기
        this.pos.y = g2; this.vy = 0;
        if (!this.onGround) { this.onGround = true; this.jumps = 0; this.airBoost = 1; }
      } else if (this.onGround && this.pos.y - g2 < 0.35 && this.vy <= 0) {
        this.pos.y = g2; this.vy = 0;
      } else this.onGround = false;
    }

    // 몸 방향과 기울기
    this.body.rotation.y = this.yaw;
    if (isPlane && this.vehicle) {
      this.body.rotation.x = clamp(-this.vy * 0.05, -0.4, 0.4);
      this.body.rotation.z = 0;
    } else this.body.rotation.x = 0;
    if (this.vehicle) animateVehicle(this.vehicle.mesh, this.riding, this.speed, dt);
    this.avatar.update(dt, clamp(this.speed / WALK, 0, 1.4), !this.onGround && !this.riding);
  }
}
