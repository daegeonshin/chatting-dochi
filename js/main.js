import * as THREE from 'three';
import { HAIR_STYLES, HAIR_COLORS, EYE_COLORS, COLORS7, PETS, VEHICLES, FURNITURE, FURN_COLORS } from './data.js';
import { load, save } from './save.js';
import { Avatar } from './avatar.js';
import { World, height, HOUSE_POS, setHouseSlot } from './world.js';
import { Net, normCode, validCode, MAX_SLOTS } from './net.js';
import { Friends, packMe } from './friends.js';
import { cleanChat } from './chatfilter.js';
import { saveNow } from './save.js';
import { makeLabel } from './utils.js';
import { Player } from './player.js';
import { Input, onPress } from './input.js';
import { DayNight } from './daynight.js';
import { House } from './house.js';
import { Pet, makePetModel } from './pets.js';
import { Weather, WEATHERS } from './weather.js';
import { HomeBirds } from './homebirds.js';
import { makeEgg } from './wildlife.js';
import { PET_HOMES, homeFor } from './data.js';
import { uid } from './save.js';
import { BerryTrees, makeBerryMesh, BERRY_NAMES } from './berries.js';
import { Baseball, MINI_GAMES } from './minigames.js';
import { SAPLING_WATER, MAGPIE_COLORS } from './data.js';
import { Wildlife } from './wildlife.js';
import { Floaters, clamp, lerp, angleLerp } from './utils.js';
import { sfx, unlockAudio } from './audio.js';
import { toon, outline, makeSkyDome, GFX, setGfx } from './look.js';
import { $, toast, openPanel, closePanel, prompt, transition, el, hexCss } from './ui.js';

const S = load();
if (S.room) setHouseSlot(S.room.slot); // 친구 방에서는 내 집이 방에서 맡은 자리에 있음
const persist = () => { if (G.dn) S.clock = G.dn.serialize(); save(S); };

// 렌더러
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = GFX.level === 'high';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  if (G.mode === 'customize') setPreviewOffset();
}
addEventListener('resize', resize);

const input = new Input(canvas);
const G = { mode: 'customize', camYaw: Math.PI, camPitch: 0.42, houseYaw: 0, t: 0, deco: false, drag: null, pet: null, petWalking: false, built: false };

// ───────── 캐릭터 꾸미기 ─────────
const draft = S.profile ? { ...S.profile } : { name: '', houseName: '', houseColor: 'sky', hair: 'twin', hairColor: 'brown', eye: 'darkbrown', cloth: 'lilac' };
const preview = { scene: new THREE.Scene(), avatar: null, yaw: 0.3, house: null };
preview.scene.background = new THREE.Color(0xffd6e7);
preview.scene.add(new THREE.HemisphereLight(0xffffff, 0xffc8dc, 1.4));
{ const d = new THREE.DirectionalLight(0xffffff, 1.2); d.position.set(2, 5, 4); preview.scene.add(d); }
{
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.3, 40), toon({ color: 0xffffff }));
  floor.position.y = -0.15; preview.scene.add(floor);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), toon({ color: [0xff9ec3, 0xffe27a, 0x9fd8ff, 0xc9a7ff][i % 4] }));
    b.position.set(Math.cos(a) * 2.1, 0.05, Math.sin(a) * 2.1); preview.scene.add(b);
  }
}
function rebuildPreview() {
  if (preview.avatar) preview.scene.remove(preview.avatar.root);
  preview.avatar = new Avatar(draft);
  preview.scene.add(preview.avatar.root);
  if (preview.house) preview.scene.remove(preview.house);
  const tmp = { windowMat: null, houseLabel: null };
  preview.house = World.prototype.makeHouse.call(tmp, draft.houseColor, draft.houseName || '');
  preview.house.scale.setScalar(0.32);
  preview.house.position.set(1.6, 0, -1.6);
  preview.house.rotation.y = -0.5;
  preview.scene.add(preview.house);
}
function setPreviewOffset() {
  const panelW = Math.min(430, innerWidth * 0.52);
  camera.setViewOffset(innerWidth, innerHeight, panelW / 2, 0, innerWidth, innerHeight);
}
function swatches(box, list, key) {
  box.innerHTML = '';
  for (const c of list) {
    const b = el('button', 'sw' + (draft[key] === c.id ? ' on' : ''));
    b.style.background = hexCss(c.hex);
    b.title = c.name;
    b.onclick = () => { draft[key] = c.id; sfx.click(); buildCustomize(); rebuildPreview(); };
    box.appendChild(b);
  }
}
function buildCustomize() {
  swatches($('sw-house'), COLORS7, 'houseColor');
  swatches($('sw-hair'), HAIR_COLORS, 'hairColor');
  swatches($('sw-eye'), EYE_COLORS, 'eye');
  swatches($('sw-cloth'), COLORS7, 'cloth');
  const ch = $('ch-hair'); ch.innerHTML = '';
  for (const h of HAIR_STYLES) {
    const b = el('button', 'chip' + (draft.hair === h.id ? ' on' : ''), h.name);
    b.onclick = () => { draft.hair = h.id; sfx.click(); buildCustomize(); rebuildPreview(); };
    ch.appendChild(b);
  }
  $('btn-start').disabled = !(draft.name.trim() && draft.houseName.trim());
  $('btn-start').textContent = G.built ? '다 꾸몄어요' : '시작하기';
}
$('in-name').value = draft.name; $('in-house').value = draft.houseName;
$('in-name').addEventListener('input', e => { draft.name = e.target.value; buildCustomize(); });
let houseNameTimer;
$('in-house').addEventListener('input', e => { draft.houseName = e.target.value; buildCustomize(); clearTimeout(houseNameTimer); houseNameTimer = setTimeout(rebuildPreview, 400); });
buildCustomize(); rebuildPreview();

$('btn-start').addEventListener('click', async () => {
  unlockAudio(); sfx.happy();
  try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch { /* 지원 안 함 */ }
  try { await screen.orientation.lock('landscape'); } catch { /* 지원 안 함 */ }
  draft.name = draft.name.trim(); draft.houseName = draft.houseName.trim();
  S.profile = { ...draft };
  persist();
  camera.clearViewOffset();
  $('customize').classList.add('hidden');
  if (!G.built) startGame();
  else { applyProfile(); setMode(G.prevMode || 'forest'); $('hud').classList.remove('hidden'); }
});

// ───────── 게임 시작 ─────────
function startGame() {
  G.built = true;
  G.forest = new THREE.Scene();
  G.world = new World(G.forest, S.profile);
  G.world.setWindows(S.windows);
  G.berries = new BerryTrees(G.world, S);
  G.weather = new Weather(G.forest);
  G.weather.onChange = k => { const w = WEATHERS[k]; toast(`${w.icon} 날씨가 바뀌었어요 : ${w.name}`); };
  G.dn = new DayNight(G.forest, G.world, S.clock);
  G.dn.weather = G.weather;
  G.dn.onChange = phase => {
    persist();
    if (phase === 'night') toast('밤이 되었어요 🌙 새와 오리는 집으로 갔어요. 침대에서 자요', 4000);
    else { toast('아침이 밝았어요 ☀️', 3000); sfx.morning(); }
  };
  G.wild = new Wildlife(G.forest, G.world, {
    isNight: () => G.dn.isNight, nightLevel: () => G.dn.night, weather: G.weather,
    house: { anyOpen: () => G.house.anyOpen(), doorPos: new THREE.Vector3(HOUSE_POS.x, 0, HOUSE_POS.z), windowWorld },
    onBirdEnter: (kind, color) => { const b = G.birds.addBird(kind, color, { guest: true }); b.justIn = G.house.anyOpen() || 'b'; },
  });
  G.avatar = new Avatar(S.profile);
  G.player = new Player(G.avatar);
  G.floatF = new Floaters(G.forest);
  G.house = new House(S.profile, S, { onSave: persist, toast });
  G.house.applyWindows(S.windows);
  G.floatH = new Floaters(G.house.scene);
  G.birds = new HomeBirds(G.house, S, { toast, onSave: persist, inHouse: () => G.mode === 'house', raining: () => G.weather.raining });
  G.player.pos.set(HOUSE_POS.x, 0, HOUSE_POS.z + 5);
  G.player.yaw = 0; G.camYaw = 0.5;
  camTarget.set(G.player.pos.x, 1.3, G.player.pos.z);
  G.forest.add(G.player.root);
  G.pets = [];
  S.pets.forEach(d => createPet(d));
  G.pets.filter(p => p.data.walking).forEach(p => startWalk(p, true)); // 산책 중에 껐으면 다시 산책
  G.house.setPets(S.pets);
  buildCatalog();
  setMode('forest');
  $('hud').classList.remove('hidden');
  setTimeout(() => {
    toast(`${S.profile.name}, 숲속 마을에 온 걸 환영해요!`, 3200);
    const hungry = G.pets.find(p => new Date(p.data.lastFed).toDateString() !== new Date().toDateString());
    if (hungry) setTimeout(() => toast(`${hungry.data.name}(이)가 아침밥을 기다려요 🍽️`, 3500), 3600);
  }, 600);
  setInterval(persist, 5000);
  setInterval(sparrowVisit, 60000);
  initNet();
  addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
}

