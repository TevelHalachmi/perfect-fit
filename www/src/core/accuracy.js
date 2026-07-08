// Judgment: given how big the shape was when released, how did you do?

import { toleranceBands } from './difficulty.js';

export const BAND = Object.freeze({
  PERFECT: 'perfect',
  GOOD: 'good',
  MISS: 'miss',
  POP: 'pop',
});

// Band edges are inclusive; the epsilon keeps that true under float error.
const EDGE = 1e-9;

// ratio = playerSize / instantaneous target size (1.0 unless pulsing).
export function judge(ratio, level, upgrades = {}) {
  const error = Math.abs(ratio - 1);
  const bands = toleranceBands(level, upgrades.forgive ?? 0);

  let band = BAND.MISS;
  if (error <= bands.perfect + EDGE) band = BAND.PERFECT;
  else if (error <= bands.good + EDGE) band = BAND.GOOD;

  return {
    band,
    error,
    ratio,
    accuracy: Math.max(0, Math.round((1 - error) * 1000) / 10), // 98.2 style
    nearMiss: band === BAND.MISS && error <= bands.good * 1.5,
    direction: ratio < 1 ? 'small' : 'big',
  };
}
