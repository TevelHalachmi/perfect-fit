// Perfect Fit — bootstrap. Builds the pure game core ("backend"), hands it
// to the App shell ("frontend"), and exposes a read-only hook for tests.

import { GameCore } from './core/game-core.js';
import { createStorage } from './ui/storage.js';
import { App } from './ui/app.js';
import { renderShareCard } from './ui/share.js';

const params = new URLSearchParams(location.search);
const testMode = params.get('test') === '1';
const seed =
  testMode && params.has('seed')
    ? Number(params.get('seed')) >>> 0
    : (Math.random() * 0xffffffff) >>> 0;

// Local calendar date, Wordle-style: everyone shares a daily per their own
// day. Tests may pin the date (?date=YYYY-MM-DD, honored only with ?test=1).
function localDateKey() {
  const now = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
const getDateKey = () =>
  testMode && params.has('date') ? params.get('date') : localDateKey();

const core = new GameCore({ storage: createStorage(), seed, getDateKey });
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
  let lastRunEnd = null;
  core.events.on('round:result', (r) => {
    lastResult = r;
  });
  core.events.on('run:end', (r) => {
    lastRunEnd = r;
  });
  window.__PF_TEST__ = Object.freeze({
    getState: () => core.getState(),
    getRoundView: () => core.getRoundView(),
    getCounters: () => app.counters,
    getLastResult: () => lastResult,
    getLastRunEnd: () => lastRunEnd,
    getDaily: () => core.getDaily(),
    getMissions: () => core.getMissions(),
    getAchievements: () => core.getAchievements(),
    getStats: () => core.getStats(),
    // returns a PNG data URL so the e2e can size-check and save the card
    makeShareCard: () => {
      const result = lastRunEnd ?? { mode: 'normal', levelReached: 7, bestStreak: 5, runCoins: 88, bestAccuracy: 98.2 };
      return renderShareCard({ result, state: core.getState() }).toDataURL('image/png');
    },
  });
}
