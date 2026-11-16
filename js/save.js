const KEY = 'forestFriends.v1';

export function defaultSave() {
  return {
    profile: null, // { name, houseName, houseColor, hair, hairColor, eye, cloth }
    furniture: [], // { id, color, x, z, rot }
    pet: null,     // { type, color, name, adoptedAt, lastFed, lastPetted, bowlFull }
    clock: null,   // { phase: 'day'|'night', start: ms }
  };
}
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return { ...defaultSave(), ...s };
  } catch { /* 새로 시작 */ }
  return defaultSave();
}
let timer = null;
export function save(state) {
  clearTimeout(timer);
  timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 저장 공간 부족 */ } }, 200);
}