// 집 밖 창문 위치 (참새가 날아 들어가는 곳)
function windowWorld(key) {
  const o = { fl: [-1.6, 2.6], fr: [1.6, 2.6], l: [-2.9, 0], r: [2.9, 0], b: [0, -2.6] }[key] || [0, 2.6];
  return new THREE.Vector3(HOUSE_POS.x + o[0], 1.9, HOUSE_POS.z + o[1]);
}
// 창문을 열어 두고 나가면 가끔 참새가 들어오고, 바람에 창문이 닫히면 못 나감
function sparrowVisit() {
  if (G.mode !== 'forest' || G.dn.isNight) return;
  const key = G.house.anyOpen();
  if (!key) return;
  if (Math.random() > (G.weather.raining ? 0.6 : 0.3)) return;
  const b = G.birds.addBird('sparrow', 'brown', { guest: true }); b.justIn = key;
  if (Math.random() < 0.5) { S.windows[key].open = false; applyWindowState(); }
}
function applyWindowState() { G.world.setWindows(S.windows); G.house.applyWindows(S.windows); persist(); }

function applyProfile() {
  G.avatar.build(S.profile);
  G.world.rebuildHouse(S.profile);
  G.world.setWindows(S.windows);
  G.house.buildShell(S.profile);
}

function petCtx() {
  return { world: G.world, player: G.player, get floaters() { return G.mode === 'house' ? G.floatH : G.floatF; }, onSave: persist, toast, isNight: () => G.dn.isNight };
}
function createPet(d) {
  const pet = new Pet(d, petCtx());
  pet.setScene(G.house.scene);
  const p = G.house.randomSpot(); pet.pos.set(p.x, 0, p.z);
  pet.checkHealth();
  G.pets.push(pet);
  return pet;
}
const walkers = () => G.pets.filter(p => p.mode === 'walk' && p.sub !== 'carried');
const mainWalker = () => { const w = walkers(); return w.find(p => p === G.walkPet) || w[w.length - 1] || null; };

function setMode(m) {
  G.mode = m;
  const inHouse = m === 'house';
  $('deco-bar').classList.toggle('hidden', !inHouse);
  $('btn-window').classList.toggle('hidden', !inHouse);
  if (!inHouse) setDeco(false);
  $('btn-ride').classList.toggle('disabled', inHouse);
  refreshButtons();
}

// 들고 있는 것 (펫, 새, 알)을 새 장소로 옮기기
function moveCarryTo(scene) {
  const c = G.carry; if (!c) return;
  if (c.kind === 'pet') c.pet.setScene(scene);
  else { if (c.obj.parent) c.obj.parent.remove(c.obj); scene.add(c.obj); }
}

// 집 들어가기와 나가기
function enterHouse() {
  if (G.player.riding) return;
  sfx.door();
  transition(() => {
    G.forest.remove(G.player.root);
    G.house.scene.add(G.player.root);
    G.player.pos.set(0, 0, 3.8); G.player.yaw = Math.PI; G.player.vy = 0;
    G.houseYaw = 0;
    walkers().forEach((pet, i) => { pet.goHome(); pet.setScene(G.house.scene); pet.pos.set(1.2 - i * 0.8, 0, 3.6); });
    moveCarryTo(G.house.scene);
    G.walkPet = null;
    setMode('house');
    G.birds.flushNews();
  });
}
function exitHouse(withPet = null) {
  sfx.door();
  transition(() => {
    G.house.scene.remove(G.player.root);
    G.forest.add(G.player.root);
    G.player.pos.set(G.world.door.x, 0, G.world.door.z + 0.5); G.player.yaw = 0; G.player.vy = 0;
    G.camYaw = 0.5;
    camTarget.set(G.player.pos.x, 1.3, G.player.pos.z);
    G.avatar.pose = 'stand';
    moveCarryTo(G.forest);
    setMode('forest');
    if (withPet) startWalk(withPet);
  });
}
function startWalk(pet, quiet = false) {
  if (!pet) return;
  if (G.mode === 'house' && !quiet) { exitHouse(pet); return; }
  if (G.carry && G.carry.pet === pet) { G.carry = null; G.avatar.holding = false; }
  pet.setScene(G.forest);
  const p = G.player;
  pet.walkIdx = walkers().length;
  pet.pos.set(p.pos.x - Math.sin(p.yaw) * 1.5, 0, p.pos.z - Math.cos(p.yaw) * 1.5);
  pet.pos.y = height(pet.pos.x, pet.pos.z);
  pet.startWalk();
  G.walkPet = pet;
  if (!quiet) toast(`${pet.data.name}(이)랑 산책해요! ✨ 버튼을 눌러 봐요`, 3200);
  refreshButtons();
}
function endWalk(pet) {
  const list = pet ? [pet] : walkers();
  for (const p of list) {
    p.goHome(); p.setScene(G.house.scene);
    const s = G.house.randomSpot(); p.pos.set(s.x, 0, s.z);
  }
  walkers().forEach((p, i) => p.walkIdx = i);
  if (list.length) toast(list.length > 1 ? '모두 집으로 돌아갔어요' : `${list[0].data.name}(이)가 집으로 돌아갔어요`);
  refreshButtons();
}

// 잠자기 (지금은 혼자 접속이라 내가 자면 바로 아침)
function sleep() {
  if (!G.dn.isNight) { const l = G.dn.label(); toast(`밤에만 잘 수 있어요 (${l.text})`); return; }
  if (G.carry) dropCarry();
  const bed = G.house.bedItem();
  sfx.sleep();
  G.sleeping = true;
  G.player.pos.set(bed.position.x, 0, bed.position.z);
  G.player.yaw = bed.rotation.y;
  G.avatar.pose = 'sleep';
  setTimeout(() => {
    transition(() => {
      G.dn.skipNight();
      G.avatar.pose = 'stand';
      const a = bed.rotation.y;
      G.player.pos.set(bed.position.x + Math.cos(a) * 1.7, 0, bed.position.z - Math.sin(a) * 1.7 + 0.5);
      G.sleeping = false;
      persist();
    }, '쿨쿨... 💤', 1400);
  }, 1300);
}

// 열매를 들고 까치를 톡 → 까치 색이 열매 색으로 (흰 무늬는 그대로)
function useBerryOn(applyFn, name) {
  const c = G.carry;
  const color = c.data.color;
  if (c.obj.parent) c.obj.parent.remove(c.obj);
  G.carry = null; G.avatar.holding = false;
  applyFn(color);
  sfx.happy();
  toast(`✨ ${name}(이)가 ${BERRY_NAMES[color]}색 까치가 되었어요!`, 3200);
  refreshButtons(); persist();
}

// 작은 나무에 물 주기
function waterSapling(item) {
  const d = item.userData.data;
  if (d.grown) { toast('작은 나무가 튼튼하게 자랐어요 🌳 까치 두 마리가 있으면 둥지를 틀어요'); return; }
  const now = Date.now();
  if (d.lastWater && now - d.lastWater < 8000) { toast('물이 땅에 스며들고 있어요. 조금 있다가 또 줘요 💧'); return; }
  d.water = (d.water || 0) + 1; d.lastWater = now;
  for (let i = 0; i < 4; i++) setTimeout(() => G.floatH.add('💧', item.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.1, (Math.random() - 0.5) * 0.5)), 0.4), i * 120);
  sfx.place();
  if (d.water >= SAPLING_WATER) { d.grown = true; G.house.rebuild(item); sfx.happy(); toast('🌳 새싹이 작은 나무로 자랐어요!', 3200); }
  else { G.house.rebuild(item); toast(`💧 물을 줬어요 (${d.water}/${SAPLING_WATER})`); }
  persist();
}

