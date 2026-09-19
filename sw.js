const CACHE_NAME = 'soba-cache-v3';
const PRECACHE_URLS = ['./', './index.html', './manifest.json'];
const TIMEOUT_MS = 3000;

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

  // تجاهل Firebase و Google Fonts
  if (url.hostname.includes('firestore.googleapis.com')) return;
  if (url.hostname.includes('firebaseinstallations.googleapis.com')) return;
  if (url.hostname.includes('identitytoolkit.googleapis.com')) return;
  if (url.hostname.includes('gstatic.com')) return;
  if (url.hostname.includes('googleapis.com')) return;

  const isHTML =
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/') ||
    e.request.destination === 'document';

  if (isHTML) {
    // HTML: شبكة مع timeout 3 ثواني، ثم كاش
    e.respondWith(
      new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            caches.match(e.request).then(c => resolve(c || caches.match('./index.html')));
          }
        }, TIMEOUT_MS);

        fetch(e.request).then(res => {
          if (!settled && res && res.status === 200) {
            settled = true;
            clearTimeout(timer);
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
            resolve(res);
          }
        }).catch(() => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            caches.match(e.request).then(c => resolve(c || caches.match('./index.html')));
          }
        });
      })
    );
    return;
  }

  // باقي الملفات: cache-first
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
