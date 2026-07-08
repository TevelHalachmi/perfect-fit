// Title screen. The equipped shape bobs on the canvas behind this DOM.

export function createTitleScreen(el, { onPlay, onShop, onSettings, core }) {
  el.innerHTML = `
    <div class="title-best hidden" id="title-best"></div>
    <h1 class="title-logo">Perfect<br>Fit</h1>
    <div class="title-sub">hold to grow · release to fit</div>
    <div class="title-spacer"></div>
    <button class="btn" id="btn-play">PLAY</button>
    <div class="btn-row">
      <button class="btn btn-violet btn-small" id="btn-shop">🛍️ SHOP</button>
      <button class="btn btn-ghost btn-small" id="btn-settings">⚙️ SETTINGS</button>
    </div>
  `;
  el.querySelector('#btn-play').addEventListener('click', onPlay);
  el.querySelector('#btn-shop').addEventListener('click', onShop);
  el.querySelector('#btn-settings').addEventListener('click', onSettings);

  return {
    el,
    show() {
      const best = core.getState().bestLevel;
      const bestEl = el.querySelector('#title-best');
      bestEl.classList.toggle('hidden', best < 2);
      bestEl.textContent = `★ BEST LEVEL ${best} ★`;
      el.classList.remove('hidden');
    },
    hide() {
      el.classList.add('hidden');
    },
  };
}
