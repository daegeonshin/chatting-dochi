import { sfx } from './audio.js';

// ───────── 미니게임 ─────────
// 지금은 미니야구 하나. 나중에 게임을 더 넣을 수 있게 목록으로 둠
export const MINI_GAMES = [
  { id: 'baseball', name: '미니야구', emo: '⚾', desc: '투수가 던진 공을 좋은 타이밍에 쳐요!' },
];

const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// 미니야구 : 주자가 한 명씩 나오고, "홈런" 버튼 타이밍으로 침
// 좋은 타이밍 = 홈런, 조금 빗나가면 2루타나 안타, 못 치면 아웃
// 너무 높거나 낮은 공을 치면 헛스윙 아웃, 안 치면 볼 (아웃 아님). 3아웃이면 끝
export class Baseball {
  constructor(root, opts) {
    this.opts = opts; // { best, onEnd(score), onExit(), profile }
    this.root = root;
    root.innerHTML = '';
    this.cv = document.createElement('canvas');
    this.cv.className = 'mini-canvas';
    root.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    // 버튼
    this.btn = document.createElement('button');
    this.btn.className = 'mini-hit'; this.btn.textContent = '⚾ 홈런!';
    root.appendChild(this.btn);
    this.exitBtn = document.createElement('button');
    this.exitBtn.className = 'mini-exit'; this.exitBtn.textContent = '✕ 나가기';
    root.appendChild(this.exitBtn);
    const swing = e => { e.preventDefault(); this.swing(); };
    this.btn.addEventListener('pointerdown', swing);
    this.onKey = e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.swing(); } };
    addEventListener('keydown', this.onKey);
    this.exitBtn.addEventListener('pointerdown', e => { e.preventDefault(); this.close(); });
    this.onResize = () => this.resize();
    addEventListener('resize', this.onResize);
    this.resize();
    this.reset();
    this.last = performance.now();
    this.alive = true;
    window.__bb = this; // 테스트용
    const loop = now => { if (!this.alive) return; requestAnimationFrame(loop); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.update(dt); this.draw(); };
    requestAnimationFrame(loop);
  }
  resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    this.W = innerWidth; this.H = innerHeight;
    this.cv.width = this.W * dpr; this.cv.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  reset() {
    this.score = 0; this.outs = 0; this.bases = [false, false, false];
    this.batter = 1; this.over = false;
    this.state = 'ready'; this.timer = 1.3;
    this.msg = '경기 시작!'; this.msgT = 1.3; this.msgC = '#ff6b9a';
    this.runners = []; this.ballFly = null; this.swingT = -1; this.pitch = null;
    this.confetti = [];
    this.t = 0;
  }
  close() {
    this.alive = false;
    removeEventListener('keydown', this.onKey);
    removeEventListener('resize', this.onResize);
    this.root.innerHTML = '';
    this.opts.onExit();
  }

  // 화면 좌표 (가로 화면 기준, 홈이 아래 가운데)
  get P() {
    const W = this.W, H = this.H, cx = W / 2;
    const s = Math.min(W / 844, H / 390);
    return {
      s, cx,
      home: [cx, H * 0.86], first: [cx + 190 * s, H * 0.62], second: [cx, H * 0.42], third: [cx - 190 * s, H * 0.62],
      mound: [cx, H * 0.6], zoneY: H * 0.77,
    };
  }

  newPitch() {
    const r = Math.random();
    const kind = r < 0.76 ? 'good' : r < 0.88 ? 'high' : 'low';
    const dur = 0.75 + Math.random() * 0.45; // 공 빠르기도 조금씩 다름
    this.pitch = { kind, dur, t: 0, swung: false, done: false };
    this.state = 'pitch';
    sfx.pitch();
  }

  swing() {
    if (this.over) return;
    if (this.state !== 'pitch' || !this.pitch || this.pitch.swung) { this.swingT = 0; sfx.swish(); return; }
    const p = this.pitch;
    p.swung = true; this.swingT = 0;
    const diff = Math.abs(p.t - p.dur);
    if (p.kind !== 'good') { this.doOut(p.kind === 'high' ? '너무 높은 공! 헛스윙 아웃' : '너무 낮은 공! 헛스윙 아웃'); sfx.swish(); return; }
    if (diff < 0.07) this.doHit(4);
    else if (diff < 0.14) this.doHit(2);
    else if (diff < 0.23) this.doHit(1);
    else { this.doOut(p.t < p.dur ? '너무 빨라요! 헛스윙 아웃' : '너무 늦어요! 헛스윙 아웃'); sfx.swish(); }
  }

  doHit(n) {
    const P = this.P;
    sfx.bat();
    this.pitch.done = true;
    // 주자 진루 (실제 야구처럼 밀려서 홈에 들어오면 1점)
    let runs = 0;
    const moves = [];
    const nb = [false, false, false];
    for (let b = 2; b >= 0; b--) {
      if (!this.bases[b]) continue;
      const to = b + n;
      if (to >= 3) { runs++; moves.push([b + 1, 4]); } else { nb[to] = true; moves.push([b + 1, to + 1]); }
    }
    if (n >= 4) { runs++; moves.push([0, 4]); } else { nb[n - 1] = true; moves.push([0, n]); }
    this.bases = nb;
    this.score += runs;
    this.runners = moves.map(([from, to]) => ({ from, to, k: 0 }));
    const label = n === 4 ? '홈런!' : n === 2 ? '2루타!' : '안타!';
    this.msg = runs ? `${label} ${runs}점!` : label;
    this.msgC = n === 4 ? '#ff4a8a' : '#3a8ad5'; this.msgT = 1.8;
    // 공이 날아감
    const ang = (Math.random() - 0.5) * (n === 4 ? 0.6 : 1.4);
    this.ballFly = { x: P.home[0], y: P.zoneY, vx: Math.sin(ang) * (n === 4 ? 520 : 380) * P.s, vy: -(n === 4 ? 620 : n === 2 ? 420 : 300) * P.s, t: 0, hr: n === 4 };
    if (n === 4) { sfx.homerun(); this.burst(); }
    else if (runs) sfx.homerun();
    this.state = 'result'; this.timer = 2.0;
    this.batter++;
  }
  doOut(text) {
    this.pitch.done = true;
    this.outs++;
    this.msg = text; this.msgC = '#8a6a7a'; this.msgT = 1.6;
    sfx.out();
    this.state = 'result'; this.timer = 1.6;
    if (this.outs >= 3) { this.timer = 1.8; this.endPending = true; }
    else this.batter++;
  }
  burst() {
    const P = this.P;
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260;
      this.confetti.push({ x: P.cx, y: this.H * 0.25, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, c: ['#ff6b9a', '#ffd84d', '#8fd3ff', '#9ad448', '#c9a7ff'][i % 5], t: 0 });
    }
  }

  update(dt) {
    this.t += dt;
    if (this.msgT > 0) this.msgT -= dt;
    if (this.swingT >= 0) { this.swingT += dt; if (this.swingT > 0.35) this.swingT = -1; }
    this.confetti.forEach(c => { c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 300 * dt; });
    this.confetti = this.confetti.filter(c => c.t < 2.2);
    if (this.ballFly) { const b = this.ballFly; b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 260 * dt * this.P.s; if (b.t > 1.8) this.ballFly = null; }
    this.runners.forEach(r => r.k = Math.min(1, r.k + dt * 0.9));
    if (this.over) return;
    if (this.state === 'ready' || this.state === 'result') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.endPending) { this.endPending = false; this.finish(); return; }
        this.runners = [];
        this.state = 'windup'; this.timer = 0.7; this.pitch = null;
      }
    } else if (this.state === 'windup') {
      this.timer -= dt;
      if (this.timer <= 0) this.newPitch();
    } else if (this.state === 'pitch') {
      const p = this.pitch;
      p.t += dt;
      if (!p.swung && p.t > p.dur + 0.25) {
        if (p.kind === 'good') this.doOut('못 쳤어요! 아웃');
        else { p.done = true; this.msg = '볼! 잘 참았어요 👍'; this.msgC = '#3aa35a'; this.msgT = 1.2; this.state = 'result'; this.timer = 1.0; }
      }
    }
  }
  finish() {
    this.over = true;
    const best = Math.max(this.opts.best || 0, this.score);
    const isBest = this.score > (this.opts.best || 0) && this.score > 0;
    this.opts.best = best;
    this.opts.onEnd(this.score);
    const box = document.createElement('div');
    box.className = 'mini-over';
    box.innerHTML = `<div class="mo-title">경기 끝!</div><div class="mo-score">${this.score}점</div><div class="mo-best">${isBest ? '🏆 최고 기록이에요!' : `최고 기록 ${best}점`}</div>`;
    const again = document.createElement('button'); again.className = 'p-btn'; again.textContent = '⚾ 다시 하기';
    const exit = document.createElement('button'); exit.className = 'p-btn gray'; exit.textContent = '나가기';
    again.onclick = () => { box.remove(); this.reset(); };
    exit.onclick = () => this.close();
    const row = document.createElement('div'); row.className = 'center'; row.append(again, exit); box.appendChild(row);
    this.root.appendChild(box);
    if (isBest) this.burst();
  }

  // ───── 그리기 ─────
  drawKid(x, y, s, shirt, face = 1, bat = null) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = 'rgba(40,40,60,0.18)'; c.beginPath(); c.ellipse(0, 2, 16, 5, 0, 0, 7); c.fill();
    c.fillStyle = shirt; rr(c, -11, -26, 22, 24, 9); c.fill();
    c.fillStyle = '#ffe1cf'; c.beginPath(); c.arc(0, -38, 15, 0, 7); c.fill();
    c.fillStyle = '#2e2a2b';
    c.beginPath(); c.ellipse(-5 * face, -38, 2.2, 3, 0, 0, 7); c.ellipse(5 * face, -38, 2.2, 3, 0, 0, 7); c.fill();
    c.fillStyle = '#ffa3b8'; c.beginPath(); c.ellipse(-9, -33, 3.5, 2, 0, 0, 7); c.ellipse(9, -33, 3.5, 2, 0, 0, 7); c.fill();
    c.fillStyle = shirt; c.beginPath(); c.arc(0, -44, 15, Math.PI, 0); c.fill(); // 모자
    c.fillRect(-2, -47, 20 * face, 4);
    if (bat !== null) {
      c.save(); c.translate(8, -20); c.rotate(bat);
      c.fillStyle = '#c8905a'; rr(c, -3, -34, 7, 36, 3); c.fill();
      c.restore();
    }
    c.restore();
  }
  draw() {
    const c = this.ctx, W = this.W, H = this.H, P = this.P, s = P.s;
    // 하늘과 관중석
    const g = c.createLinearGradient(0, 0, 0, H * 0.3);
    g.addColorStop(0, '#7cc6ff'); g.addColorStop(1, '#d4efff');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#b48ad5'; c.fillRect(0, H * 0.14, W, H * 0.1);
    for (let i = 0; i < 60; i++) { c.fillStyle = ['#ff8fb3', '#ffd84d', '#8fd3ff', '#ffffff', '#9ad448'][i % 5]; c.beginPath(); c.arc((i + 0.5) / 60 * W, H * 0.17 + (i % 2) * 8 + Math.sin(this.t * 4 + i) * (this.ballFly && this.ballFly.hr ? 4 : 1), 5 * s, 0, 7); c.fill(); }
    // 외야 펜스와 잔디
    c.fillStyle = '#3aa35a'; c.fillRect(0, H * 0.24, W, 6 * s);
    const gg = c.createLinearGradient(0, H * 0.25, 0, H);
    gg.addColorStop(0, '#7fd06a'); gg.addColorStop(1, '#5fb84f');
    c.fillStyle = gg; c.fillRect(0, H * 0.25, W, H);
    for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'; c.fillRect(0, H * 0.25 + i * H * 0.085, W, H * 0.085); }
    // 내야 흙
    c.fillStyle = '#e8c890';
    c.beginPath(); c.moveTo(P.home[0], P.home[1] + 26 * s); c.lineTo(P.first[0] + 34 * s, P.first[1]); c.lineTo(P.second[0], P.second[1] - 26 * s); c.lineTo(P.third[0] - 34 * s, P.third[1]); c.closePath(); c.fill();
    c.fillStyle = '#7fd06a';
    c.beginPath(); c.moveTo(P.home[0], P.home[1] - 22 * s); c.lineTo(P.first[0] - 30 * s, P.first[1]); c.lineTo(P.second[0], P.second[1] + 20 * s); c.lineTo(P.third[0] + 30 * s, P.third[1]); c.closePath(); c.fill();
    c.fillStyle = '#e0bc80'; c.beginPath(); c.ellipse(P.mound[0], P.mound[1], 34 * s, 12 * s, 0, 0, 7); c.fill();
    // 베이스
    const baseAt = (pt, on) => { c.save(); c.translate(pt[0], pt[1]); c.rotate(Math.PI / 4); c.fillStyle = on ? '#ffd84d' : '#ffffff'; c.strokeStyle = '#c8a070'; c.lineWidth = 2; c.fillRect(-9 * s, -9 * s, 18 * s, 18 * s); c.strokeRect(-9 * s, -9 * s, 18 * s, 18 * s); c.restore(); };
    baseAt(P.first, this.bases[0]); baseAt(P.second, this.bases[1]); baseAt(P.third, this.bases[2]);
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(P.home[0] - 11 * s, P.home[1]); c.lineTo(P.home[0] + 11 * s, P.home[1]); c.lineTo(P.home[0] + 11 * s, P.home[1] + 7 * s); c.lineTo(P.home[0], P.home[1] + 14 * s); c.lineTo(P.home[0] - 11 * s, P.home[1] + 7 * s); c.fill();
    // 주자 (베이스 위 또는 달리는 중)
    const path = [P.home, P.first, P.second, P.third, P.home];
    const at = (from, to, k) => {
      const segs = to - from; const f = k * segs; const i = Math.min(segs - 1, Math.floor(f)); const kk = f - i;
      const a = path[from + i], b = path[from + i + 1];
      return [a[0] + (b[0] - a[0]) * kk, a[1] + (b[1] - a[1]) * kk];
    };
    if (this.runners.length) {
      for (const r of this.runners) { if (r.to === 4 && r.k >= 1) continue; const [x, y] = at(r.from, r.to, r.k); this.drawKid(x, y, 0.7 * s, '#ff8fb3', 1); }
    } else {
      this.bases.forEach((on, i) => { if (on) { const pt = path[i + 1]; this.drawKid(pt[0] + 14 * s, pt[1] - 4 * s, 0.7 * s, '#ff8fb3', 1); } });
    }
    // 투수
    const wind = this.state === 'windup' ? Math.sin((0.7 - this.timer) / 0.7 * Math.PI) : 0;
    this.drawKid(P.mound[0], P.mound[1] - wind * 6 * s, 0.95 * s, '#4a7dff', 1);
    // 스트라이크 존
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.setLineDash([5, 4]);
    c.strokeRect(P.home[0] - 22 * s, P.zoneY - 22 * s, 44 * s, 44 * s); c.setLineDash([]);
    // 공
    const p = this.pitch;
    if (p && !p.done && this.state === 'pitch') {
      const k = Math.min(1.25, p.t / p.dur);
      const off = p.kind === 'high' ? -60 * s : p.kind === 'low' ? 38 * s : 0;
      const x = P.mound[0] + (P.home[0] - P.mound[0]) * k;
      const y = (P.mound[1] - 30 * s) + ((P.zoneY + off) - (P.mound[1] - 30 * s)) * k - Math.sin(Math.min(1, k) * Math.PI) * 18 * s;
      const r = (4 + k * 8) * s;
      c.fillStyle = 'rgba(40,40,60,0.2)'; c.beginPath(); c.ellipse(x, P.mound[1] + (P.home[1] - P.mound[1]) * Math.min(1, k), r, r * 0.35, 0, 0, 7); c.fill();
      c.fillStyle = '#ffffff'; c.strokeStyle = '#e8433f'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke();
    }
    if (this.ballFly) { const b = this.ballFly; c.fillStyle = '#ffffff'; c.strokeStyle = '#e8433f'; c.beginPath(); c.arc(b.x, b.y, 7 * s * Math.max(0.3, 1 - b.t * 0.4), 0, 7); c.fill(); c.stroke(); }
    // 타자 (내 캐릭터 색)
    const swingA = this.swingT >= 0 ? -1.6 + Math.min(1, this.swingT / 0.15) * 3.2 : -1.6;
    const shirt = (this.opts.shirt || '#c9a7ff');
    this.drawKid(P.home[0] - 34 * s, P.home[1] + 6 * s, 1.15 * s, shirt, 1, swingA);
    // 폭죽
    for (const f of this.confetti) { c.fillStyle = f.c; c.globalAlpha = Math.max(0, 1 - f.t / 2.2); c.fillRect(f.x, f.y, 7, 7); }
    c.globalAlpha = 1;
    // 점수판
    rr(c, 12, 12, 180 * Math.max(0.8, s), 64, 14); c.fillStyle = 'rgba(255,255,255,0.9)'; c.fill();
    c.fillStyle = '#b0507a'; c.font = `bold ${18}px "Malgun Gothic", sans-serif`; c.textBaseline = 'middle';
    c.fillText(`점수 ${this.score}점`, 26, 32);
    c.font = `bold 15px "Malgun Gothic", sans-serif`; c.fillStyle = '#6a5a7a';
    c.fillText('아웃', 26, 58);
    for (let i = 0; i < 3; i++) { c.fillStyle = i < this.outs ? '#ff6b6b' : '#e8e0ea'; c.beginPath(); c.arc(76 + i * 22, 58, 8, 0, 7); c.fill(); }
    c.textAlign = 'right'; c.fillStyle = 'rgba(255,255,255,0.9)';
    rr(c, W - 150, 12, 138, 34, 14); c.fill();
    c.fillStyle = '#6a5a7a'; c.font = 'bold 14px "Malgun Gothic", sans-serif'; c.fillText(`🏆 최고 ${this.opts.best || 0}점`, W - 24, 29);
    c.textAlign = 'left';
    // 안내 문구
    if (this.msgT > 0 && !this.over) {
      const a = Math.min(1, this.msgT * 3);
      c.globalAlpha = a; c.textAlign = 'center';
      c.font = `bold ${Math.round(30 * s + 6)}px "Malgun Gothic", sans-serif`;
      c.lineWidth = 6; c.strokeStyle = '#ffffff'; c.strokeText(this.msg, W / 2, H * 0.33);
      c.fillStyle = this.msgC; c.fillText(this.msg, W / 2, H * 0.33);
      c.globalAlpha = 1; c.textAlign = 'left';
    } else if (this.state === 'windup' || this.state === 'ready') {
      c.textAlign = 'center'; c.font = 'bold 16px "Malgun Gothic", sans-serif'; c.fillStyle = 'rgba(60,40,70,0.7)';
      c.fillText(`${this.batter}번 타자! 공이 네모 칸에 오면 홈런 버튼을 눌러요`, W / 2, H * 0.33);
      c.textAlign = 'left';
    }
  }
}
