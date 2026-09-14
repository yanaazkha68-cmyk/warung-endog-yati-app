// Service worker offline-first. Karena Vite membuat nama file ber-hash saat
// build, cache diisi secara dinamis (runtime caching) memakai strategi
// "cache falling back to network, lalu network mengisi cache" — bukan daftar
// file statis — supaya tetap benar walau nama bundle berubah tiap build.

const CACHE = 'wey-cache-v3';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached || caches.match('/index.html'));
      // Tampilkan versi cache dulu (kalau ada) untuk kecepatan/offline,
      // sambil tetap memperbarui cache di latar belakang.
      return cached || network;
    })
  );
});
