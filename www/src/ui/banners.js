// Transient toast banners (modifier intros, unlocks, new best). Elements
// remove themselves when their CSS animation finishes — nothing accumulates.

const layer = () => document.getElementById('banner-layer');

export function showBanner(text, kind = '') {
  const el = document.createElement('div');
  el.className = `banner ${kind}`.trim();
  el.textContent = text;
  el.addEventListener('animationend', () => el.remove());
  layer().appendChild(el);
}

export const MODIFIER_BANNERS = {
  rotate: '🌀 NEW TWIST: EVERYTHING SPINS!',
  pulse: '💓 NEW TWIST: THE TARGET BREATHES!',
  drift: '🎈 NEW TWIST: THE TARGET WANDERS!',
  oscillate: '🌊 NEW TWIST: GROWTH SURGES!',
  ghost: '👻 NEW TWIST: THE TARGET HIDES!',
};
