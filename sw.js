const CACHE_NAME = 'soba-cache-v5';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(PRECACHE_URLS.map(url =>
        cache.add(url).catch(err => console.warn('Skip:', url, err))
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // فقط استدعاءات Firebase API (البيانات) لا تُخزَّن
  if (url.hostname === 'firestore.googleapis.com') return;
  if (url.hostname === 'firebaseinstallations.googleapis.com') return;
  if (url.hostname === 'identitytoolkit.googleapis.com') return;

  // كل شيء آخر: cache-first مع تحديث في الخلفية
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
