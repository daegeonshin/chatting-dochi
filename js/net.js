// 친구 서버 (Firebase Realtime Database + 익명 로그인)
// 방 구조 : rooms/{초대코드}/ meta, slots(집 자리), members(닉네임과 꾸미기), pos(지금 위치), chat, kicked
// 주소에 ?netmock=1 을 붙이면 서버 없이 같은 브라우저 탭끼리 시험 (개발용)
import { FIREBASE_CONFIG } from './firebase-config.js';
import { cleanChat, cleanName } from './chatfilter.js';

export const MAX_SLOTS = 5;
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 I, O, 0, 1 빼기
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
const SDK = 'https://www.gstatic.com/firebasejs/12.6.0/';
export const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
export const validCode = c => CODE_RE.test(c);
function newCode() {
  const a = new Uint32Array(6); crypto.getRandomValues(a);
  return [...a].map(n => CODE_ABC[n % CODE_ABC.length]).join('');
}

// ───────── Firebase 연결 ─────────
async function firebaseBackend() {
  const [appM, authM, db] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-database.js')]);
  const app = appM.initializeApp(FIREBASE_CONFIG);
  const auth = authM.getAuth(app);
  const cred = await authM.signInAnonymously(auth);
  const d = db.getDatabase(app);
  const r = p => db.ref(d, p);
  return {
    uid: cred.user.uid,
    now: () => db.serverTimestamp(),
    get: async p => (await db.get(r(p))).val(),
    update: (p, obj) => db.update(r(p), obj),
    set: (p, v) => db.set(r(p), v),
    push: (p, v) => db.push(r(p), v),
    listen: (p, cb, err) => db.onValue(r(p), s => cb(s.val()), err),
    listenAdded: (p, n, cb, err) => db.onChildAdded(db.query(r(p), db.limitToLast(n)), s => cb(s.key, s.val()), err),
    removeOnLeave: p => db.onDisconnect(r(p)).remove(),
    cancelOnLeave: p => db.onDisconnect(r(p)).cancel(),
    online: cb => db.onValue(r('.info/connected'), s => cb(!!s.val())),
  };
}

// ───────── 시험용 (같은 브라우저 탭끼리, 서버 없음) ─────────
function mockBackend() {
  const KEY = 'ffmock.db', ch = new BroadcastChannel('ffmock');
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const parts = p => p.split('/').filter(Boolean);
  const at = (o, p) => parts(p).reduce((a, k) => a == null ? null : a[k], o) ?? null;
  const put = (o, p, v) => {
    const ks = parts(p); let a = o;
    ks.slice(0, -1).forEach(k => { if (typeof a[k] !== 'object' || a[k] === null) a[k] = {}; a = a[k]; });
    if (v === null || v === undefined) delete a[ks.at(-1)]; else a[ks.at(-1)] = JSON.parse(JSON.stringify(v));
  };
  const subs = new Set();
  const fire = () => subs.forEach(f => f());
  ch.onmessage = fire;
  const write = fn => { const o = read(); fn(o); localStorage.setItem(KEY, JSON.stringify(o)); fire(); ch.postMessage(1); };
  let uid = sessionStorage.getItem('ffmock.uid');
  if (!uid) { uid = 'm' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('ffmock.uid', uid); }
  const leave = new Set();
  addEventListener('pagehide', () => write(o => leave.forEach(p => put(o, p, null))));
  return {
    uid, mock: true,
    now: () => Date.now(),
    get: async p => at(read(), p),
    update: async (p, obj) => write(o => { for (const [k, v] of Object.entries(obj)) put(o, p + '/' + k, v); }),
    set: async (p, v) => write(o => put(o, p, v)),
    push: async (p, v) => write(o => put(o, p + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), v)),
    listen: (p, cb) => { let last; const f = () => { const v = JSON.stringify(at(read(), p)); if (v !== last) { last = v; cb(JSON.parse(v)); } }; subs.add(f); f(); return () => subs.delete(f); },
    listenAdded: (p, n, cb) => {
      const seen = new Set(); let first = true;
      const f = () => { const o = at(read(), p) || {}; let ks = Object.keys(o).sort(); if (first) ks = ks.slice(-n); first = false; ks.forEach(k => { if (!seen.has(k)) { seen.add(k); cb(k, o[k]); } }); };
      subs.add(f); f(); return () => subs.delete(f);
    },
    removeOnLeave: async p => leave.add(p),
    cancelOnLeave: async p => leave.delete(p),
    online: cb => cb(true),
  };
}