// ───────── 안고 다니기 ─────────
// G.carry : { kind: 'pet', pet } | { kind: 'wild', obj, data } | { kind: 'home', obj, view } | { kind: 'egg', obj, data }
function pickUp(c) {
  if (G.carry) { toast('먼저 들고 있는 걸 내려놓아요'); return false; }
  if (G.player.riding) { toast('탈것에서 내려서 안아요'); return false; }
  G.carry = c;
  G.avatar.holding = true;
  sfx.happy();
  refreshButtons();
  return true;
}
function carryPos() {
  const p = G.player;
  return new THREE.Vector3(p.pos.x + Math.sin(p.yaw) * 0.42, p.pos.y + 0.62, p.pos.z + Math.cos(p.yaw) * 0.42);
}
function updateCarry() {
  const c = G.carry; if (!c) return;
  const pos = carryPos();
  if (c.kind === 'pet') { c.pet.pos.copy(pos).y -= 0.25; c.pet.yaw = G.player.yaw; }
  else { c.obj.position.copy(pos); c.obj.rotation.y = G.player.yaw; }
}
function frontSpot() {
  const p = G.player;
  const v = new THREE.Vector3(p.pos.x + Math.sin(p.yaw) * 0.9, 0, p.pos.z + Math.cos(p.yaw) * 0.9);
  if (G.mode === 'house') G.house.collide(v, 0.3); else v.y = height(v.x, v.z);
  return v;
}
function dropCarry() {
  const c = G.carry; if (!c) return;
  const inHouse = G.mode === 'house';
  if (c.kind === 'egg') {
    if (!inHouse) { toast('알은 집에 가져가서 둥지에 놓아요 🪺'); return; }
    const nest = nearestNest();
    if (!nest) { toast('둥지가 없어요. 꾸미기에서 🪺 둥지를 놓아 주세요'); return; }
    placeEgg(nest); return;
  }
  if (c.kind === 'berry') {
    if (c.obj.parent) c.obj.parent.remove(c.obj);
    G.carry = null; G.avatar.holding = false; sfx.place();
    toast('열매를 내려놓았어요'); refreshButtons(); return;
  }
  const at = frontSpot();
  if (c.kind === 'pet') {
    c.pet.pos.copy(at);
    c.pet.putDown(!inHouse);
    if (!inHouse) { c.pet.walkIdx = walkers().length - 1; G.walkPet = c.pet; }
  } else if (c.kind === 'wild') {
    if (c.obj.parent) c.obj.parent.remove(c.obj);
    if (inHouse) {
      // 집에 데려온 까치는 내 까치, 참새는 손님
      const b = c.data.kind === 'magpie' ? G.birds.addBird('magpie', c.data.color, { name: '까치' }) : G.birds.addBird('sparrow', 'brown', { guest: true });
      const v = G.birds.buildView(b); v.root.position.copy(at);
      if (c.data.kind === 'magpie') toast('까치가 우리 집 식구가 되었어요! 꾹 눌러 이름을 지어 줘요', 3500);
    } else G.wild.release(c.data.kind, c.data.color, carryPos());
  } else if (c.kind === 'home') {
    if (!inHouse) {
      // 집 새를 밖에서 놓아주면 날아서 집으로 돌아감
      if (c.obj.parent) c.obj.parent.remove(c.obj);
      G.house.scene.add(c.obj);
      G.birds.putBack(c.view, new THREE.Vector3(0, 0, 0));
      toast(`${c.view.b.name || '새'}(이)가 날아서 집으로 돌아갔어요`);
    } else G.birds.putBack(c.view, at);
  }
  G.carry = null; G.avatar.holding = false; sfx.place();
  refreshButtons();
}
function nearestNest() {
  let best = null, bd = 1e9;
  for (const n of G.house.items.filter(i => i.userData.kind === 'nest')) { const d = n.position.distanceTo(G.player.pos); if (d < bd) { bd = d; best = n; } }
  return best;
}
function placeEgg(nest) {
  const c = G.carry;
  if (c.obj.parent) c.obj.parent.remove(c.obj);
  G.birds.addEgg(c.data.color, nest.userData.data.uid);
  G.carry = null; G.avatar.holding = false; sfx.place();
  toast('둥지에 알을 놓았어요 🪺 10분 뒤에 아기 까치가 태어나요', 3500);
  refreshButtons();
}

// ───────── 버튼 ─────────
function refreshButtons() {
  const p = G.player;
  if (!p) return;
  const r = p.riding;
  $('btn-jump').style.display = (r === 'bike' || r === 'plane' || G.sleeping) ? 'none' : '';
  $('btn-up').style.display = $('btn-down').style.display = r === 'plane' ? '' : 'none';
  $('btn-dismount').style.display = r ? '' : 'none';
  const sp = $('btn-special');
  const wk = G.pets && mainWalker();
  $('btn-drop').style.display = G.carry ? '' : 'none';
  if (G.carry) $('btn-drop').textContent = G.carry.kind === 'egg' ? '🪺 둥지에 놓기' : G.carry.kind === 'berry' ? '⬇️ 열매 버리기' : '⬇️ 내려놓기';
  if (wk && G.mode === 'forest') { sp.style.display = ''; sp.textContent = wk.specialLabel(); sp.style.width = 'auto'; sp.style.padding = '0 14px'; sp.style.borderRadius = '29px'; sp.style.fontSize = '16px'; }
  else sp.style.display = 'none';
}
onPress($('btn-jump'), () => { unlockAudio(); G.player.jump(); });
addEventListener('keydown', e => {
  if (G.mode === 'customize' || e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') G.player.jump();
  if (e.code === 'KeyE') $('btn-context').dispatchEvent(new PointerEvent('pointerdown'));
});
for (const [id, v] of [['btn-up', 1], ['btn-down', -1]]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); G.player.lift = v; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { if (G.player.lift === v) G.player.lift = 0; });
}
onPress($('btn-dismount'), () => {
  const r = G.player.dismount();
  if (r === 'landing') toast('천천히 내려가요 ✈️');
  refreshButtons();
});
onPress($('btn-drop'), () => dropCarry());
onPress($('btn-special'), () => {
  const wk = mainWalker();
  if (!wk) return;
  const msg = wk.special();
  if (msg) toast(msg);
  refreshButtons();
});
onPress($('btn-context'), () => {
  const c = G.context;
  if (c === 'enter') enterHouse();
  else if (c === 'exit') exitHouse();
});

// 채팅 (4단계에서 친구 서버와 연결)
// ───────── 친구 (같은 방, 단톡방) ─────────
G.chat = []; G.unread = 0;
const txt = (tag, cls, text) => { const e = el(tag, cls); e.textContent = text; return e; }; // 친구가 쓴 글은 꼭 textContent로
const isChatOpen = () => !$('panel').classList.contains('hidden') && $('panel-title').textContent.startsWith('💬');
function setUnread(n) {
  G.unread = n;
  const b = $('btn-chat');
  b.dataset.badge = n > 0 ? (n > 9 ? '9+' : String(n)) : '';
  b.classList.toggle('badge', n > 0);
}
async function initNet() {
  G.net = new Net(S, {
    onMembers: m => { if (G.friends) G.friends.setMembers(m); if (isChatOpen()) chatPanel(true); },
    onPos: pos => { if (G.friends) G.friends.setPos(pos); },
    onChat: msg => addChat(msg),
    onKicked: msg => backToSolo(msg),
  });
  if (!G.net.enabled) return;
  const link = normCode(new URLSearchParams(location.search).get('room'));
  if (S.room) {
    if (!await G.net.connect()) { toast('친구 서버에 연결하지 못했어요. 혼자 놀 수 있어요', 3500); return; }
    G.friends = new Friends(G.forest, G.world, G.net.uid);
    G.chatHistory = true;
    if (await G.net.enter()) {
      setTimeout(() => { G.chatHistory = false; }, 2500);
      setTimeout(() => {
        const n = G.friends.online().length;
        toast(n ? `친구 ${n}명이 숲에 있어요 👋` : `친구 방(${S.room.code})에 들어왔어요`, 3000);
      }, 4200);
    }
  }
  if (validCode(link) && (!S.room || S.room.code !== link)) setTimeout(() => joinPanel(link), 1500);
}
// 방에 들어가거나 나오면 집 자리가 바뀌므로 새로 시작
const urlNoRoom = () => { const u = new URL(location.href); u.searchParams.delete('room'); return u.pathname + u.search; };
function restart(msg) {
  saveNow(S);
  transition(() => location.replace(urlNoRoom()), msg, 3000);
}
function backToSolo(msg) {
  if (!S.room) return;
  if (G.net) G.net.stop();
  S.room = null; S.clock = G.dn.serialize();
  toast(msg, 3000);
  setTimeout(() => restart('혼자 놀기로 돌아가요 🏡'), 1500);
}
function addChat(msg) {
  G.chat.push(msg);
  if (G.chat.length > 40) G.chat.shift();
  if (G.chatHistory) { if (isChatOpen()) appendChat(msg); return; }
  if (msg.uid !== G.net.uid) {
    if (G.friends) G.friends.say(msg.uid, msg.text);
    if (isChatOpen()) appendChat(msg); else { setUnread(G.unread + 1); sfx.click(); }
  } else {
    if (G.myBubble) G.player.root.remove(G.myBubble);
    G.myBubble = makeLabel('💬 ' + msg.text, '#5a4050', 'rgba(255,255,255,0.95)');
    G.myBubble.position.y = 2.75; G.myBubble.scale.multiplyScalar(0.8);
    G.player.root.add(G.myBubble); G.myBubbleT = 6;
    if (isChatOpen()) appendChat(msg);
  }
}
function chatLine(c) {
  const mine = c.uid === G.net.uid;
  const line = el('div', 'chat-line' + (mine ? ' mine' : ''));
  if (!mine) line.appendChild(txt('div', 'chat-name', c.name));
  line.appendChild(txt('div', 'chat-msg', c.text));
  return line;
}
// 단톡방이 열려 있으면 한 줄만 붙임 (입력 중인 글자와 키보드 유지)
function appendChat(c) {
  const log = $('chat-log');
  if (!log) return chatPanel(true);
  const empty = log.querySelector('.chat-empty'); if (empty) empty.remove();
  log.appendChild(chatLine(c));
  while (log.children.length > 40) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}
