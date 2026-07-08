// Perfect Fit — bootstrap. Builds the pure game core ("backend"), hands it
// to the App shell ("frontend"), and exposes a read-only hook for tests.

import { GameCore } from './core/game-core.js';
import { createStorage } from './ui/storage.js';
import { App } from './ui/app.js';

const params = new URLSearchParams(location.search);
const testMode = params.get('test') === '1';
const seed =
  testMode && params.has('seed')
    ? Number(params.get('seed')) >>> 0
    : (Math.random() * 0xffffffff) >>> 0;

const core = new GameCore({ storage: createStorage(), seed });
const app = new App({ core, canvas: document.getElementById('game') });
app.start();

// Offline/PWA support on the plain web only. Never register inside the
// Capacitor shell (native apps ship their own files) and never during
// automated test runs (the install churn skews timing-sensitive rounds).
if (
  !testMode &&
  'serviceWorker' in navigator &&
  !window.Capacitor &&
  location.protocol.startsWith('http')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Read-only introspection for automated tests. Only exists with ?test=1 —
// production loads attach nothing to window.
if (testMode) {
  let lastResult = null;
  core.events.on('round:result', (r) => {
    lastResult = r;
  });
  window.__PF_TEST__ = Object.freeze({
    getState: () => core.getState(),
    getRoundView: () => core.getRoundView(),
    getCounters: () => app.counters,
    getLastResult: () => lastResult,
  });
}
