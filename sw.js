const CACHE = 'vocab-json-v7.956'; // ↑ чуть сменил версию, чтобы sw обновился
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys.map(k => k !== CACHE && caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // 🔹 Не трогаем ничего, кроме GET — пусть браузер сам обрабатывает POST/PUT и т.п.
  if (e.request.method !== 'GET') {
    return;
  }

  const url = new URL(e.request.url);

  // 🔹 Особая логика только для words.json
  if (url.pathname.endsWith('/words.json') || url.pathname.endsWith('words.json')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 🔹 Всё остальное кэшируем по стандартной схеме
  e.respondWith(
    caches.match(e.request).then(r =>
      r ||
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
    )
  );
});