function inviteLink() { return location.origin + location.pathname + '?room=' + S.room.code; }
async function shareInvite() {
  const url = inviteLink();
  const text = `채팅도치에서 같이 놀자! 초대 코드 ${S.room.code}`;
  try { if (navigator.share) { await navigator.share({ title: '채팅도치', text, url }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); toast('초대 링크를 복사했어요. 친구에게 보내 주세요 📋', 3000); }
  catch { toast(`초대 코드 : ${S.room.code}`, 5000); }
}
function joinPanel(code) {
  openPanel('💬 친구 방 초대', body => {
    body.appendChild(txt('div', 'p-info', `초대 코드 ${code} 방에 들어갈까요?`));
    if (S.room) body.appendChild(txt('div', 'p-info', `지금 있는 방(${S.room.code})에서는 나오게 돼요.`));
    body.appendChild(el('div', 'p-info', '친구 방에 들어가면 내 집이 친구 마을로 이사 가요.<br>반려동물과 가구는 그대로예요.'));
    const row = el('div', 'center');
    const ok = el('button', 'p-btn green', '들어가기');
    ok.onclick = () => doJoin(code, ok);
    const no = el('button', 'p-btn gray', '다음에');
    no.onclick = () => { closePanel(); history.replaceState(null, '', urlNoRoom()); };
    row.append(ok, no); body.appendChild(row);
  });
}
async function doJoin(code, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '들어가는 중...'; }
  try {
    const r = await G.net.joinRoom(code);
    if (S.room && S.room.code !== r.code) await G.net.leave();
    S.room = r; S.clock = G.dn.serialize();
    closePanel();
    restart('친구 마을로 이사 가요 🚚');
  } catch (e) {
    toast(e.message || '들어가지 못했어요', 3500);
    if (btn) { btn.disabled = false; btn.textContent = '들어가기'; }
  }
}
async function doCreate(btn) {
  btn.disabled = true; btn.textContent = '만드는 중...';
  try {
    S.room = await G.net.createRoom(); S.clock = G.dn.serialize();
    closePanel();
    restart('새 방을 만들었어요 🏡');
  } catch (e) { toast(e.message || '방을 만들지 못했어요', 3500); btn.disabled = false; btn.textContent = '🏡 새 방 만들기'; }
}
function chatPanel(refresh = false) {
  const keepText = refresh && $('chat-in') ? $('chat-in').value : '';
  const hadFocus = refresh && document.activeElement && document.activeElement.id === 'chat-in';
  const build = body => {
    if (!G.net || !G.net.enabled) {
      body.appendChild(el('div', 'p-info', '친구들이 숲에 들어오면 여기서 다 같이 이야기할 수 있어요.<br>초대 코드를 아는 친구만 들어올 수 있고, 나쁜 말은 자동으로 가려져요.'));
      body.appendChild(el('div', 'p-info', '🚧 친구 기능은 어른이 서버를 연결하면 열려요!'));
      return;
    }
    if (!S.room) {
      body.appendChild(el('div', 'p-info', `방을 만들고 초대 코드를 친구에게 알려 주세요. 최대 ${MAX_SLOTS}명이 같은 숲에서 놀 수 있어요.<br>이름(닉네임)만 보이고, 나쁜 말과 전화번호는 자동으로 가려져요.`));
      const row = el('div', 'center');
      const mk = el('button', 'p-btn green', '🏡 새 방 만들기'); mk.onclick = () => doCreate(mk);
      const jn = el('button', 'p-btn', '🔑 초대 코드로 들어가기');
      jn.onclick = async () => {
        const c = normCode(await prompt('친구에게 받은 초대 코드 6글자', ''));
        if (!c) return;
        if (!validCode(c)) { toast('초대 코드는 6글자예요'); return; }
        doJoin(c);
      };
      row.append(mk, jn); body.appendChild(row);
      return;
    }
    // 방 안
    const head = el('div', 'chat-head');
    head.appendChild(txt('span', 'chat-code', `초대 코드 ${S.room.code}`));
    const sh = el('button', 'p-btn small', '📨 친구 부르기'); sh.onclick = shareInvite; head.appendChild(sh);
    body.appendChild(head);
    const mem = el('div', 'chat-members');
    const owner = G.net.meta && G.net.meta.owner;
    const on = new Set(G.friends ? G.friends.online().map(f => f.uid) : []);
    const entries = Object.entries(G.net.members).sort((a, b) => a[1].slot - b[1].slot);
    for (const [uid, m] of entries) {
      const me = uid === G.net.uid;
      const chip = el('span', 'mem' + (me || on.has(uid) ? ' on' : ''));
      chip.appendChild(txt('span', '', (me || on.has(uid) ? '🟢 ' : '⚪ ') + (me ? S.profile.name : cleanChat(m.name).slice(0, 8) || '친구') + (uid === owner ? ' 👑' : '') + (me ? ' (나)' : '')));
      if (G.net.isOwner && !me) {
        const k = el('button', 'kick', '내보내기');
        k.onclick = async () => { k.disabled = true; try { await G.net.kick(uid); toast('방에서 내보냈어요'); } catch { toast('내보내지 못했어요'); } };
        chip.appendChild(k);
      }
      mem.appendChild(chip);
    }
    body.appendChild(mem);
    const log = el('div', 'chat-log'); log.id = 'chat-log';
    if (!G.chat.length) log.appendChild(txt('div', 'chat-empty', '아직 이야기가 없어요. 먼저 인사해 볼까요? 👋'));
    for (const c of G.chat) log.appendChild(chatLine(c));
    body.appendChild(log);
    const form = el('div', 'chat-form');
    const inp = el('input'); inp.id = 'chat-in'; inp.maxLength = 40; inp.placeholder = '하고 싶은 말'; inp.autocomplete = 'off'; inp.value = keepText;
    const send = el('button', 'p-btn green', '보내기');
    const doSend = async () => {
      const v = inp.value.trim(); if (!v) return;
      if (performance.now() - (G.lastSay || 0) < 1200) { toast('조금 천천히 보내요 🙂'); return; }
      G.lastSay = performance.now();
      inp.value = '';
      try { await G.net.say(v); } catch { toast('보내지 못했어요. 인터넷을 확인해 주세요'); inp.value = v; }
    };
    send.onclick = doSend;
    inp.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) doSend(); };
    form.append(inp, send); body.appendChild(form);
    const quick = el('div', 'chat-quick');
    for (const q of ['안녕 👋', '같이 놀자!', '어디야?', '우리 집 와!', '잘 자 🌙', '고마워 💖']) {
      const b = txt('button', 'chip', q);
      b.onclick = () => { inp.value = q; doSend(); };
      quick.appendChild(b);
    }
    body.appendChild(quick);
    const foot = el('div', 'center');
    if (G.net.isOwner) {
      const locked = !!(G.net.meta && G.net.meta.locked);
      const lk = el('button', 'p-btn gray small', locked ? '🔓 새 친구 받기' : '🔒 방 잠그기 (새 친구 못 들어옴)');
      lk.onclick = async () => { await G.net.setLocked(!locked); chatPanel(true); };
      foot.appendChild(lk);
    }
    const lv = el('button', 'p-btn gray small', '🚪 방 나가기');
    lv.onclick = () => {
      if (lv.dataset.sure) { lv.disabled = true; G.net.leave().then(() => { S.room = null; S.clock = G.dn.serialize(); restart('혼자 놀기로 돌아가요 🏡'); }); return; }
      lv.dataset.sure = '1'; lv.textContent = '정말 나갈까요? 한 번 더 누르면 나가요';
    };
    foot.appendChild(lv);
    body.appendChild(foot);
    setTimeout(() => { log.scrollTop = log.scrollHeight; if (hadFocus) inp.focus(); }, 0);
  };
  if (refresh) { const body = $('panel-body'); body.innerHTML = ''; build(body); }
  else { setUnread(0); openPanel('💬 친구들 단톡방', build); }
}
onPress($('btn-chat'), () => chatPanel());

