// ?ffp=이름 : 한 브라우저에서 여러 사람을 시험할 때 저장을 따로 씀 (개발용)
const KEY = 'forestFriends.v1' + ((new URLSearchParams(location.search).get('ffp') || '').replace(/[^a-z0-9]/gi, '').slice(0, 8));

export function defaultSave() {
  return {
    profile: null,  // { name, houseName, houseColor, hair, hairColor, eye, cloth }
    furniture: [],  // { uid, id, color, x, z, rot }
    pets: [],       // { uid, type, color, name, adoptedAt, lastFed, lastPetted, sick, walking }
    bowl: 0,        // 밥그릇에 남은 그릇 수
    birds: [],      // 집 새 { uid, kind: 'magpie'|'sparrow', color, name, stage: 'egg'|'baby'|'adult', placedAt, bornAt, nest, away, awayAt }
    windows: null,  // { fl, fr, l, r, b : { open, cur } }
    clock: null,    // { phase: 'day'|'night', start: ms }
  };
}
export const uid = () => Math.random().toString(36).slice(2, 9);
export const DEFAULT_WINDOWS = () => Object.fromEntries(['fl', 'fr', 'l', 'r', 'b'].map(k => [k, { open: false, cur: true }]));

export function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch { /* 새로 시작 */ }
  s = (s && typeof s === 'object') ? { ...defaultSave(), ...s } : defaultSave();
  // 예전 저장(반려동물 한 마리)을 여러 마리 형식으로
  if (s.pet) {
    if (!s.pets.length) s.pets = [{ ...s.pet }];
    if (s.pet.bowlFull) s.bowl = Math.max(s.bowl, 1);
    delete s.pet;
  }
  s.pets.forEach(p => { if (!p.uid) p.uid = uid(); delete p.bowlFull; });
  s.furniture.forEach(f => { if (!f.uid) f.uid = uid(); });
  if (!s.windows) s.windows = DEFAULT_WINDOWS();
  return s;
}
let timer = null;
export function save(state) {
  clearTimeout(timer);
  timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 공간 부족 */ } }, 200);
}
// 바로 저장 (방 들어가기처럼 곧바로 새로고침할 때)
export function saveNow(state) { clearTimeout(timer); try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 공간 부족 */ } }
