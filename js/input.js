// 조이스틱, 화면 끌기(카메라), 터치(탭, 꾹 누르기), 키보드
export class Input {
  constructor(canvas) {
    this.move = { x: 0, y: 0 };   // 조이스틱 (-1~1), y는 앞쪽이 +
    this.look = { dx: 0, dy: 0 }; // 이번 프레임 카메라 회전량
    this.keys = new Set();
    this.handlers = { tap: null, longpress: null, dragStart: null, dragMove: null, dragEnd: null };
    this.enabled = true;

    // 조이스틱
    const zone = document.getElementById('joy-zone');
    const joy = document.getElementById('joy'), knob = document.getElementById('joy-knob');
    let jid = null, jx = 0, jy = 0, jt = 0, jmoved = false;
    const R = 55;
    zone.addEventListener('pointerdown', e => {
      if (jid !== null) return;
      jid = e.pointerId; jx = e.clientX; jy = e.clientY; jt = performance.now(); jmoved = false;
      zone.setPointerCapture(e.pointerId);
      joy.style.left = jx + 'px'; joy.style.top = jy + 'px';
      joy.classList.remove('hidden');
      knob.style.transform = 'translate(0,0)';
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== jid) return;
      let dx = e.clientX - jx, dy = e.clientY - jy;
      const d = Math.hypot(dx, dy);
      if (d > 10) jmoved = true;
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      this.move.x = dx / R; this.move.y = -dy / R;
    });
    const jend = e => {
      if (e.pointerId !== jid) return;
      jid = null; this.move.x = this.move.y = 0; joy.classList.add('hidden');
      if (!jmoved && performance.now() - jt < 350 && this.handlers.tap) this.handlers.tap(jx, jy);
    };
    zone.addEventListener('pointerup', jend);
    zone.addEventListener('pointercancel', jend);

    // 화면 끌기와 탭
    const ptrs = new Map();
    canvas.addEventListener('pointerdown', e => {
      if (!this.enabled) return;
      canvas.setPointerCapture(e.pointerId);
      const p = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, drag: false, lp: null };
      if (this.handlers.dragStart && this.handlers.dragStart(e.clientX, e.clientY)) p.drag = true;
      p.lp = setTimeout(() => {
        if (!p.moved && this.handlers.longpress) { p.long = true; this.handlers.longpress(p.sx, p.sy); }
      }, 550);
      ptrs.set(e.pointerId, p);
    });
    canvas.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 10) { p.moved = true; clearTimeout(p.lp); }
      if (p.drag) this.handlers.dragMove && this.handlers.dragMove(e.clientX, e.clientY);
      else { this.look.dx += dx; this.look.dy += dy; }
    });
    const end = e => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      clearTimeout(p.lp);
      ptrs.delete(e.pointerId);
      if (p.drag) this.handlers.dragEnd && this.handlers.dragEnd(p.moved);
      if (!p.moved && !p.long && performance.now() - p.t < 450 && this.handlers.tap) this.handlers.tap(p.sx, p.sy);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // 키보드 (PC 테스트용)
    addEventListener('keydown', e => { if (e.target.tagName !== 'INPUT') this.keys.add(e.code); });
    addEventListener('keyup', e => this.keys.delete(e.code));
  }

  // 키보드와 조이스틱 합치기
  getMove() {
    let x = this.move.x, y = this.move.y;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y = 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y = -1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x = -1;
    if (k.has('KeyD') || k.has('ArrowRight')) x = 1;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, mag: Math.min(1, m) };
  }
  takeLook() { const l = { ...this.look }; this.look.dx = this.look.dy = 0; return l; }
}

// 버튼 누름 (손가락이 닿자마자 반응)
export function onPress(el, fn) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(e); });
}