// 반려동물 (종류마다 한 마리씩)
onPress($('btn-pet'), () => petListPanel());
function petListPanel() {
  openPanel('🐾 우리 집 동물들', body => {
    if (!G.pets.length) body.appendChild(el('div', 'p-info', '아직 반려동물이 없어요. 입양해 볼까요?'));
    const grid = el('div', 'grid');
    G.pets.forEach(pet => {
      const def = pet.def;
      const where = pet.sub === 'carried' ? '안고 있어요' : pet.mode === 'walk' ? '산책 중' : '집에 있어요';
      const card = el('div', 'card', `<div class="emo">${def.emo}</div><div>${pet.data.name}</div><small>${where}${pet.data.sick ? ' 🤒' : ''}</small>`);
      card.onclick = () => petInfoPanel(pet);
      grid.appendChild(card);
    });
    const mine = G.birds.mine().filter(b => !b.away);
    mine.forEach(b => grid.appendChild(el('div', 'card', `<div class="emo">${b.stage === 'egg' ? '🥚' : '🐦'}</div><div>${b.stage === 'egg' ? '까치 알' : b.name || '까치'}</div><small>${b.stage === 'egg' ? '둥지에서 기다려요' : b.stage === 'baby' ? '아기 까치' : '어른 까치'}</small>`)));
    body.appendChild(grid);
    const row = el('div', 'center');
    if (PETS.some(p => !G.pets.some(x => x.def.id === p.id))) { const ad = el('button', 'p-btn', '➕ 새 친구 입양하기'); ad.onclick = () => adoptPanel(); row.appendChild(ad); }
    if (walkers().length) { const ew = el('button', 'p-btn green', '🏠 모두 산책 끝내기'); ew.onclick = () => { closePanel(); endWalk(); }; row.appendChild(ew); }
    body.appendChild(row);
    body.appendChild(el('div', 'p-info', '같은 동물은 한 마리씩만 키울 수 있어요 (까치는 여러 마리 가능).<br>동물을 두 번 톡톡 누르면 안아 줄 수 있어요.'));
  });
}
// replace : 바꿀 펫 (다른 동물로 바꾸기)
function adoptPanel(replace = null) {
  const pickSel = { type: null, color: null };
  const owned = new Set(G.pets.filter(p => p !== replace).map(p => p.def.id));
  openPanel(replace ? `🔄 ${replace.data.name}(을)를 다른 동물로` : '🐾 반려동물 입양하기', body => {
    const grid = el('div', 'grid');
    const btn = el('button', 'p-btn', replace ? '이 동물로 바꿀래요' : '이 친구로 입양할래요');
    btn.disabled = true; btn.style.opacity = 0.5;
    PETS.filter(p => !owned.has(p.id)).forEach(p => {
      const card = el('div', 'card', `<div class="emo">${p.emo}</div><div>${p.name}</div>`);
      const sws = el('div', 'sws');
      p.colors.forEach(([cid, cname, hex]) => {
        const sw = el('button', 'sw');
        sw.style.background = cid === 'rainbow' ? 'conic-gradient(#e8433f 0 33%, #ffd84d 0 66%, #3a6bd5 0)' : hexCss(hex);
        sw.title = cname;
        sw.onclick = ev => {
          ev.stopPropagation();
          grid.querySelectorAll('.card').forEach(c => c.classList.remove('on'));
          grid.querySelectorAll('.sw').forEach(c => c.classList.remove('on'));
          card.classList.add('on'); sw.classList.add('on');
          pickSel.type = p.id; pickSel.color = cid; sfx.click();
          btn.disabled = false; btn.style.opacity = 1;
          btn.textContent = replace ? `${cname} ${p.name}(으)로 바꿀래요` : `${cname} ${p.name} 입양할래요`;
        };
        sws.appendChild(sw);
      });
      card.onclick = () => sws.firstChild.onclick({ stopPropagation() {} });
      card.appendChild(sws);
      grid.appendChild(card);
    });
    body.appendChild(grid);
    const row = el('div', 'center'); row.appendChild(btn); body.appendChild(row);
    btn.onclick = async () => {
      if (!pickSel.type) return;
      const def = PETS.find(p => p.id === pickSel.type);
      closePanel();
      const name = await prompt(`${def.name} 이름을 지어 주세요`, replace ? replace.data.name : def.name);
      const now = Date.now();
      if (replace) {
        // 이름, 배부름, 행복은 그대로 두고 동물만 바꿈
        const d = replace.data;
        if (G.carry && G.carry.pet === replace) { G.carry = null; G.avatar.holding = false; }
        const wasWalking = replace.mode === 'walk';
        const pos = replace.pos.clone();
        replace.goHome();
        if (replace.scene) replace.scene.remove(replace.root);
        G.pets = G.pets.filter(p => p !== replace);
        d.type = def.id; d.color = pickSel.color; d.name = name || d.name;
        const np = createPet(d);
        if (wasWalking) startWalk(np, true); else np.pos.copy(pos);
        toast(`${d.name}(이)가 ${def.name}(으)로 바뀌었어요! ✨`, 3200);
      } else {
        const d = { uid: uid(), type: def.id, color: pickSel.color, name: name || def.name, adoptedAt: now, lastFed: now, lastPetted: now, sick: false };
        S.pets.push(d);
        createPet(d);
        toast(`${d.name}(이)가 우리 집에 왔어요! 🏠`, 3200);
        const h = homeFor(def.id);
        if (h) setTimeout(() => toast(`꾸미기에서 ${h.emo} ${h.name}을(를) 놓아 주면 거기서 놀고 자요`, 3500), 3400);
      }
      G.house.setPets(S.pets);
      persist(); sfx.happy();
    };
  });
}
function petInfoPanel(pet) {
  const d = pet.data, def = pet.def;
  openPanel(`${def.emo} ${d.name}`, body => {
    const hf = pet.hoursSinceFed, hp = pet.hoursSincePet;
    const food = hf < 3 ? '😋 배불러요' : hf < 12 ? '🙂 조금 배고파요' : '😢 배고파요';
    const mood = hp < 3 ? '💖 행복해요' : hp < 12 ? '🙂 좋아요' : '🥺 쓰다듬어 줘요';
    body.appendChild(el('div', 'pet-stat', `<span>${food}</span><span>${mood}</span>${d.sick ? '<span>🤒 아파요 (밥 주고 쓰다듬어 주면 나아요)</span>' : ''}`));
    body.appendChild(el('div', 'p-info', `집에 있는 밥그릇을 누르면 ${def.foodName}${def.food}을(를) 챙겨 줄 수 있어요.<br>${d.name}(이)를 톡 누르면 쓰다듬고, 두 번 톡톡 누르면 안아요. 꾹 누르면 이름을 바꿔요.`));
    const row = el('div', 'center');
    const walking = pet.mode === 'walk';
    const walk = el('button', 'p-btn green', walking ? '🏠 산책 끝내기' : '🌲 산책 가기');
    walk.onclick = () => { closePanel(); walking ? endWalk(pet) : startWalk(pet); };
    const rn = el('button', 'p-btn', '✏️ 이름 바꾸기');
    rn.onclick = () => { closePanel(); renamePet(pet); };
    const ch = el('button', 'p-btn gray', '🔄 다른 동물로 바꾸기');
    ch.onclick = () => adoptPanel(pet);
    row.append(walk, rn, ch);
    body.appendChild(row);
  });
}
async function renamePet(pet) {
  const name = await prompt('새 이름을 지어 주세요', pet.data.name);
  if (name) { pet.setName(name); persist(); toast(`이제 이름은 ${name}!`); }
}
async function renameBird(b) {
  const name = await prompt('까치 이름을 지어 주세요', b.name || '까치');
  if (name) { G.birds.rename(b, name); toast(`이제 이름은 ${name}!`); }
}

// 미니게임
onPress($('btn-game'), () => openPanel('🎮 미니게임', body => {
  const grid = el('div', 'grid');
  MINI_GAMES.forEach(gm => {
    const best = (S.best && S.best[gm.id]) || 0;
    const card = el('div', 'card', `<div class="emo">${gm.emo}</div><div>${gm.name}</div><small>${gm.desc}</small><small>🏆 최고 ${best}점</small>`);
    card.onclick = () => { closePanel(); startMini(gm.id); };
    grid.appendChild(card);
  });
  body.appendChild(grid);
}));
function startMini(id) {
  if (id !== 'baseball') return;
  if (!S.best) S.best = {};
  G.paused = true;
  const root = $('mini'); root.classList.remove('hidden');
  const shirt = '#' + ((COLORS7.find(c => c.id === S.profile.cloth) || COLORS7[2]).hex).toString(16).padStart(6, '0');
  new Baseball(root, {
    best: S.best.baseball || 0, shirt,
    onEnd: score => { S.best.baseball = Math.max(S.best.baseball || 0, score); persist(); },
    onExit: () => { root.classList.add('hidden'); G.paused = false; },
  });
}

