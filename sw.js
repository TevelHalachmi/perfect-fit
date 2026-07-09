// Service worker: cache-first for the whole game so the web version works
// offline and installs as a PWA. Registered on plain web only — never
// inside the Capacitor shell (native apps ship their own files).

const CACHE = 'perfect-fit-v2';
const ASSETS = [
  './',
  './index.html',
  './styles/main.css',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './src/main.js',
  './src/core/constants.js',
  './src/core/events.js',
  './src/core/rng.js',
  './src/core/difficulty.js',
  './src/core/accuracy.js',
  './src/core/round.js',
  './src/core/economy.js',
  './src/core/catalog.js',
  './src/core/shop.js',
  './src/core/save.js',
  './src/core/game-core.js',
  './src/core/daily.js',
  './src/core/missions.js',
  './src/core/achievements.js',
  './src/ui/app.js',
  './src/ui/renderer.js',
  './src/ui/shapes.js',
  './src/ui/faces.js',
  './src/ui/draw-shape.js',
  './src/ui/skins.js',
  './src/ui/particles.js',
  './src/ui/effects.js',
  './src/ui/audio.js',
  './src/ui/haptics.js',
  './src/ui/input.js',
  './src/ui/hud.js',
  './src/ui/storage.js',
  './src/ui/banners.js',
  './src/ui/share.js',
  './src/ui/screens/title.js',
  './src/ui/screens/results.js',
  './src/ui/screens/shop-ui.js',
  './src/ui/screens/settings.js',
  './src/ui/screens/progress.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(event.request).then((res) => {
          // cache successful same-origin responses for next time
          if (res.ok && new URL(event.request.url).origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
    )
  );
});
