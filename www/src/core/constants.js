// Every gameplay tuning number lives here. The difficulty/economy modules
// read from this table so tests and balance changes have one home.

export const TUNING = Object.freeze({
  // --- round geometry (sizes are normalized: target = 1.0) ---
  startSize: 0.25,

  // --- difficulty curve (L = level, 1-based) ---
  growth: Object.freeze({ base: 0.35, perLevel: 0.045, max: 1.4 }),
  perfectBand: Object.freeze({ base: 5.0, perLevel: 0.16, min: 1.2 }), // half-width, % of target
  goodBand: Object.freeze({ base: 12.0, perLevel: 0.35, min: 3.5 }), // half-width, % of target
  wobble: Object.freeze({ base: 0.02, perLevel: 0.004, max: 0.12 }), // amplitude, fraction of target radius
  wobbleFreq: Object.freeze({ base: 6, perLevel: 0.25, max: 13 }), // Hz, primary sine
  popThreshold: Object.freeze({ base: 1.18, perLevel: 0.004, min: 1.1 }), // ratio that explodes mid-hold
  drift: Object.freeze({ startLevel: 5, radius: 0.05, rampLevels: 10, freq: 0.4 }),

  // --- modifiers ---
  modifierLevels: Object.freeze({
    rotate: 6, pulse: 8, drift: 11, oscillate: 14, ghost: 17, invert: 19, wind: 24,
  }),
  modifierCount: Object.freeze([
    Object.freeze({ from: 30, count: 3 }),
    Object.freeze({ from: 20, count: 2 }),
    Object.freeze({ from: 6, count: 1 }),
  ]),
  ghostDriftMinLevel: 26, // GHOST+DRIFT never combined before this
  rotate: Object.freeze({ base: 20, perLevel: 4 }), // deg/s
  pulse: Object.freeze({ ampBase: 0.03, ampPerLevel: 0.003, ampMax: 0.08, freq: 0.8 }),
  oscillate: Object.freeze({ depth: 0.55, freq: 0.9 }),
  ghost: Object.freeze({ fadeSeconds: 1.2, flashEvery: 2.0, flashAlpha: 0.15, flashSeconds: 0.15 }),

  // --- run rules ---
  baseLives: 3,
  maxLives: 5,
  falseStart: Object.freeze({ maxHoldMs: 120, maxSize: 0.3 }),
  inBandGlowMaxLevel: 9, // the training wheel that silently disappears

  // --- economy ---
  reward: Object.freeze({
    base: 4,
    basePerLevel: 1.5,
    perfectMult: 3,
    closeBonusMax: 0.5, // fraction of base, GOOD only, scales with closeness
    streakBonusPer: 0.1, // fraction of base per streak point
    streakBonusCap: 10,
  }),

  // --- upgrades (effect per level) ---
  upgrades: Object.freeze({
    steady: Object.freeze({ wobbleMultPerLevel: 0.15, maxLevel: 3 }), // ×(1 − 0.15·lvl)
    zen: Object.freeze({ growthMultPerLevel: 0.06, maxLevel: 3 }), // ×(1 − 0.06·lvl)
    forgive: Object.freeze({ bandMultPerLevel: 0.1, maxLevel: 3 }), // ×(1 + 0.10·lvl)
    midas: Object.freeze({ coinMultPerLevel: 0.25, maxLevel: 4 }), // ×(1 + 0.25·lvl)
    life: Object.freeze({ maxLevel: 2 }),
  }),

  equippedShapeWeight: 1.5, // equipped shape is this much likelier per round
  resolveSeconds: 0.9, // celebrate/mourn pause between rounds

  // --- daily challenge ---
  daily: Object.freeze({
    epochKey: '2026-01-01', // that date is Daily #1
    streakBonusPer: 0.2, // bonus = runCoins × per × min(streak, cap)
    streakCap: 10,
    completionBase: 30, // flat coins for finishing any daily
    bonusMax: 600, // hard cap on the whole bonus
  }),

  // --- zen mode ---
  zen: Object.freeze({ curveScale: 0.5, coinMult: 0.5 }),

  // --- boss rounds (every Nth level, normal + daily) ---
  boss: Object.freeze({
    every: 10,
    visualScale: 1.12, // camera zoom only — judgment is untouched
    popMarginMult: 0.9, // bossPop = 1 + (pop−1)×this …
    popFloorAboveGood: 0.012, // … but never below good(L, max forgive) + this
    extraModifiers: 1,
    maxModifiers: 4,
    chestMult: 5, // chest = floor(base(L) × mult + flat) × midas
    chestFlat: 25,
  }),

  // --- INVERT twist: starts big, hold to shrink ---
  invert: Object.freeze({ startSize: 1.35, growthMult: 0.85 }),

  // --- WIND twist: lateral push while holding (perception only) ---
  wind: Object.freeze({ pushPerSec: 0.06, pushCapSeconds: 1.2, gustAmp: 0.035, gustFreq: 0.45 }),

  // --- missions ---
  missions: Object.freeze({ perDay: 3 }),
});
