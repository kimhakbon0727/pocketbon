const CACHE = 'pocketbon-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // 1. HTTP/HTTPS 요청이 아니거나 외부 날씨 API 요청이면 캐싱하지 않고 통과
  if (!e.request.url.startsWith('http')) return;
  if (e.request.url.includes('open-meteo.com') || e.request.url.includes('geocoding-api')) return;

  // 2. Network-First (네트워크 우선) 전략 적용
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // 네트워크 요청이 성공하면, 최신 파일을 캐시에 한 번 더 업데이트하고 리턴
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE).then(cache => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // 💡 중요: 오프라인(인터넷 단절) 상태일 때만 저장해둔 캐시를 꺼내줌!
        return caches.match(e.request);
      })
  );
});