// 창문 (집 안에서)
onPress($('btn-window'), () => windowPanel());
const WIN_NAMES = { fl: '문 왼쪽 창문', fr: '문 오른쪽 창문', l: '왼쪽 벽 창문', r: '오른쪽 벽 창문', b: '뒤쪽 벽 창문' };
function windowPanel() {
  openPanel('🪟 창문과 커튼', body => {
    const list = el('div', '');
    list.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    for (const [k, nm] of Object.entries(WIN_NAMES)) {
      const st = S.windows[k];
      const row = el('div', 'center');
      row.style.cssText += ';justify-content:space-between;gap:6px';
      const lb = el('span', '', nm); lb.style.cssText = 'min-width:110px;font-weight:bold';
      const w = el('button', 'p-btn' + (st.open ? ' green' : ' gray'), st.open ? '🪟 열림' : '🪟 닫힘');
      w.onclick = () => { st.open = !st.open; sfx.click(); applyWindowState(); windowPanel(); };
      const c = el('button', 'p-btn' + (st.cur ? ' green' : ' gray'), st.cur ? '커튼 열림' : '커튼 닫힘');
      c.onclick = () => { st.cur = !st.cur; sfx.click(); applyWindowState(); windowPanel(); };
      row.append(lb, w, c); list.appendChild(row);
    }
    body.appendChild(list);
    body.appendChild(el('div', 'p-info', '창문을 열면 바깥이 보여요. 창문과 커튼이 다 열려 있으면 까치가 밖으로 날아갈 수 있어요.<br>창문을 열어 두고 나가면 참새가 들어오기도 해요.'));
  });
}
function toggleWindowTap(key) {
  const st = S.windows[key];
  if (!st.cur) st.cur = true; else st.open = !st.open;
  sfx.click(); applyWindowState();
  toast(!st.cur ? '커튼을 닫았어요' : st.open ? '창문을 열었어요 🌿' : '창문을 닫았어요');
}

// 탈것
onPress($('btn-ride'), () => {
  if (G.mode === 'house') { toast('탈것은 밖에서 탈 수 있어요'); return; }
  openPanel('🚲 탈것', body => {
    const grid = el('div', 'grid');
    VEHICLES.forEach(v => {
      const card = el('div', 'card' + (G.player.riding === v.id ? ' on' : ''), `<div class="emo">${v.emo}</div><div>${v.name}</div>`);
      card.onclick = () => {
        closePanel(); sfx.click();
        G.player.mount(v.id);
        if (v.id === 'plane') { sfx.plane(); toast('⬆️ 버튼으로 하늘로 올라가요!'); }
        refreshButtons();
      };
      grid.appendChild(card);
    });
    body.appendChild(grid);
    if (G.player.riding) { const r = el('div', 'center'); const b = el('button', 'p-btn gray', '내리기'); b.onclick = () => { closePanel(); $('btn-dismount').dispatchEvent(new PointerEvent('pointerdown')); }; r.appendChild(b); body.appendChild(r); }
  });
});

// 설정
onPress($('btn-setting'), () => openPanel('⚙️ 설정', body => {
  const row = el('div', 'center');
  const re = el('button', 'p-btn', '👗 캐릭터와 집 다시 꾸미기');
  re.onclick = () => {
    closePanel();
    G.prevMode = G.mode; G.mode = 'customize';
    Object.assign(draft, S.profile);
    $('in-name').value = draft.name; $('in-house').value = draft.houseName;
    buildCustomize(); rebuildPreview(); setPreviewOffset();
    $('customize').classList.remove('hidden');
    $('hud').classList.add('hidden');
  };
  const night = el('button', 'p-btn gray', '🌙 테스트 : 지금 밤으로');
  night.onclick = () => { closePanel(); G.dn.forceNight(); };
  const gfx = el('button', 'p-btn gray', GFX.level === 'high' ? '✨ 그래픽 : 예쁘게 (폰이 느리면 눌러요)' : '⚡ 그래픽 : 빠르게 (누르면 예쁘게)');
  gfx.onclick = () => { persist(); setGfx(GFX.level === 'high' ? 'low' : 'high'); location.reload(); };
  const wbtn = el('button', 'p-btn gray', `${G.weather.info.icon} 테스트 : 날씨 바꾸기`);
  wbtn.onclick = () => { const ks = Object.keys(WEATHERS); G.weather.override = ks[(ks.indexOf(G.weather.kind) + 1) % ks.length]; closePanel(); };
  row.append(re, night, gfx, wbtn);
  body.appendChild(row);
  body.appendChild(el('div', 'p-info', '밤은 25분마다 와요. 모두 자면 바로 아침이 되고, 안 자면 5분 뒤에 아침이 돼요.'));
}));

// ───────── 집 꾸미기 ─────────
let furnColor = FURN_COLORS[0];
function buildCatalog() {
  const cat = $('catalog'); cat.innerHTML = '';
  const cols = el('div', ''); cols.style.cssText = 'display:flex;flex-direction:column;gap:4px;justify-content:center;flex:none';
  const r1 = el('div', ''), r2 = el('div', '');
  r1.style.cssText = r2.style.cssText = 'display:flex;gap:4px';
  FURN_COLORS.forEach((c, i) => {
    const s = el('button', 'sw' + (c === furnColor ? ' on' : ''));
    s.style.cssText += ';width:22px;height:22px;border-width:2px;background:' + hexCss(c);
    s.onclick = () => { furnColor = c; sfx.click(); buildCatalog(); if (G.house.selected) recolorSelected(c); };
    (i < 4 ? r1 : r2).appendChild(s);
  });
  cols.append(r1, r2); cat.appendChild(cols);
  [...FURNITURE, ...PET_HOMES].forEach(f => {
    const b = el('button', 'cat-item' + (f.for ? ' pet-home' : ''), `${f.emo}<small>${f.name}</small>`);
    b.onclick = () => {
      const s = G.house.freeSpot();
      const item = G.house.addItem({ uid: uid(), id: f.id, color: furnColor, x: s.x, z: s.z, rot: 0 });
      G.house.select(item); sfx.place();
      $('deco-edit').classList.remove('hidden');
    };
    cat.appendChild(b);
  });
}
function recolorSelected(c) { G.house.select(G.house.recolor(G.house.selected, c)); persist(); }
function setDeco(on) {
  G.deco = on;
  $('catalog').classList.toggle('hidden', !on);
  $('btn-deco').classList.toggle('hidden', on);
  $('deco-edit').classList.toggle('hidden', !on);
  if (!on && G.house) G.house.select(null);
  $('btn-jump').parentElement.style.visibility = on ? 'hidden' : '';
  $('btn-game').style.visibility = on ? 'hidden' : '';
}
onPress($('btn-deco'), () => { setDeco(true); toast('가구를 골라 놓고, 끌어서 옮겨요'); });
onPress($('btn-deco-done'), () => { setDeco(false); persist(); toast('예쁘게 꾸몄어요! 💕'); });
onPress($('btn-rot'), () => { const g = G.house.selected; if (!g) return; g.rotation.y += Math.PI / 4; g.userData.data.rot = g.rotation.y; sfx.place(); persist(); });
onPress($('btn-del'), () => { const g = G.house.selected; if (!g) return; if (G.house.removeItem(g)) { G.house.select(null); sfx.click(); } });

// ───────── 터치 (쓰다듬기, 밥그릇, 침대, 가구) ─────────
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function hit(x, y, objs) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(objs, true)[0] || null;
}
const ownerOf = (obj, roots) => { while (obj) { if (roots.includes(obj)) return obj; obj = obj.parent; } return null; };
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

