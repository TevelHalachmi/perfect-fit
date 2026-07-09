// Service worker: cache-first for the whole game so the web version works
// offline and installs as a PWA. Registered on plain web only — never
// inside the Capacitor shell (native apps ship their own files).

const CACHE = 'perfect-fit-v4';
const ASSETS = [
  './',
  './index.html',
  './styles/main.css',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/fonts/baloo-2-latin-600-normal.woff2',
  './assets/fonts/baloo-2-latin-700-normal.woff2',
  './assets/fonts/baloo-2-latin-800-normal.woff2',
  './assets/icons/balloon.svg',
  './assets/icons/basket.svg',
  './assets/icons/bolt.svg',
  './assets/icons/bottle.svg',
  './assets/icons/butter.svg',
  './assets/icons/calendar.svg',
  './assets/icons/calendar-alt.svg',
  './assets/icons/check.svg',
  './assets/icons/chick.svg',
  './assets/icons/coin.svg',
  './assets/icons/collision.svg',
  './assets/icons/crown.svg',
  './assets/icons/cyclone.svg',
  './assets/icons/dress.svg',
  './assets/icons/fire.svg',
  './assets/icons/gear.svg',
  './assets/icons/ghost.svg',
  './assets/icons/hand.svg',
  './assets/icons/hand-right.svg',
  './assets/icons/haptics.svg',
  './assets/icons/heart.svg',
  './assets/icons/heart-black.svg',
  './assets/icons/heart-sparkle.svg',
  './assets/icons/home.svg',
  './assets/icons/hug.svg',
  './assets/icons/invert.svg',
  './assets/icons/lock.svg',
  './assets/icons/medal.svg',
  './assets/icons/medal-1.svg',
  './assets/icons/medal-2.svg',
  './assets/icons/medal-3.svg',
  './assets/icons/moneybag.svg',
  './assets/icons/moon.svg',
  './assets/icons/mountain.svg',
  './assets/icons/music.svg',
  './assets/icons/party.svg',
  './assets/icons/pig.svg',
  './assets/icons/progress.svg',
  './assets/icons/pulse.svg',
  './assets/icons/robot.svg',
  './assets/icons/rocket.svg',
  './assets/icons/satellite.svg',
  './assets/icons/seedling.svg',
  './assets/icons/share.svg',
  './assets/icons/shop.svg',
  './assets/icons/sound.svg',
  './assets/icons/sparkles.svg',
  './assets/icons/star.svg',
  './assets/icons/star-glow.svg',
  './assets/icons/steam.svg',
  './assets/icons/swords.svg',
  './assets/icons/target.svg',
  './assets/icons/ten.svg',
  './assets/icons/thumbs.svg',
  './assets/icons/timer.svg',
  './assets/icons/trash.svg',
  './assets/icons/trophy.svg',
  './assets/icons/wave.svg',
  './assets/icons/wind.svg',
  './assets/icons/worried.svg',
  './assets/icons/zen.svg',
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
  './src/net/config.js',
  './src/net/api.js',
  './src/net/sync.js',
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
  './src/ui/icons.js',
  './src/ui/share.js',
  './src/ui/screens/title.js',
  './src/ui/screens/results.js',
  './src/ui/screens/shop-ui.js',
  './src/ui/screens/settings.js',
  './src/ui/screens/progress.js',
  './src/ui/screens/leaderboard.js',
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
