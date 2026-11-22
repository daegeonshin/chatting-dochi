// 오프라인 캐시 (https 주소에서만 동작). 내 사이트 파일만 저장하고, 친구 서버(Firebase) 통신은 건드리지 않음
const C = 'forest-v3';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  // 브라우저 캐시를 건너뛰고 늘 새 파일을 확인 (수정본이 바로 보이게)
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
