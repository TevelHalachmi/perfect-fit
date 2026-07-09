// Transient toast banners (modifier intros, unlocks, new best). Elements
// remove themselves when their CSS animation finishes — nothing accumulates.

import { icon } from './icons.js';

const layer = () => document.getElementById('banner-layer');

// html comes only from our own UI code (icon() + fixed copy), never users.
export function showBanner(html, kind = '') {
  const el = document.createElement('div');
  el.className = `banner ${kind}`.trim();
  el.innerHTML = html;
  el.addEventListener('animationend', () => el.remove());
  layer().appendChild(el);
}

export const MODIFIER_BANNERS = {
  rotate: `${icon('cyclone')} NEW TWIST: EVERYTHING SPINS!`,
  pulse: `${icon('pulse')} NEW TWIST: THE TARGET BREATHES!`,
  drift: `${icon('balloon')} NEW TWIST: THE TARGET WANDERS!`,
  oscillate: `${icon('wave')} NEW TWIST: GROWTH SURGES!`,
  ghost: `${icon('ghost')} NEW TWIST: THE TARGET HIDES!`,
  invert: `${icon('invert')} NEW TWIST: IT SHRINKS — RELEASE IN TIME!`,
  wind: `${icon('wind')} NEW TWIST: THE WIND PUSHES!`,
};