let lastTap = { o: null, t: 0, x: 0, y: 0 };
const near = (pos, d) => Math.hypot(G.player.pos.x - pos.x, G.player.pos.z - pos.z) < d;
input.handlers.tap = (x, y) => {
  if (G.mode === 'customize' || !G.built) return;
  unlockAudio();
  const scene = G.mode === 'house' ? G.house.scene : G.forest;
  const petRoots = G.pets.filter(p => p.scene === scene && p.sub !== 'carried').map(p => p.root);
  const targets = [...petRoots];
  let birdRoots = [], wildRoots = [];
  if (G.mode === 'house') {
    if (G.house.bowlMesh) targets.push(G.house.bowlMesh);
    if (!G.deco) {
      const bed = G.house.bedItem(); if (bed) targets.push(bed);
      birdRoots = G.birds.tapTargets(); targets.push(...birdRoots);
      targets.push(...Object.values(G.house.wins).map(w => w.group));
      if (G.carry && G.carry.kind === 'egg') targets.push(...G.house.items.filter(i => i.userData.kind === 'nest'));
    }
    if (G.deco) targets.push(...G.house.items);
  } else { wildRoots = [...G.wild.tapTargets(), ...G.berries.tapTargets()]; targets.push(...wildRoots); }
  if (G.mode === 'house' && !G.deco) targets.push(...G.house.items.filter(i => i.userData.kind === 'sapling'));
  const now = performance.now();
  // 두 번째 톡은 동물이 움직여도 같은 자리면 같은 대상으로
  let o, dbl = false;
  if (lastTap.o && now - lastTap.t < 420 && Math.hypot(x - lastTap.x, y - lastTap.y) < 45 && targets.includes(lastTap.o)) { o = lastTap.o; dbl = true; }
  else {
    const h = hit(x, y, targets);
    if (!h) { if (G.deco) G.house.select(null); lastTap = { o: null, t: 0 }; return; }
    o = ownerOf(h.object, targets);
  }
  lastTap = { o: dbl ? null : o, t: now, x, y };

  const pet = G.pets.find(p => p.root === o);
  if (pet) {
    if (!near(pet.pos, 6)) { toast(`${pet.data.name}(이)에게 가까이 가요`); return; }
    if (!dbl) { pet.pat(); return; }
    // 두 번 톡톡 : 앵무새는 팔 ↔ 바닥, 다른 동물은 안기
    if (pet.def.id === 'parrot' && pet.mode === 'walk' && (pet.sub === 'perch' || pet.groundWalk)) { const m = pet.toggleGround(); if (m) toast(m); return; }
    if (pickUp({ kind: 'pet', pet })) { pet.pickUp(); toast(`${pet.data.name}(을)를 안았어요 🤗`); }
    return;
  }
  if (birdRoots.includes(o)) {
    const v = G.birds.viewOfRoot(o);
    if (!v) return;
    if (G.carry && G.carry.kind === 'berry' && v.b.kind === 'magpie' && v.b.stage !== 'egg') { useBerryOn(col => G.birds.dye(v.b, col), v.b.name || '까치'); return; }
    if (v.b.stage === 'egg') { toast(`아기 까치가 태어나기까지 ${Math.max(1, Math.ceil(10 - (Date.now() - v.b.placedAt) / 60000))}분 남았어요 🥚`); return; }
    if (dbl) { if (pickUp({ kind: 'home', obj: v.root, view: v })) { G.birds.take(v); toast(`${v.b.name || '새'}(을)를 안았어요 🤗`); } }
    else { sfx.tweet(0.06); G.floatH.add('💗', v.root.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 0.4); }
    return;
  }
  if (wildRoots.includes(o)) {
    if (o.userData.berry) {
      if (!near(o.getWorldPosition(new THREE.Vector3()), 6)) { toast('열매 나무에 조금 더 가까이 가요'); return; }
      if (G.carry) { toast('먼저 들고 있는 걸 내려놓아요'); return; }
      const color = G.berries.pick(o);
      if (!color) return;
      const bm = makeBerryMesh(color); G.forest.add(bm);
      pickUp({ kind: 'berry', obj: bm, data: { color } });
      toast(`${BERRY_NAMES[color]} 열매를 땄어요! 까치를 톡 누르면 까치 색이 바뀌어요`, 3500);
      persist();
      return;
    }
    if (G.carry && G.carry.kind === 'berry' && G.wild.magpies.some(m => m.m === o)) {
      if (!near(o.position, 8)) { toast('까치에게 조금 더 가까이 가요'); return; }
      useBerryOn(col => G.wild.dye(o, col), '까치'); return;
    }
    if (o.userData.wildEgg) {
      if (!near(o.getWorldPosition(new THREE.Vector3()), 8)) { toast('알에 조금 더 가까이 가요'); return; }
      if (G.carry) { toast('먼저 들고 있는 걸 내려놓아요'); return; }
      const data = G.wild.takeEgg(o);
      const egg = makeEgg(); G.forest.add(egg);
      pickUp({ kind: 'egg', obj: egg, data });
      toast('까치 알을 들었어요! 집에 가서 🪺 둥지에 놓아요', 3500);
      return;
    }
    if (!near(o.position, 5)) { toast('조금 더 가까이 가요'); return; }
    if (dbl) {
      const data = G.wild.takeBird(o);
      if (data) { G.forest.add(o); if (pickUp({ kind: 'wild', obj: o, data })) toast(data.kind === 'magpie' ? '까치를 안았어요! 집에 데려가면 함께 살아요' : '참새를 안았어요 🐦'); }
    } else sfx.tweet(0.05);
    return;
  }
  if (o === G.house.bowlMesh) {
    if (!G.pets.length) { toast('먼저 반려동물을 입양해요'); return; }
    if (G.house.bowlFull) toast('밥그릇이 벌써 가득해요');
    else { G.house.fillBowl(G.pets.length); sfx.eat(); toast(G.pets.length > 1 ? '모두 먹을 만큼 밥을 담았어요. 배고프면 먹을 거예요' : `${G.pets[0].def.foodName}${G.pets[0].def.food}을(를) 담았어요. 배고프면 먹을 거예요`); }
    return;
  }
  if (G.deco) { G.house.select(o); return; }
  if (o && o.userData.kind === 'nest' && G.carry && G.carry.kind === 'egg') { placeEgg(o); return; }
  if (o && o.userData.win) { toggleWindowTap(o.userData.win); return; }
  if (o && o.userData.kind === 'sapling') { waterSapling(o); return; }
  if (o && o.userData.kind === 'bed') sleep();
};
input.handlers.longpress = (x, y) => {
  if (G.mode === 'customize' || !G.built) return;
  const scene = G.mode === 'house' ? G.house.scene : G.forest;
  const roots = G.pets.filter(p => p.scene === scene).map(p => p.root);
  const birdRoots = G.mode === 'house' ? G.birds.tapTargets() : [];
  const winRoots = G.mode === 'house' ? Object.values(G.house.wins).map(w => w.group) : [];
  const all = [...roots, ...birdRoots, ...winRoots];
  const h = hit(x, y, all);
  if (!h) return;
  const o = ownerOf(h.object, all);
  const pet = G.pets.find(p => p.root === o);
  if (pet) { renamePet(pet); return; }
  const v = G.birds.viewOfRoot(o);
  if (v && v.b.stage !== 'egg' && v.b.kind === 'magpie') { renameBird(v.b); return; }
  if (o && o.userData.win) { const st = S.windows[o.userData.win]; st.cur = !st.cur; sfx.click(); applyWindowState(); toast(st.cur ? '커튼을 열었어요' : '커튼을 닫았어요'); }
};
input.handlers.dragStart = (x, y) => {
  if (G.mode !== 'house' || !G.deco) return false;
  const h = hit(x, y, G.house.items);
  if (!h) return false;
  const o = ownerOf(h.object, G.house.items);
  G.house.select(o);
  G.drag = o;
  return true;
};
input.handlers.dragMove = (x, y) => {
  if (!G.drag) return;
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  if (ray.ray.intersectPlane(floorPlane, p)) {
    G.drag.position.x = clamp(p.x, -5.4, 5.4);
    G.drag.position.z = clamp(p.z, -4.4, 4.2);
  }
};
input.handlers.dragEnd = () => {
  if (!G.drag) return;
  const d = G.drag.userData.data; d.x = G.drag.position.x; d.z = G.drag.position.z;
  G.drag = null; sfx.place(); persist();
};

// ───────── 매 프레임 ─────────
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
const camRay = new THREE.Ray(), camBox = new THREE.Box3(), camHit = new THREE.Vector3();
let clockTick = 0;