// ───────── 방 ─────────
// S.room = { code, slot } 이 저장되어 있으면 그 방에 다시 들어감
export class Net {
  constructor(S, hooks) {
    this.S = S; this.h = hooks; // { onMembers, onPos, onChat, onKicked, onStatus, persist }
    this.db = null; this.uid = null;
    this.members = {}; this.pos = {}; this.meta = null;
    this.unsubs = [];
    this.status = 'off'; // off | connecting | ready | error
    this.lastSent = 0; this.lastKey = '';
  }
  get enabled() { return !!FIREBASE_CONFIG || new URLSearchParams(location.search).has('netmock'); }
  get room() { return this.S.room; }
  get isOwner() { return !!(this.meta && this.meta.owner === this.uid); }
  setStatus(s, msg) { this.status = s; this.h.onStatus && this.h.onStatus(s, msg); }

  async connect() {
    if (!this.enabled) return false;
    if (this.db) return true;
    this.setStatus('connecting');
    try {
      this.db = new URLSearchParams(location.search).has('netmock') ? mockBackend() : await firebaseBackend();
      this.uid = this.db.uid;
      this.db.online(on => this.h.onOnline && this.h.onOnline(on));
      this.setStatus('ready');
      return true;
    } catch (e) {
      console.warn('친구 서버 연결 실패', e);
      this.db = null;
      this.setStatus('error', '친구 서버에 연결하지 못했어요. 인터넷을 확인해 주세요');
      return false;
    }
  }

  me() {
    const p = this.S.profile;
    return {
      name: cleanName(p.name), house: cleanChat(p.houseName).slice(0, 10) || '친구 집',
      look: { hair: p.hair, hairColor: p.hairColor, eye: p.eye, cloth: p.cloth, houseColor: p.houseColor },
      slot: this.S.room ? this.S.room.slot : 0,
    };
  }

  // 새 방 만들기 → 내 집은 0번 자리
  async createRoom() {
    if (!await this.connect()) return null;
    for (let tries = 0; tries < 5; tries++) {
      const code = newCode();
      try {
        const m = { ...this.me(), slot: 0, joinedAt: this.db.now() };
        await this.db.update('rooms/' + code, { meta: { owner: this.uid, createdAt: this.db.now(), locked: false }, 'slots/0': this.uid, ['members/' + this.uid]: m });
        return { code, slot: 0 };
      } catch (e) { console.warn('방 만들기 재시도', e); }
    }
    throw new Error('방을 만들지 못했어요');
  }

  // 초대 코드로 들어가기 → 비어 있는 집 자리를 맡음
  async joinRoom(code) {
    code = normCode(code);
    if (!validCode(code)) throw new Error('초대 코드는 6글자예요');
    if (!await this.connect()) throw new Error('친구 서버에 연결하지 못했어요');
    const base = 'rooms/' + code;
    const meta = await this.db.get(base + '/meta');
    if (!meta) throw new Error('그런 방이 없어요. 코드를 다시 확인해 주세요');
    if (await this.db.get(base + '/kicked/' + this.uid)) throw new Error('이 방에는 들어갈 수 없어요');
    const mine = await this.db.get(base + '/members/' + this.uid);
    if (mine) return { code, slot: mine.slot };
    if (meta.locked) throw new Error('방장이 방을 잠갔어요');
    for (let tries = 0; tries < 3; tries++) {
      const slots = (await this.db.get(base + '/slots')) || {};
      let free = -1;
      for (let n = 0; n < MAX_SLOTS; n++) if (!slots[n]) { free = n; break; }
      if (free < 0) throw new Error(`방이 꽉 찼어요 (최대 ${MAX_SLOTS}명)`);
      try {
        await this.db.update(base, { ['slots/' + free]: this.uid, ['members/' + this.uid]: { ...this.me(), slot: free, joinedAt: this.db.now() } });
        return { code, slot: free };
      } catch (e) { console.warn('자리 맡기 재시도', e); }
    }
    throw new Error('들어가지 못했어요. 잠시 뒤에 다시 해 봐요');
  }

