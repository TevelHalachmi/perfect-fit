// Leaderboards (online only): today's daily challenge and all-time best
// level. Rows come straight from the server; your own entry glows.

export function createLeaderboardScreen(el, { core, net, onBack }) {
  el.innerHTML = `
    <div class="shop-head">
      <button class="btn btn-ghost btn-small" id="lb-back">← BACK</button>
      <div class="shop-title">RANKS</div>
      <div style="width:64px"></div>
    </div>
    <div class="shop-tabs">
      <button class="tab-btn active" data-tab="daily">TODAY</button>
      <button class="tab-btn" data-tab="best">ALL-TIME</button>
    </div>
    <div class="shop-scroll"><div id="lb-body" class="settings-list"></div></div>
  `;

  const body = el.querySelector('#lb-body');
  let tab = 'daily';

  el.querySelector('#lb-back').addEventListener('click', onBack);
  for (const btn of el.querySelectorAll('.tab-btn')) {
    btn.addEventListener('click', () => {
      tab = btn.dataset.tab;
      for (const b of el.querySelectorAll('.tab-btn')) b.classList.toggle('active', b === btn);
      render();
    });
  }

  async function render() {
    body.innerHTML = `<div class="settings-note">Summoning the champions…</div>`;
    const date = core.getDaily().dateKey;
    const rows = await net.leaderboard(tab === 'daily' ? 'daily' : 'best', date);
    if (!rows) {
      body.innerHTML = `<div class="settings-note">Couldn't reach the server — try again in a bit.</div>`;
      return;
    }
    if (!rows.length) {
      body.innerHTML = `<div class="settings-note">${
        tab === 'daily' ? 'Nobody has braved today’s daily yet. Be first!' : 'No champions yet. Be first!'
      }</div>`;
      return;
    }
    body.innerHTML = rows
      .map((r, i) => {
        const you = net.name && r.name === net.name;
        const medal = ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;
        return `<div class="stat-row${you ? ' highlight' : ''}">
          <span>${medal} ${r.name}${you ? ' · YOU' : ''}</span>
          <span class="stat-value">LVL ${r.value}</span>
        </div>`;
      })
      .join('');
  }

  return {
    el,
    show() {
      el.classList.remove('hidden');
      render();
    },
    hide() {
      el.classList.add('hidden');
    },
  };
}
