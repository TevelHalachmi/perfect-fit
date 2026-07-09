// Progress screen: today's missions, the badge wall, lifetime stats.
// Reuses the shop's tab + scroll skeleton and card styling.

export function createProgressScreen(el, { core, onBack }) {
  el.innerHTML = `
    <div class="shop-head">
      <button class="btn btn-ghost btn-small" id="prog-back">← BACK</button>
      <div class="shop-title">PROGRESS</div>
      <div class="hud-pill"><span class="coin-icon"></span><span id="prog-coins">0</span></div>
    </div>
    <div class="shop-tabs">
      <button class="tab-btn active" data-tab="missions">MISSIONS</button>
      <button class="tab-btn" data-tab="badges">BADGES</button>
      <button class="tab-btn" data-tab="stats">STATS</button>
    </div>
    <div class="shop-scroll"><div id="prog-body"></div></div>
  `;

  const body = el.querySelector('#prog-body');
  const coinsEl = el.querySelector('#prog-coins');
  let tab = 'missions';
  let visible = false;

  el.querySelector('#prog-back').addEventListener('click', onBack);
  for (const btn of el.querySelectorAll('.tab-btn')) {
    btn.addEventListener('click', () => {
      tab = btn.dataset.tab;
      for (const b of el.querySelectorAll('.tab-btn')) b.classList.toggle('active', b === btn);
      render();
    });
  }

  const rerender = () => visible && render();
  core.events.on('mission:complete', rerender);
  core.events.on('achievement:unlock', rerender);
  core.events.on('coins:change', ({ coins }) => {
    coinsEl.textContent = String(coins);
  });

  function renderMissions() {
    const missions = core.getMissions();
    if (!missions.length) {
      return `<div class="settings-note">Missions arrive with the day — check back!</div>`;
    }
    return `<div class="mission-list">${missions
      .map((m) => {
        const pct = Math.round((m.progress / m.target) * 100);
        return `<div class="mission-row${m.done ? ' done' : ''}">
          <div class="mission-top">
            <span class="mission-name">${m.done ? '✅' : '🎯'} ${m.name}</span>
            <span class="mission-reward">${m.done ? 'CLAIMED' : `<span class="coin-icon"></span>${m.reward}`}</span>
          </div>
          <div class="card-desc">${m.desc}</div>
          <div class="mission-bar"><i style="width:${pct}%"></i></div>
          <div class="mission-count">${m.progress} / ${m.target}</div>
        </div>`;
      })
      .join('')}</div>`;
  }

  function renderBadges() {
    const badges = core.getAchievements();
    const sorted = [...badges.filter((b) => b.unlocked), ...badges.filter((b) => !b.unlocked)];
    return `<div class="shop-grid">${sorted
      .map(
        (b) => `<div class="shop-card${b.unlocked ? ' equipped' : ' locked'}">
          <div class="card-emoji">${b.unlocked ? b.icon : '🔒'}</div>
          <div class="card-name">${b.name}</div>
          <div class="card-desc">${b.desc}</div>
          <div class="card-btn ${b.unlocked ? 'equipped-btn' : 'milestone'}" style="pointer-events:none">
            ${b.unlocked ? '✓ ' : ''}<span class="coin-icon"></span>${b.reward}
          </div>
        </div>`
      )
      .join('')}</div>`;
  }

  function renderStats() {
    const s = core.getStats();
    const acc = s.bestAccuracy ? `${s.bestAccuracy.toFixed(1)}%` : '—';
    const mins = Math.round(s.timePlayedSeconds / 60);
    const rows = [
      ['🎯 Best accuracy', acc],
      ['🏔️ Best level', s.bestLevel || '—'],
      ['🔥 Best streak', s.bestStreak],
      ['✨ Perfects', s.totalPerfects],
      ['👍 Goods', s.goods],
      ['💥 Pops', s.pops],
      ['😬 Misses', s.misses],
      ['🐣 False starts', s.falseStarts],
      ['🪙 Coins earned', s.coinsEarned],
      ['⚔️ Bosses beaten', s.bossesBeaten],
      ['🗓️ Dailies played', s.dailiesPlayed],
      ['📆 Best daily streak', s.dailyBestStreak],
      ['🧘 Zen rounds', s.zenRounds],
      ['⏱️ Time played', mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`],
    ];
    return `<div class="settings-list">${rows
      .map(
        ([label, value]) =>
          `<div class="stat-row"><span>${label}</span><span class="stat-value">${value}</span></div>`
      )
      .join('')}</div>`;
  }

  function render() {
    coinsEl.textContent = String(core.getState().coins);
    body.innerHTML =
      tab === 'missions' ? renderMissions() : tab === 'badges' ? renderBadges() : renderStats();
  }

  return {
    el,
    show() {
      visible = true;
      el.classList.remove('hidden');
      render();
    },
    hide() {
      visible = false;
      el.classList.add('hidden');
    },
  };
}