function frame() {
  requestAnimationFrame(frame);
  if (G.paused) { clock.getDelta(); return; } // 미니게임 중에는 숲을 멈춤
  const dt = Math.min(clock.getDelta(), 0.05);
  G.t += dt;
  const look = input.takeLook();

  if (G.mode === 'customize' || !G.built) {
    preview.yaw += look.dx * 0.01 + dt * 0.25;
    if (preview.avatar) { preview.avatar.root.rotation.y = preview.yaw; preview.avatar.update(dt, 0, false); }
    camera.position.set(0, 1.45, 4.6);
    camera.lookAt(0, 0.95, 0);
    renderer.render(preview.scene, camera);
    return;
  }

  const p = G.player;
  const mv = (G.sleeping) ? { x: 0, y: 0, mag: 0 } : input.getMove();
  G.dn.update(p.pos);
  const night = G.dn.night;
  G.weather.update(dt, G.mode === 'forest' ? camera.position : p.pos);
  updatePets(dt);
  G.birds.update(dt);

  if (G.mode === 'forest') {
    G.camYaw -= look.dx * 0.006;
    G.camPitch = clamp(G.camPitch + look.dy * 0.004, 0.05, 1.2);
    p.update(dt, mv, G.camYaw, G.world);
    pushFromAnimals(G.forest, G.wild.groundCircles());
    G.world.update(dt, G.t, night);
    G.berries.update(dt, G.t);
    G.wild.update(dt, p);
    if (G.friends) G.friends.update(dt, night);
    updateCarry();
    G.floatF.update(dt);

    // 카메라 (뒤에서 따라감)
    const dist = p.riding === 'plane' ? 12 : p.riding ? 8.5 : 7.5;
    camTarget.lerp(new THREE.Vector3(p.pos.x, p.pos.y + 1.3, p.pos.z), 1 - Math.pow(0.0001, dt));
    const cy = Math.sin(G.camPitch) * dist, ch = Math.cos(G.camPitch) * dist;
    const cx = camTarget.x + Math.sin(G.camYaw) * ch, cz = camTarget.z + Math.cos(G.camYaw) * ch;
    camera.position.set(cx, Math.max(camTarget.y + cy, height(cx, cz) + 0.6), cz);
    // 집 벽에 카메라가 묻히지 않게
    camRay.origin.copy(camTarget);
    camRay.direction.copy(camera.position).sub(camTarget);
    const camLen = camRay.direction.length(); camRay.direction.normalize();
    for (const bx of G.world.boxes) {
      camBox.min.set(bx.x0 - 0.3, -1, bx.z0 - 0.3); camBox.max.set(bx.x1 + 0.3, 6, bx.z1 + 0.3);
      const h = camRay.intersectBox(camBox, camHit);
      if (h) { const d = h.distanceTo(camTarget); if (d < camLen) camera.position.copy(camTarget).addScaledVector(camRay.direction, Math.max(1.2, d)); }
    }
    // 나무 기둥이 가리면 카메라를 앞으로
    if (!p.flying) {
      const ox = camTarget.x, oz = camTarget.z, vx = camera.position.x - ox, vz = camera.position.z - oz;
      const L2 = vx * vx + vz * vz;
      let best = 1;
      for (const tr of G.world.trees) {
        const wx = tr.x - ox, wz = tr.z - oz;
        if (Math.abs(wx) > dist + 2 || Math.abs(wz) > dist + 2) continue;
        const k = (wx * vx + wz * vz) / L2;
        if (k <= 0.05 || k >= 1) continue;
        const dx = wx - vx * k, dz = wz - vz * k;
        if (dx * dx + dz * dz < (tr.r + 0.35) ** 2) best = Math.min(best, k - 0.08);
      }
      if (best < 1) { const k = Math.max(0.18, best); camera.position.set(ox + vx * k, Math.max(camera.position.y * k + camTarget.y * (1 - k), height(ox + vx * k, oz + vz * k) + 0.6), oz + vz * k); }
    }
    canopyClear();
    camera.lookAt(camTarget);

    // 집 문 앞
    const nearDoor = !p.riding && Math.hypot(p.pos.x - G.world.door.x, p.pos.z - G.world.door.z) < 3;
    setContext(nearDoor ? 'enter' : null);
    renderer.render(G.forest, camera);
  } else {
    G.houseYaw = clamp(G.houseYaw - look.dx * 0.004, -0.7, 0.7);
    if (!G.sleeping) p.update(dt, mv, G.houseYaw, G.house.env);
    else p.avatar.update(dt, 0, false);
    if (!G.sleeping) pushFromAnimals(G.house.scene, G.birds.groundCircles());
    G.house.update(dt, night, G.weather);
    updateCarry();
    G.floatH.update(dt);
    camTarget.set(p.pos.x * 0.5, 1, p.pos.z * 0.4 - 0.5);
    const dist = 12.5, pitch = 0.68;
    camera.position.set(camTarget.x + Math.sin(G.houseYaw) * Math.cos(pitch) * dist, camTarget.y + Math.sin(pitch) * dist, camTarget.z + Math.cos(G.houseYaw) * Math.cos(pitch) * dist);
    camera.lookAt(camTarget);
    // 문 매트에 서면 나가기
    if (p.pos.z > 4.2 && !G.sleeping && !G.exiting) { G.exiting = true; exitHouse(); setTimeout(() => G.exiting = false, 1500); }
    setContext('exit');
    renderer.render(G.house.scene, camera);
  }

  if (G.net && S.room && G.friends) G.net.sendPos(packMe(G, walkers()));
  if (G.myBubbleT > 0 && (G.myBubbleT -= dt) <= 0) { G.player.root.remove(G.myBubble); G.myBubble = null; }

  clockTick -= dt;
  if (clockTick <= 0) {
    clockTick = 0.5;
    const l = G.dn.label();
    $('clock-icon').textContent = l.icon; $('clock-text').textContent = l.text;
    refreshButtons();
    G.pets.forEach(pt => pt.checkHealth());
    $('weather-icon').textContent = G.weather.info.icon;
  }
}

// 모든 펫 움직이기 (집에 있는 펫은 내가 밖에 있어도 움직임)
function updatePets(dt) {
  for (const pt of G.pets) pt.update(dt, pt.mode === 'walk' ? G.world : G.house.env, G.house);
  // 펫끼리 겹치지 않게
  for (let i = 0; i < G.pets.length; i++) for (let j = i + 1; j < G.pets.length; j++) {
    const a = G.pets[i], b = G.pets[j];
    if (a.scene !== b.scene || !a.onGround || !b.onGround) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), rr = 0.6;
    if (d < rr && d > 1e-4) { const k = (rr - d) / d / 2; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; }
  }
}
// 동물을 통과하지 않고 부딪히기
function pushFromAnimals(scene, extra = []) {
  const p = G.player.pos;
  if (G.player.riding === 'plane') return;
  const circles = [...extra];
  for (const pt of G.pets) if (pt.scene === scene && pt.onGround) circles.push({ x: pt.pos.x, z: pt.pos.z, r: pt.def.id === 'chick' || pt.def.id === 'parrot' ? 0.25 : 0.38, y: pt.pos.y });
  for (const c of circles) {
    if (c.y !== undefined && Math.abs(c.y - p.y) > 0.8) continue;
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), rr = c.r + 0.38;
    if (d < rr && d > 1e-4) { p.x = c.x + dx / d * rr; p.z = c.z + dz / d * rr; }
  }
}
// 카메라가 나뭇잎 속에 들어가면 나무 밖으로 당김
const _cv = new THREE.Vector3();
function inCanopy(tr, x, y, z) {
  let cy, rx, ry;
  if (tr.type === 'pine') { const s = tr.h / 6.6; cy = tr.y + 3.6 * s; rx = 2.1 * s; ry = 2.8 * s; }
  else { cy = tr.y + tr.cy; rx = tr.cr * 1.15; ry = tr.cry * 1.15; }
  const dx = (x - tr.x) / rx, dy = (y - cy) / ry, dz = (z - tr.z) / rx;
  return dx * dx + dy * dy + dz * dz < 1;
}
function canopyClear() {
  const c = camera.position;
  for (const tr of G.world.trees) {
    if (Math.abs(tr.x - c.x) > 5 || Math.abs(tr.z - c.z) > 5) continue;
    if (!inCanopy(tr, c.x, c.y, c.z)) continue;
    if (tr.type !== 'pine') {
      // 둥근 나무 : 잎 아래로 카메라를 내림 (나무 밑에서 올려다보기)
      const rx = tr.cr * 1.15, ry = tr.cry * 1.15;
      const hx = (c.x - tr.x) / rx, hz = (c.z - tr.z) / rx;
      const under = tr.y + tr.cy - ry * Math.sqrt(Math.max(0, 1 - hx * hx - hz * hz)) - 0.25;
      const gy = height(c.x, c.z) + 0.5;
      if (under > gy) { c.y = under; continue; }
    }
    // 소나무나 너무 낮은 잎 : 플레이어 쪽으로 당기되 너무 가깝지 않게
    let lo = 0, hi = 1;
    for (let i = 0; i < 8; i++) {
      const m = (lo + hi) / 2;
      _cv.lerpVectors(camTarget, c, m);
      if (inCanopy(tr, _cv.x, _cv.y, _cv.z)) hi = m; else lo = m;
    }
    c.lerpVectors(camTarget, c.clone(), Math.max(0.5, lo * 0.95));
  }
}
function setContext(c) {
  if (G.context === c) return;
  G.context = c;
  const b = $('btn-context');
  if (!c) { b.style.display = 'none'; return; }
  b.style.display = '';
  b.textContent = c === 'enter' ? `🏠 ${S.profile.houseName} 들어가기` : '🚪 나가기';
}

resize();
setPreviewOffset();
frame();

// 홈 화면 앱 (https에서만 동작)
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});

// 테스트용 핸들 (개발자 도구에서 사용)
window.__T = { chatPanel, addChat, waterSapling, startMini, camera, input, G, S, startWalk, endWalk, enterHouse, exitHouse, sleep, createPet, persist, pickUp, dropCarry, applyWindowState, sparrowVisit };
