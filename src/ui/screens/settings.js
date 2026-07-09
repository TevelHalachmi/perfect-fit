// Settings: sound / haptics toggles and a double-confirm progress reset.

import { icon } from '../icons.js';

export function createSettingsScreen(el, { core, onBack }) {
  el.innerHTML = `
    <div class="shop-head">
      <button class="btn btn-ghost btn-small" id="set-back">← BACK</button>
      <div class="shop-title">SETTINGS</div>
      <div style="width:86px"></div>
    </div>
    <div class="settings-list">
      <label class="setting-row"><span>${icon('sound')} Sound</span><input type="checkbox" class="toggle" id="set-sound"></label>
      <label class="setting-row"><span>${icon('music')} Music</span><input type="checkbox" class="toggle" id="set-music"></label>
      <label class="setting-row"><span>${icon('haptics')} Haptics</span><input type="checkbox" class="toggle" id="set-haptics"></label>
      <div class="setting-row"><span>${icon('trash')} Reset progress</span><button class="btn btn-ghost btn-small" id="set-reset">RESET</button></div>
    </div>
    <div class="settings-note">
      Perfect Fit · progress is saved on this device only.
      Sounds are synthesized live — nothing to download, nothing to load.<br>
      Icons: Twemoji (CC-BY 4.0) · Font: Baloo 2 (OFL)
    </div>
  `;

  const soundEl = el.querySelector('#set-sound');
  const musicEl = el.querySelector('#set-music');
  const hapticsEl = el.querySelector('#set-haptics');
  const resetBtn = el.querySelector('#set-reset');

  soundEl.addEventListener('change', () => core.setSetting('sound', soundEl.checked));
  musicEl.addEventListener('change', () => core.setSetting('music', musicEl.checked));
  hapticsEl.addEventListener('change', () => core.setSetting('haptics', hapticsEl.checked));

  let armed = false;
  let disarmTimer = 0;
  resetBtn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      resetBtn.textContent = 'SURE?';
      resetBtn.classList.add('btn-sun');
      disarmTimer = setTimeout(() => {
        armed = false;
        resetBtn.textContent = 'RESET';
        resetBtn.classList.remove('btn-sun');
      }, 3000);
      return;
    }
    clearTimeout(disarmTimer);
    core.resetSave();
    location.reload();
  });

  return {
    el,
    show() {
      const s = core.getState().settings;
      soundEl.checked = s.sound;
      musicEl.checked = s.music !== false;
      hapticsEl.checked = s.haptics;
      el.classList.remove('hidden');
    },
    hide() {
      el.classList.add('hidden');
    },
  };
}
