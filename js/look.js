import * as THREE from 'three';

// ───────── 그래픽 품질 ─────────
// high : 그림자 + 윤곽선 전부 / low : 그림자 없음, 나무 윤곽선 없음
export const GFX = { level: localStorage.getItem('cd-gfx') || 'high' };
export function setGfx(level) { GFX.level = level; localStorage.setItem('cd-gfx', level); }

// ───────── 말랑한 툰 재질 ─────────
// 부드러운 3단 명암 (LinearFilter라 경계가 살짝 번짐)
const gradTex = (() => {
  const d = new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 242, 242, 242, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();

// 가장자리가 은은하게 밝아지는 림 라이트 (낮에는 하늘색, 밤에는 보라)
export const RIM = { value: new THREE.Color(0.32, 0.34, 0.4) };

function addRim(m) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uRim = RIM;
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      `{ vec3 vd = normalize(vViewPosition); float rf = 1.0 - clamp(dot(normal, vd), 0.0, 1.0);
         outgoingLight += uRim * smoothstep(0.55, 1.0, rf) * (0.4 + diffuseColor.rgb * 0.6); }
       #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'cd-rim';
  return m;
}

export function toon(params = {}) {
  return addRim(new THREE.MeshToonMaterial({ gradientMap: gradTex, ...params }));
}

// ───────── 윤곽선 (뒤집힌 껍질) ─────────
const lineCache = new Map();
function lineMat(w, color) {
  const key = w + '|' + color;
  if (!lineCache.has(key)) {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normal * ${w.toFixed(4)};`);
    };
    m.customProgramCacheKey = () => 'cd-line-' + w.toFixed(4);
    lineCache.set(key, m);
  }
  return lineCache.get(key);
}

const _s = new THREE.Vector3();
// obj 아래 모든 메시에 윤곽선 붙이기. 아주 작은 부품(눈동자, 수염), 투명한 것, noOutline 표시는 건너뜀
export function outline(obj, w = 0.02, color = 0x4a3048, minSize = 0.07) {
  const list = [];
  obj.traverse(o => {
    if (!o.isMesh || o.userData.isOutline || o.userData.noOutline) return;
    const m = o.material;
    if (!m || Array.isArray(m) || m.transparent || m.isMeshBasicMaterial || m.isPointsMaterial) return;
    if (o.children.some(c => c.userData.isOutline)) return;
    const g = o.geometry;
    if (!g.attributes.normal) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    o.getWorldScale(_s);
    if (!o.isInstancedMesh && g.boundingSphere.radius * Math.max(_s.x, _s.y, _s.z) < minSize) return;
    list.push(o);
  });
  for (const o of list) {
    let l;
    if (o.isInstancedMesh) {
      l = new THREE.InstancedMesh(o.geometry, lineMat(w, color), o.count);
      l.instanceMatrix = o.instanceMatrix;
      l.count = o.count;
      l.frustumCulled = o.frustumCulled;
    } else {
      l = new THREE.Mesh(o.geometry, lineMat(w, color));
    }
    l.userData.isOutline = true;
    l.raycast = () => {};
    o.add(l);
  }
  return obj;
}

// 그림자 설정 (품질 낮음이면 끔)
export function castAll(obj, cast = true, receive = false) {
  obj.traverse(o => { if (o.isMesh && !o.userData.isOutline && !(o.material && o.material.transparent)) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

// ───────── 그라데이션 하늘 ─────────
export function makeSkyDome() {
  const u = {
    top: { value: new THREE.Color(0x6fc2ff) },
    mid: { value: new THREE.Color(0xbfe6ff) },
    bot: { value: new THREE.Color(0xfff0f6) },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top, mid, bot; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, bot, smoothstep(0.0, -0.25, h));
        c = mix(bot, c, smoothstep(-0.02, 0.12, h) * 0.75 + 0.25);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), m);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.userData.u = u;
  return dome;
}

// ───────── 뭉게구름 ─────────
export function makeClouds(scene, count = 16, seed = 7) {
  let s = seed;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const cmat = toon({ color: 0xffffff, emissive: 0x6a7090, fog: false });
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 16, 12);
  const list = [];
  for (let i = 0; i < count; i++) {
    const c = new THREE.Group();
    const n = 4 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const b = new THREE.Mesh(geo, cmat);
      const sz = 6 + r() * 7 * (1 - Math.abs(k - n / 2) / n);
      b.scale.set(sz, sz * 0.78, sz * 0.9);
      b.position.set((k - n / 2) * 7 + r() * 3, r() * 3, r() * 5);
      c.add(b);
    }
    const flat = new THREE.Mesh(geo, cmat); flat.scale.set(n * 4.5, 3, 7); flat.position.y = -2.5; c.add(flat);
    const a = r() * Math.PI * 2, d = 170 + r() * 160;
    c.position.set(Math.cos(a) * d, 70 + r() * 50, Math.sin(a) * d);
    c.rotation.y = r() * Math.PI;
    c.userData.speed = 0.6 + r() * 0.8;
    group.add(c); list.push(c);
  }
  outline(group, 0.25, 0x9fb4d8, 0);
  scene.add(group);
  group.userData.mat = cmat;
  group.userData.update = (dt) => {
    for (const c of list) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 340) c.position.x -= 680;
    }
  };
  return group;
}

// ───────── 반짝이는 물 ─────────
export const TIME = { value: 0 };
export function waterMat() {
  const m = new THREE.MeshToonMaterial({ gradientMap: gradTex, color: 0x5ccbf7, transparent: true, opacity: 0.85, emissive: 0x1a4a66 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = TIME;
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uT; varying vec3 vWp;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
      `{ float a = sin(vWp.x * 0.9 + uT * 1.1) * sin(vWp.z * 0.8 - uT * 0.8);
         float b = sin((vWp.x + vWp.z) * 0.5 - uT * 0.6);
         outgoingLight += vec3(0.9, 0.97, 1.0) * smoothstep(0.75, 0.95, a * 0.7 + b * 0.3) * 0.45; }
       #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'cd-water';
  return m;
}
