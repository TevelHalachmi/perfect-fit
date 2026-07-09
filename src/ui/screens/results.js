// Run-over screen with mode variants (normal / daily / zen), coin count-up
// and a share card. The card + blob are pre-rendered on show() because iOS
// voids the tap gesture if the share sheet waits on async work.

import { renderShareCard, buildShareText, cardToBlob, shareResult, PLAY_URL } from '../share.js';
import { showBanner } from '../banners.js';

const TAUNTS = [
  [2, 'The shapes believe in you. Barely.'],
  [5, 'Warming up! The circle is mildly impressed.'],
  [9, 'Respectable. The triangle demands more.'],
  [14, 'Now THAT was some quality fitting.'],
  [20, 'Precision machine. The shapes whisper your name.'],
  [26, 'Legendary. Even the blob is speechless.'],
  [Infinity, 'ABSOLUTE PERFECTION. Touch grass, champion.'],
];

export function createResultsScreen(el, { core, audio, onRetry, onShop, onHome }) {
  el.innerHTML = `
    <div class="results-card">
      <div class="new-best-tag hidden" id="res-newbest">NEW BEST!</div>
      <div class="results-title" id="res-title">RUN OVER!</div>
      <div class="results-taunt" id="res-taunt"></div>
      <div class="stat-row" id="res-row-main"><span id="res-main-label">Level reached</span><span class="stat-value" id="res-level">1</span></div>
      <div class="stat-row highlight"><span>Coins earned</span><span class="stat-value" id="res-coins">0</span></div>
      <div class="stat-row hidden" id="res-bonus-row"><span>🗓️ Daily streak bonus</span><span class="stat-value" id="res-bonus">0</span></div>
      <div class="stat-row"><span>Best streak</span><span class="stat-value" id="res-streak">0</span></div>
      <div class="btn-row" style="margin-top:6px">
        <button class="btn btn-mint" id="btn-retry">RETRY</button>
        <button class="btn btn-violet" id="btn-share">📤 SHARE</button>
      </div>
      <div class="btn-row">
        <button class="btn btn-violet btn-small" id="btn-res-shop">🛍️ SHOP</button>
        <button class="btn btn-ghost btn-small" id="btn-res-home">🏠 HOME</button>
      </div>
    </div>
  `;
  el.querySelector('#btn-retry').addEventListener('click', onRetry);
  el.querySelector('#btn-res-shop').addEventListener('click', onShop);
  el.querySelector('#btn-res-home').addEventListener('click', onHome);

  let countUpTimer = 0;
  let lastResult = null;
  let cachedBlob = null;
  let sharing = false;

  el.querySelector('#btn-share').addEventListener('click', async () => {
    if (!lastResult || sharing) return;
    sharing = true;
    const outcome = await shareResult({ blob: cachedBlob, text: buildShareText(lastResult) });
    sharing = false;
    if (outcome === 'copied') showBanner('🔗 LINK COPIED — PASTE IT ANYWHERE!', 'gold');
    else if (outcome === 'shown') showBanner(PLAY_URL, 'gold');
    if (outcome !== 'aborted') core.recordShare();
  });

  function animateCoins(target) {
    const out = el.querySelector('#res-coins');
    clearInterval(countUpTimer);
    if (target <= 0) {
      out.textContent = '0';
      return;
    }
    const start = performance.now();
    const dur = Math.min(1400, 350 + target * 12);
    let lastTick = -1;
    countUpTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      out.textContent = String(Math.round(target * eased));
      const tick = Math.floor(eased * 12); // accelerating coin cascade
      if (tick !== lastTick) {
        lastTick = tick;
        audio?.coinTick(tick);
      }
      if (k >= 1) clearInterval(countUpTimer);
    }, 1000 / 30);
  }

  return {
    el,
    // Re-showable without a payload (e.g. returning from the shop): the
    // last run's numbers are kept, and only fresh results animate.
    show(result) {
      const fresh = Boolean(result);
      if (fresh) lastResult = result;
      const r = lastResult ?? { mode: 'normal', levelReached: 1, runCoins: 0, bestStreak: 0, isNewBest: false };

      const daily = r.mode === 'daily' && r.daily;
      const zen = r.mode === 'zen';
      el.querySelector('#res-title').textContent = daily
        ? `DAILY #${r.daily.number}`
        : zen
          ? 'ZEN SESSION'
          : 'RUN OVER!';
      el.querySelector('#res-taunt').textContent = zen
        ? `${r.successes} shapes fitted. Deep breaths.`
        : (daily && r.daily.streak >= 2 ? `🔥 ${r.daily.streak}-day streak! ` : '') +
          TAUNTS.find(([max]) => r.levelReached < max)[1];

      el.querySelector('#res-main-label').textContent = 'Level reached';
      el.querySelector('#res-level').textContent = String(r.levelReached);
      el.querySelector('#res-streak').textContent = String(r.bestStreak);
      el.querySelector('#res-newbest').classList.toggle('hidden', !r.isNewBest);

      const bonusRow = el.querySelector('#res-bonus-row');
      bonusRow.classList.toggle('hidden', !daily);
      if (daily) el.querySelector('#res-bonus').textContent = `+${r.daily.bonus}`;

      const retry = el.querySelector('#btn-retry');
      retry.classList.toggle('hidden', Boolean(daily)); // one attempt per day
      retry.textContent = zen ? 'AGAIN' : 'RETRY';

      el.classList.remove('hidden');
      if (fresh) {
        animateCoins(r.runCoins + (daily ? r.daily.bonus : 0));
        // pre-render the share card while the user reads the numbers
        cachedBlob = null;
        cardToBlob(renderShareCard({ result: r, state: core.getState() })).then((blob) => {
          cachedBlob = blob;
        });
      } else {
        el.querySelector('#res-coins').textContent = String(r.runCoins + (daily ? r.daily.bonus : 0));
      }
    },
    hide() {
      clearInterval(countUpTimer);
      el.classList.add('hidden');
    },
  };
}
