// Service worker: permite instalar Dino Refugio y jugar sin conexión.
// Estrategia: red primero (siempre la versión más nueva si hay internet) y,
// sin conexión, lo que está en caché. Las fuentes se guardan al usarse.
// La lista de archivos se revisa en tests/unit/pwa.test.js.

const CACHE = 'dino-refugio-v2';
const ASSETS = [
  './',
  './css/styles.css',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon.svg',
  './index.html',
  './js/audio.js',
  './js/data/cosmetics.js',
  './js/data/quiz.js',
  './js/data/species.js',
  './js/data/world.js',
  './js/main.js',
  './js/render/dino-svg.js',
  './js/store.js',
  './js/systems/calendar.js',
  './js/systems/contest.js',
  './js/systems/dig.js',
  './js/systems/game.js',
  './js/systems/genetics.js',
  './js/systems/missions.js',
  './js/systems/rewards.js',
  './js/ui/dom.js',
  './js/ui/postcard.js',
  './js/ui/views/contest.js',
  './js/ui/views/dino-sheet.js',
  './js/ui/views/dinopedia.js',
  './js/ui/views/excavate.js',
  './js/ui/views/more.js',
  './js/ui/views/nursery.js',
  './js/ui/views/park.js',
  './js/ui/views/quiz.js',
  './js/ui/views/rewards.js',
  './js/ui/views/starter.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))),
  );
});
