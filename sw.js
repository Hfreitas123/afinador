/* Service worker: guarda a aplicação em cache para funcionar offline. */
const CACHE = 'afinador-v1.1.1';
const ASSETS = ['./', './index.html', './style.css', './app.js', './pitch.js', './tunings.js',
  './songs.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  // Sem skipWaiting: a versão nova fica em espera até o utilizador aceitar,
  // para não trocar ficheiros por baixo de uma página já aberta.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

// A página pede a activação imediata quando o utilizador toca em "Actualizar".
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(e.request).then((res) => {
        if (res && res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