  // 저장된 방에 접속해서 친구 소식 듣기
  async enter() {
    const room = this.S.room;
    if (!room || !await this.connect()) return false;
    const base = 'rooms/' + room.code;
    const fail = e => { console.warn('방 연결 오류', e); this.h.onKicked && this.h.onKicked('방에 연결할 수 없어요'); };
    try {
      const mine = await this.db.get(base + '/members/' + this.uid);
      if (!mine) { this.h.onKicked && this.h.onKicked('방에서 나왔어요'); return false; }
      // 꾸미기를 바꿨으면 반영
      await this.db.update(base + '/members/' + this.uid, { ...this.me(), slot: mine.slot });
    } catch (e) { fail(e); return false; }
    this.unsubs.push(this.db.listen(base + '/meta', v => { this.meta = v; this.h.onMembers && this.h.onMembers(this.members); }));
    this.unsubs.push(this.db.listen(base + '/members', v => {
      this.members = v || {};
      if (!this.members[this.uid]) { this.h.onKicked && this.h.onKicked('방장이 방에서 내보냈어요'); return; }
      this.h.onMembers && this.h.onMembers(this.members);
    }, fail));
    this.unsubs.push(this.db.listen(base + '/pos', v => { this.pos = v || {}; this.h.onPos && this.h.onPos(this.pos); }, () => {}));
    this.unsubs.push(this.db.listenAdded(base + '/chat', 40, (k, v) => {
      if (!v || typeof v.m !== 'string') return;
      this.h.onChat && this.h.onChat({ id: k, uid: v.u, name: cleanName(v.n), text: cleanChat(v.m), t: v.t });
    }, () => {}));
    this.db.removeOnLeave(base + '/pos/' + this.uid);
    this.lastKey = '';
    return true;
  }

  // 내 위치 보내기 (초당 최대 6번, 안 움직이면 안 보냄)
  sendPos(st) {
    if (!this.db || !this.S.room) return;
    const now = performance.now();
    if (now - this.lastSent < 160) return;
    const key = JSON.stringify(st);
    if (key === this.lastKey && now - this.lastSent < 5000) return;
    this.lastSent = now; this.lastKey = key;
    this.db.set('rooms/' + this.S.room.code + '/pos/' + this.uid, { ...st, t: this.db.now() }).catch(() => {});
  }

  async say(text) {
    const m = cleanChat(text);
    if (!m || !this.db || !this.S.room) return false;
    await this.db.push('rooms/' + this.S.room.code + '/chat', { u: this.uid, n: cleanName(this.S.profile.name), m, t: this.db.now() });
    return true;
  }

  // 방 나가기 (내 집 자리도 비움)
  async leave() {
    const room = this.S.room;
    if (room && this.db) {
      const base = 'rooms/' + room.code;
      try { await this.db.update(base, { ['pos/' + this.uid]: null, ['members/' + this.uid]: null, ['slots/' + room.slot]: null }); } catch (e) { console.warn(e); }
    }
    this.stop();
  }
  stop() { this.unsubs.forEach(u => { try { u(); } catch { /* */ } }); this.unsubs = []; this.members = {}; this.pos = {}; this.meta = null; }

  // 방장 : 내보내기, 잠그기
  async kick(uid) {
    const m = this.members[uid];
    if (!this.isOwner || !m || uid === this.uid) return;
    const base = 'rooms/' + this.S.room.code;
    await this.db.update(base, { ['kicked/' + uid]: true, ['pos/' + uid]: null, ['members/' + uid]: null, ['slots/' + m.slot]: null });
  }
  async setLocked(on) {
    if (!this.isOwner) return;
    await this.db.set('rooms/' + this.S.room.code + '/meta/locked', !!on);
  }
}
