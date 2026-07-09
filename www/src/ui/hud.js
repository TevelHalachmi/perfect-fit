// In-game HUD (DOM): level, hearts, coins, streak. Subscribes to core
// events; cheap textContent updates only.

import { icon } from './icons.js';

export function createHud(el, core, { onQuit } = {}) {
  el.innerHTML = `
    <div class="hud-col">
      <div class="hud-pill"><span class="hud-label">LVL</span> <span id="hud-level">1</span></div>
      <div class="hud-pill" id="hud-hearts"></div>
    </div>
    <div class="hud-col right">
      <div class="hud-row">
        <div class="hud-pill" id="hud-coins">${icon('coin')}<span id="hud-coin-count">0</span></div>
        <button class="hud-btn" id="hud-quit" aria-label="End run">✕</button>
      </div>
      <div class="hud-pill hidden" id="hud-streak">${icon('fire')} <span id="hud-streak-count">0</span></div>
    </div>
  `;
  el.querySelector('#hud-quit').addEventListener('click', () => onQuit?.());

  const $ = (id) => el.querySelector(`#${id}`);
  const refs = {
    level: $('hud-level'),
    hearts: $('hud-hearts'),
    coins: $('hud-coins'),
    coinCount: $('hud-coin-count'),
    streak: $('hud-streak'),
    streakCount: $('hud-streak-count'),
  };

  let mode = 'normal';
  let prevLives = null;

  function renderHearts(lives, max) {
    if (mode === 'zen') {
      refs.hearts.innerHTML = `${icon('zen')} zen`;
      prevLives = null;
      return;
    }
    refs.hearts.innerHTML = Array.from({ length: Math.max(0, max) }, (_, i) =>
      `<span class="hh">${icon(i < lives ? 'heart' : 'heart-black')}</span>`
    ).join('');
    // the heart you just lost cracks visibly
    if (prevLives !== null && lives < prevLives && lives >= 0) {
      const lost = refs.hearts.querySelectorAll('.hh')[lives];
      lost?.classList.add('heart-pop');
    }
    prevLives = lives;
  }

  function renderStreak(streak) {
    refs.streakCount.textContent = String(streak);
    refs.streak.classList.toggle('hidden', streak < 2);
    refs.streak.classList.toggle('on-fire', streak >= 5);
  }

  function refresh() {
    const s = core.getState();
    refs.level.textContent = String(Math.max(1, s.level));
    refs.coinCount.textContent = String(s.coins);
    renderHearts(s.lives, s.maxLives);
    renderStreak(s.streak);
  }

  core.events.on('level:change', ({ level }) => {
    refs.level.textContent = String(level);
    const pill = refs.level.parentElement;
    pill.classList.remove('bump');
    void pill.offsetWidth;
    pill.classList.add('bump');
  });
  core.events.on('lives:change', ({ lives, max }) => renderHearts(lives, max));
  core.events.on('coins:change', ({ coins }) => {
    refs.coinCount.textContent = String(coins);
    refs.coins.classList.remove('bump');
    void refs.coins.offsetWidth; // restart the bump animation
    refs.coins.classList.add('bump');
  });
  core.events.on('round:result', ({ streak }) => renderStreak(streak));
  core.events.on('run:start', ({ mode: m }) => {
    mode = m ?? 'normal';
    refresh();
  });

  return {
    el,
    refresh,
    show() {
      el.classList.remove('hidden');
      refresh();
    },
    hide() {
      el.classList.add('hidden');
    },
    // where flying coins should land (viewport coords)
    coinAnchor() {
      const r = refs.coins.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
  };
}
