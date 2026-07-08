// Run-over screen: level reached, coins earned (count-up), best, retry.

const TAUNTS = [
  [2, 'The shapes believe in you. Barely.'],
  [5, 'Warming up! The circle is mildly impressed.'],
  [9, 'Respectable. The triangle demands more.'],
  [14, 'Now THAT was some quality fitting.'],
  [20, 'Precision machine. The shapes whisper your name.'],
  [26, 'Legendary. Even the blob is speechless.'],
  [Infinity, 'ABSOLUTE PERFECTION. Touch grass, champion.'],
];

export function createResultsScreen(el, { audio, onRetry, onShop, onHome }) {
  el.innerHTML = `
    <div class="results-card">
      <div class="new-best-tag hidden" id="res-newbest">NEW BEST!</div>
      <div class="results-title">RUN OVER!</div>
      <div class="results-taunt" id="res-taunt"></div>
      <div class="stat-row"><span>Level reached</span><span class="stat-value" id="res-level">1</span></div>
      <div class="stat-row highlight"><span>Coins earned</span><span class="stat-value" id="res-coins">0</span></div>
      <div class="stat-row"><span>Best streak</span><span class="stat-value" id="res-streak">0</span></div>
      <div class="btn-row" style="margin-top:6px">
        <button class="btn btn-mint" id="btn-retry">RETRY</button>
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

  let lastResult = null;

  return {
    el,
    // Re-showable without a payload (e.g. returning from the shop): the
    // last run's numbers are kept, and only fresh results animate.
    show(result) {
      const fresh = Boolean(result);
      if (fresh) lastResult = result;
      const r = lastResult ?? { levelReached: 1, runCoins: 0, bestStreak: 0, isNewBest: false };
      el.querySelector('#res-level').textContent = String(r.levelReached);
      el.querySelector('#res-streak').textContent = String(r.bestStreak);
      el.querySelector('#res-taunt').textContent = TAUNTS.find(([max]) => r.levelReached < max)[1];
      el.querySelector('#res-newbest').classList.toggle('hidden', !r.isNewBest);
      el.classList.remove('hidden');
      if (fresh) animateCoins(r.runCoins);
      else el.querySelector('#res-coins').textContent = String(r.runCoins);
    },
    hide() {
      clearInterval(countUpTimer);
      el.classList.add('hidden');
    },
  };
}
