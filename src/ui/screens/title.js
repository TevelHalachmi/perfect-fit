// Title screen. The equipped shape bobs on the canvas behind this DOM.

export function createTitleScreen(
  el,
  { onPlay, onDaily, onZen, onShop, onProgress, onSettings, onLeaderboard, core, net }
) {
  el.innerHTML = `
    <div class="title-best hidden" id="title-best"></div>
    <h1 class="title-logo">Perfect<br>Fit</h1>
    <div class="title-sub">hold to grow · release to fit</div>
    <div class="title-spacer"></div>
    <button class="btn" id="btn-play">PLAY</button>
    <button class="btn btn-sun btn-small" id="btn-daily">🗓️ DAILY</button>
    <div class="btn-row">
      <button class="btn btn-mint btn-small" id="btn-zen">🧘 ZEN</button>
      <button class="btn btn-violet btn-small" id="btn-shop">🛍️ SHOP</button>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost btn-small" id="btn-progress">📋 PROGRESS</button>
      <button class="btn btn-ghost btn-small" id="btn-settings">⚙️ SETTINGS</button>
    </div>
    <div class="btn-row">
      <button class="btn btn-violet btn-small hidden" id="btn-leaderboard">🏆 RANKS</button>
    </div>
    <div class="net-pill" id="net-pill">⚪ offline mode</div>
  `;
  el.querySelector('#btn-play').addEventListener('click', onPlay);
  el.querySelector('#btn-daily').addEventListener('click', onDaily);
  el.querySelector('#btn-zen').addEventListener('click', onZen);
  el.querySelector('#btn-shop').addEventListener('click', onShop);
  el.querySelector('#btn-progress').addEventListener('click', onProgress);
  el.querySelector('#btn-settings').addEventListener('click', onSettings);
  el.querySelector('#btn-leaderboard').addEventListener('click', onLeaderboard);

  function refreshNet() {
    const pill = el.querySelector('#net-pill');
    const lbBtn = el.querySelector('#btn-leaderboard');
    if (!net?.enabled) {
      pill.textContent = '⚪ offline mode';
      lbBtn.classList.add('hidden');
      return;
    }
    if (net.status === 'online') {
      pill.textContent = `🟢 online · ${net.name ?? 'connected'}`;
      lbBtn.classList.remove('hidden');
    } else if (net.status === 'connecting') {
      pill.textContent = '🟡 connecting…';
      lbBtn.classList.add('hidden');
    } else {
      pill.textContent = '⚪ offline — will retry';
      lbBtn.classList.add('hidden');
    }
  }
  net?.onStatus(() => refreshNet());

  function refreshDaily() {
    const btn = el.querySelector('#btn-daily');
    const daily = core.getDaily();
    if (!daily.dateKey) {
      btn.classList.add('hidden');
      return;
    }
    btn.classList.remove('hidden');
    const flame = daily.streak >= 2 ? ` · 🔥${daily.streak}` : '';
    if (daily.available) {
      btn.disabled = false;
      btn.textContent = `🗓️ DAILY #${daily.dailyNumber}${flame}`;
    } else {
      btn.disabled = true;
      btn.textContent = `✅ DAILY #${daily.dailyNumber} DONE${flame}`;
    }
  }

  // an app parked overnight on the title should wake up with a fresh daily
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !el.classList.contains('hidden')) refreshDaily();
  });

  return {
    el,
    show() {
      const best = core.getState().bestLevel;
      const bestEl = el.querySelector('#title-best');
      bestEl.classList.toggle('hidden', best < 2);
      bestEl.textContent = `★ BEST LEVEL ${best} ★`;
      refreshDaily();
      refreshNet();
      el.classList.remove('hidden');
    },
    hide() {
      el.classList.add('hidden');
    },
  };
}
