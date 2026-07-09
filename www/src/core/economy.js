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

  earn(amount, reason = '', meta = null) {
    const value = sanitize(amount);
    if (value <= 0) return 0;
    this.#coins += value;
    this.#events?.emit('coins:change', { coins: this.#coins, delta: value, reason, meta });
    return value;
  }

  spend(amount, reason = '', meta = null) {
    const value = sanitize(amount);
    if (value <= 0 || value > this.#coins) return false;
    this.#coins -= value;
    this.#events?.emit('coins:change', { coins: this.#coins, delta: -value, reason, meta });
    return true;
  }

  // Reward for one judged release. Returns {total, breakdown}.
  // `mult` is a mode multiplier (zen pays half); folded before the floor.
  computeReward({ band, error, level, streak, upgrades = {}, mult = 1 }) {
    if (band !== BAND.PERFECT && band !== BAND.GOOD) {
      return {
        total: 0,
        breakdown: { base: 0, bandMult: 0, closeBonus: 0, streakBonus: 0, midasMult: 1, modeMult: mult },
      };
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
    const total = Math.floor((base * bandMult + closeBonus + streakBonus) * midasMult * mult);
    return { total, breakdown: { base, bandMult, closeBonus, streakBonus, midasMult, modeMult: mult } };
  }

  // The chest for beating a boss round — roughly five normal rounds.
  computeBossChest(level, upgrades = {}) {
    const base = T.reward.base + Math.floor(T.reward.basePerLevel * level);
    const midasMult = 1 + T.upgrades.midas.coinMultPerLevel * (upgrades.midas ?? 0);
    return Math.floor((base * T.boss.chestMult + T.boss.chestFlat) * midasMult);
  }
}

function sanitize(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}
