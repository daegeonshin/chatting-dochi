import * as THREE from 'three';
import { HAIR_STYLES, HAIR_COLORS, EYE_COLORS, COLORS7, PETS, VEHICLES, FURNITURE, FURN_COLORS } from './data.js';
import { load, save } from './save.js';
import { Avatar } from './avatar.js';
import { World, height, HOUSE_POS } from './world.js';
import { Player } from './player.js';
import { Input, onPress } from './input.js';
import { DayNight } from './daynight.js';
import { House } from './house.js';
import { Pet, makePetModel } from './pets.js';
import { Wildlife } from './wildlife.js';
import { Floaters, clamp, lerp, angleLerp } from './utils.js';
import { sfx, unlockAudio } from './audio.js';
import { toon, outline, makeSkyDome, GFX, setGfx } from './look.js';
import { $, toast, openPanel, closePanel, prompt, transition, el, hexCss } from './ui.js';

const S = load();
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
  G.dn = new DayNight(G.forest, G.world, S.clock);
  G.dn.onChange = phase => {
    persist();
    if (phase === 'night') toast('밤이 되었어요 🌙 집에 가서 침대에서 자요', 4000);
    else { toast('아침이 밝았어요 ☀️', 3000); sfx.morning(); }
  };
  G.wild = new Wildlife(G.forest, G.world);
  G.avatar = new Avatar(S.profile);
  G.player = new Player(G.avatar);
  G.floatF = new Floaters(G.forest);
  G.house = new House(S.profile, S, { onSave: persist, toast, getPet: () => S.pet });
  G.floatH = new Floaters(G.house.scene);
  G.player.pos.set(HOUSE_POS.x, 0, HOUSE_POS.z + 5);
  G.player.yaw = 0; G.camYaw = 0.5;
  camTarget.set(G.player.pos.x, 1.3, G.player.pos.z);
  G.forest.add(G.player.root);
  if (S.pet) createPet();
  buildCatalog();
  setMode('forest');
  $('hud').classList.remove('hidden');
  setTimeout(() => {
    toast(`${S.profile.name}, 숲속 마을에 온 걸 환영해요!`, 3200);
    if (S.pet) {
      const last = new Date(S.pet.lastFed).toDateString();
      if (last !== new Date().toDateString()) setTimeout(() => toast(`${S.pet.name}(이)가 아침밥을 기다려요 🍽️`, 3500), 3600);
    }
  }, 600);
  setInterval(persist, 5000);
  addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
}

function applyProfile() {
  G.avatar.build(S.profile);
  G.world.rebuildHouse(S.profile);
  G.house.buildShell(S.profile);
}

function petCtx() {
  return { world: G.world, player: G.player, get floaters() { return G.mode === 'house' ? G.floatH : G.floatF; }, onSave: persist, toast };
}
function createPet() {
  G.pet = new Pet(S.pet, petCtx());
  G.pet.setScene(G.house.scene);
  const p = G.house.randomSpot(); G.pet.pos.set(p.x, 0, p.z);
  G.house.setPet(S.pet);
  G.pet.checkHealth();
}

function setMode(m) {
  G.mode = m;
  const inHouse = m === 'house';
  $('deco-bar').classList.toggle('hidden', !inHouse);
  if (!inHouse) setDeco(false);
  $('btn-ride').classList.toggle('disabled', inHouse);
  refreshButtons();
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
    if (G.pet && G.petWalking) { G.petWalking = false; G.pet.goHome(); G.pet.setScene(G.house.scene); G.pet.pos.set(1.2, 0, 3.6); }
    setMode('house');
  });
}
function exitHouse(withPet = false) {
  sfx.door();
  transition(() => {
    G.house.scene.remove(G.player.root);
    G.forest.add(G.player.root);
    G.player.pos.set(G.world.door.x, 0, G.world.door.z + 0.5); G.player.yaw = 0; G.player.vy = 0;
    G.camYaw = 0.5;
    camTarget.set(G.player.pos.x, 1.3, G.player.pos.z);
    G.avatar.pose = 'stand';
    setMode('forest');
    if (withPet) startWalk();
  });
}
function startWalk() {
  if (!G.pet) return;
  if (G.mode === 'house') { exitHouse(true); return; }
  G.petWalking = true;
  G.pet.setScene(G.forest);
  const p = G.player;
  G.pet.pos.set(p.pos.x - Math.sin(p.yaw) * 1.5, 0, p.pos.z - Math.cos(p.yaw) * 1.5);
  G.pet.pos.y = height(G.pet.pos.x, G.pet.pos.z);
  G.pet.startWalk();
  toast(`${S.pet.name}(이)랑 산책해요! ✨ 버튼을 눌러 봐요`, 3200);
  refreshButtons();
}
function endWalk() {
  if (!G.pet || !G.petWalking) return;
  G.petWalking = false;
  G.pet.goHome(); G.pet.setScene(G.house.scene);
  const s = G.house.randomSpot(); G.pet.pos.set(s.x, 0, s.z);
  toast(`${S.pet.name}(이)가 집으로 돌아갔어요`);
  refreshButtons();
}

