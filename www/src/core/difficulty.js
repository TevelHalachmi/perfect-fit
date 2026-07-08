// The rage curve. Pure functions of (level, upgrades) — every number that
// makes the game harder comes from here, so the ramp is fully testable.

import { TUNING as T } from './constants.js';

const clampMin = (v, min) => Math.max(min, v);
const clampMax = (v, max) => Math.min(max, v);

export function growthRate(level, zenLevel = 0) {
  const g = clampMax(T.growth.base + T.growth.perLevel * (level - 1), T.growth.max);
  return g * (1 - T.upgrades.zen.growthMultPerLevel * zenLevel);
}

export function wobbleAmp(level, steadyLevel = 0) {
  const a = clampMax(T.wobble.base + T.wobble.perLevel * (level - 1), T.wobble.max);
  return a * (1 - T.upgrades.steady.wobbleMultPerLevel * steadyLevel);
}

export function wobbleFreq(level) {
  return clampMax(T.wobbleFreq.base + T.wobbleFreq.perLevel * (level - 1), T.wobbleFreq.max);
}

// Half-widths of the accuracy bands as fractions (not %): {perfect, good}
export function toleranceBands(level, forgiveLevel = 0) {
  const mult = 1 + T.upgrades.forgive.bandMultPerLevel * forgiveLevel;
  const perfect = clampMin(T.perfectBand.base - T.perfectBand.perLevel * (level - 1), T.perfectBand.min);
  const good = clampMin(T.goodBand.base - T.goodBand.perLevel * (level - 1), T.goodBand.min);
  return { perfect: (perfect * mult) / 100, good: (good * mult) / 100 };
}

// Ratio above which the shape explodes mid-hold. Forgiveness never widens this.
export function popThreshold(level) {
  return clampMin(T.popThreshold.base - T.popThreshold.perLevel * (level - 1), T.popThreshold.min);
}

export function driftRadius(level) {
  if (level < T.drift.startLevel) return 0;
  const ramp = clampMax((level - T.drift.startLevel + 1) / T.drift.rampLevels, 1);
  return T.drift.radius * ramp;
}

export function livesFor(upgrades = {}) {
  return Math.min(T.maxLives, T.baseLives + (upgrades.life ?? 0));
}

export function rotateSpeed(level) {
  return T.rotate.base + T.rotate.perLevel * level; // deg/s
}

export function pulseAmp(level) {
  return clampMax(T.pulse.ampBase + T.pulse.ampPerLevel * level, T.pulse.ampMax);
}

// Which modifiers are active this round. Deterministic given (level, rng).
// The modifier that unlocks AT this level is always featured (intro banner).
export function modifiersFor(level, rng) {
  const unlocked = Object.entries(T.modifierLevels)
    .filter(([, lv]) => level >= lv)
    .map(([name]) => name);
  if (unlocked.length === 0) return [];

  let count = 0;
  for (const rule of T.modifierCount) {
    if (level >= rule.from) {
      count = rule.count;
      break;
    }
  }
  count = Math.min(count, unlocked.length);
  if (count === 0) return [];

  const introduced = Object.entries(T.modifierLevels).find(([, lv]) => lv === level)?.[0];
  const picked = [];
  if (introduced) picked.push(introduced);

  const pool = unlocked.filter((m) => !picked.includes(m));
  while (picked.length < count && pool.length > 0) {
    const m = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    // ghost+drift together is unreadable — not before the deep-rage levels
    if (level < T.ghostDriftMinLevel) {
      const cruel =
        (m === 'ghost' && picked.includes('drift')) || (m === 'drift' && picked.includes('ghost'));
      if (cruel) continue;
    }
    picked.push(m);
  }
  return picked;
}

// How long (seconds) the size stays inside the GOOD band at this level —
// the honest measure of difficulty. Used by tests to keep the game humanly
// possible forever.
export function goodWindowSeconds(level, upgrades = {}) {
  const { good } = toleranceBands(level, upgrades.forgive ?? 0);
  return (2 * good) / growthRate(level, upgrades.zen ?? 0);
}
