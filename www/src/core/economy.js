// The coin ledger. Coins are integers, never negative, and can only change
// through earn() and spend() — the UI has no other way in.

import { TUNING as T } from './constants.js';
import { BAND } from './accuracy.js';
import { toleranceBands } from './difficulty.js';

export class Economy {
  #coins;
  #events;

  constructor(initialCoins, events) {
    this.#coins = sanitize(initialCoins);
    this.#events = events;
  }

  get coins() {
    return this.#coins;
  }

  earn(amount, reason = '') {
    const value = sanitize(amount);
    if (value <= 0) return 0;
    this.#coins += value;
    this.#events?.emit('coins:change', { coins: this.#coins, delta: value, reason });
    return value;
  }

  spend(amount, reason = '') {
    const value = sanitize(amount);
    if (value <= 0 || value > this.#coins) return false;
    this.#coins -= value;
    this.#events?.emit('coins:change', { coins: this.#coins, delta: -value, reason });
    return true;
  }

  // Reward for one judged release. Returns {total, breakdown}.
  computeReward({ band, error, level, streak, upgrades = {} }) {
    if (band !== BAND.PERFECT && band !== BAND.GOOD) {
      return { total: 0, breakdown: { base: 0, bandMult: 0, closeBonus: 0, streakBonus: 0, midasMult: 1 } };
    }
    const base = T.reward.base + Math.floor(T.reward.basePerLevel * level);
    const bandMult = band === BAND.PERFECT ? T.reward.perfectMult : 1;

    let closeBonus = 0;
    if (band === BAND.GOOD) {
      const { good } = toleranceBands(level, upgrades.forgive ?? 0);
      const closeness = Math.max(0, 1 - error / good); // 1 = grazing perfect
      closeBonus = Math.floor(base * T.reward.closeBonusMax * closeness);
    }

    const streakBonus = Math.floor(base * T.reward.streakBonusPer * Math.min(streak, T.reward.streakBonusCap));
    const midasMult = 1 + T.upgrades.midas.coinMultPerLevel * (upgrades.midas ?? 0);
    const total = Math.floor((base * bandMult + closeBonus + streakBonus) * midasMult);
    return { total, breakdown: { base, bandMult, closeBonus, streakBonus, midasMult } };
  }
}

function sanitize(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}