// 잠자기 (지금은 혼자 접속이라 내가 자면 바로 아침)
function sleep() {
  if (!G.dn.isNight) { const l = G.dn.label(); toast(`밤에만 잘 수 있어요 (${l.text})`); return; }
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

// ───────── 버튼 ─────────
function refreshButtons() {
  const p = G.player;
  if (!p) return;
  const r = p.riding;
  $('btn-jump').style.display = (r === 'bike' || r === 'plane' || G.sleeping) ? 'none' : '';
  $('btn-up').style.display = $('btn-down').style.display = r === 'plane' ? '' : 'none';
  $('btn-dismount').style.display = r ? '' : 'none';
  const sp = $('btn-special');
  if (G.pet && G.petWalking && G.mode === 'forest') { sp.style.display = ''; sp.textContent = G.pet.specialLabel(); sp.style.width = 'auto'; sp.style.padding = '0 14px'; sp.style.borderRadius = '29px'; sp.style.fontSize = '16px'; }
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
onPress($('btn-special'), () => {
  if (!G.pet) return;
  const msg = G.pet.special();
  if (msg) toast(msg);
  refreshButtons();
});
onPress($('btn-context'), () => {
  const c = G.context;
  if (c === 'enter') enterHouse();
  else if (c === 'exit') exitHouse();
});

// 채팅 (4단계에서 친구 서버와 연결)
onPress($('btn-chat'), () => openPanel('💬 친구들 단톡방', body => {
  body.appendChild(el('div', 'p-info', '친구들이 숲에 들어오면 여기서 다 같이 이야기할 수 있어요.<br>초대 코드를 아는 친구만 들어올 수 있고, 나쁜 말은 자동으로 가려져요.'));
  body.appendChild(el('div', 'p-info', '🚧 친구 기능은 곧 열려요!'));
}));

// 반려동물
onPress($('btn-pet'), () => S.pet ? petInfoPanel() : adoptPanel());
function adoptPanel() {
  const pickSel = { type: null, color: null };
  openPanel('🐾 반려동물 입양하기', body => {
    const grid = el('div', 'grid');
    const btn = el('button', 'p-btn', '이 친구로 입양할래요');
    btn.disabled = true; btn.style.opacity = 0.5;
    PETS.forEach(p => {
      const card = el('div', 'card', `<div class="emo">${p.emo}</div><div>${p.name}</div>`);
      const sws = el('div', 'sws');
      p.colors.forEach(([cid, cname, hex]) => {
        const s = el('button', 'sw');
        s.style.background = cid === 'rainbow' ? 'conic-gradient(#e8433f 0 33%, #ffd84d 0 66%, #3a6bd5 0)' : hexCss(hex);
        s.title = cname;
        s.onclick = ev => {
          ev.stopPropagation();
          grid.querySelectorAll('.card').forEach(c => c.classList.remove('on'));
          grid.querySelectorAll('.sw').forEach(c => c.classList.remove('on'));
          card.classList.add('on'); s.classList.add('on');
          pickSel.type = p.id; pickSel.color = cid; sfx.click();
          btn.disabled = false; btn.style.opacity = 1;
          btn.textContent = `${cname} ${p.name} 입양할래요`;
        };
        sws.appendChild(s);
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
      const name = await prompt(`${def.name} 이름을 지어 주세요`, def.name);
      const now = Date.now();
      S.pet = { type: def.id, color: pickSel.color, name: name || def.name, adoptedAt: now, lastFed: now, lastPetted: now, bowlFull: false, sick: false };
      createPet();
      persist();
      sfx.happy();
      toast(`${S.pet.name}(이)가 우리 집에 왔어요! 🏠`, 3200);
    };
  });
}
function petInfoPanel() {
  const pet = G.pet, d = S.pet, def = PETS.find(p => p.id === d.type);
  openPanel(`${def.emo} ${d.name}`, body => {
    const hf = pet.hoursSinceFed, hp = pet.hoursSincePet;
    const food = hf < 3 ? '😋 배불러요' : hf < 12 ? '🙂 조금 배고파요' : '😢 배고파요';
    const mood = hp < 3 ? '💖 행복해요' : hp < 12 ? '🙂 좋아요' : '🥺 쓰다듬어 줘요';
    const stat = el('div', 'pet-stat', `<span>${food}</span><span>${mood}</span>${d.sick ? '<span>🤒 아파요 (밥 주고 쓰다듬어 주면 나아요)</span>' : ''}`);
    body.appendChild(stat);
    body.appendChild(el('div', 'p-info', `집에 있는 밥그릇을 누르면 ${def.foodName}${def.food}을(를) 챙겨 줄 수 있어요.<br>${d.name}(이)를 톡 누르면 쓰다듬고, 꾹 누르면 이름을 바꿔요.`));
    const row = el('div', 'center');
    const walk = el('button', 'p-btn green', G.petWalking ? '🏠 산책 끝내기' : '🌲 산책 가기');
    walk.onclick = () => { closePanel(); G.petWalking ? endWalk() : startWalk(); };
    const rn = el('button', 'p-btn', '✏️ 이름 바꾸기');
    rn.onclick = async () => { closePanel(); renamePet(); };
    row.append(walk, rn);
    body.appendChild(row);
  });
}
async function renamePet() {
  if (!G.pet) return;
  const name = await prompt('새 이름을 지어 주세요', S.pet.name);
  if (name) { G.pet.setName(name); persist(); toast(`이제 이름은 ${name}!`); }
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
  row.append(re, night, gfx);
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
  FURNITURE.forEach(f => {
    const b = el('button', 'cat-item', `${f.emo}<small>${f.name}</small>`);
    b.onclick = () => {
      const s = G.house.freeSpot();
      const item = G.house.addItem({ id: f.id, color: furnColor, x: s.x, z: s.z, rot: 0 });
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

input.handlers.tap = (x, y) => {
  if (G.mode === 'customize' || !G.built) return;
  unlockAudio();
  const targets = [];
  if (G.pet && G.pet.scene === (G.mode === 'house' ? G.house.scene : G.forest)) targets.push(G.pet.root);
  if (G.mode === 'house') {
    if (G.house.bowlMesh) targets.push(G.house.bowlMesh);
    if (!G.deco) { const bed = G.house.bedItem(); if (bed) targets.push(bed); }
    if (G.deco) targets.push(...G.house.items);
  }
  const h = hit(x, y, targets);
  if (!h) { if (G.deco) G.house.select(null); return; }
  const o = ownerOf(h.object, targets);
  if (G.pet && o === G.pet.root) {
    if (Math.hypot(G.player.pos.x - G.pet.pos.x, G.player.pos.z - G.pet.pos.z) > 6) { toast(`${S.pet.name}(이)에게 가까이 가요`); return; }
    G.pet.pat();
  } else if (o === G.house.bowlMesh) {
    if (S.pet.bowlFull) toast('밥그릇이 벌써 가득해요');
    else { G.house.fillBowl(); sfx.eat(); const def = PETS.find(p => p.id === S.pet.type); toast(`${def.foodName}${def.food}을(를) 담았어요. 배고프면 먹을 거예요`); }
  } else if (G.deco) { G.house.select(o); }
  else if (o && o.userData.kind === 'bed') sleep();
};
input.handlers.longpress = (x, y) => {
  if (!G.pet || G.mode === 'customize') return;
  const h = hit(x, y, [G.pet.root]);
  if (h) renamePet();
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

  if (G.mode === 'forest') {
    G.camYaw -= look.dx * 0.006;
    G.camPitch = clamp(G.camPitch + look.dy * 0.004, 0.05, 1.2);
    p.update(dt, mv, G.camYaw, G.world);
    G.world.update(dt, G.t, night);
    G.wild.update(dt, p);
    if (G.pet) G.pet.update(dt, G.petWalking ? G.world : G.house.env, G.house);
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
    camera.lookAt(camTarget);

    // 집 문 앞
    const nearDoor = !p.riding && Math.hypot(p.pos.x - G.world.door.x, p.pos.z - G.world.door.z) < 3;
    setContext(nearDoor ? 'enter' : null);
    renderer.render(G.forest, camera);
  } else {
    G.houseYaw = clamp(G.houseYaw - look.dx * 0.004, -0.7, 0.7);
    if (!G.sleeping) p.update(dt, mv, G.houseYaw, G.house.env);
    else p.avatar.update(dt, 0, false);
    G.house.update(dt, night);
    if (G.pet) G.pet.update(dt, G.house.env, G.house);
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

  clockTick -= dt;
  if (clockTick <= 0) {
    clockTick = 0.5;
    const l = G.dn.label();
    $('clock-icon').textContent = l.icon; $('clock-text').textContent = l.text;
    refreshButtons();
    if (G.pet) G.pet.checkHealth();
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
window.__T = { G, S, startWalk, endWalk, enterHouse, exitHouse, sleep, createPet, persist };
