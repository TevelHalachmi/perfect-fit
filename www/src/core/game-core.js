// GameCore — the game's "backend". Owns the run state machine and every
// rule; the UI layer may only call these methods and listen to events.
// No DOM, no canvas, no audio, no timers — the UI drives tick(dt).

import { TUNING as T } from './constants.js';
import { createEmitter } from './events.js';
import { createRng } from './rng.js';
import { SaveManager } from './save.js';
import { Economy } from './economy.js';
import { Shop } from './shop.js';
import { judge, BAND } from './accuracy.js';
import { livesFor } from './difficulty.js';
import { createRound, startHold, resetHold, tickRound, roundView, currentRatio } from './round.js';

export class GameCore {
  #rng;
  #phase = 'title'; // 'title' | 'roundIdle' | 'holding' | 'resolving' | 'gameover'
  #round = null;
  #run = null;
  #resolveTimer = 0;
  #pendingEnd = false;

  constructor({ storage, seed }) {
    this.events = createEmitter();
    this.save = new SaveManager(storage);
    this.economy = new Economy(this.save.data.coins, this.events);
    this.shop = new Shop({ save: this.save, economy: this.economy, events: this.events });
    this.#rng = createRng(seed >>> 0 || 1);

    // The ledger is the source of truth; mirror it into the save blob.
    this.events.on('coins:change', ({ coins }) => {
      this.save.data.coins = coins;
    });
  }

  // ---------- run lifecycle ----------

  startRun() {
    this.#run = {
      level: 1,
      lives: livesFor(this.save.data.upgrades),
      streak: 0,
      bestStreak: 0,
      coins: 0,
      successes: 0,
    };
    this.#pendingEnd = false;
    this.#newRound();
    this.events.emit('run:start', { lives: this.#run.lives });
    this.events.emit('lives:change', { lives: this.#run.lives, max: this.#run.lives });
    this.events.emit('level:change', { level: 1 });
  }

  quitRun() {
    if (!this.#run) return;
    this.#finishRun();
  }

  toTitle() {
    this.#phase = 'title';
    this.#round = null;
    this.#run = null;
  }

  // ---------- input ----------

  beginHold() {
    if (this.#phase !== 'roundIdle') return false;
    startHold(this.#round);
    this.#phase = 'holding';
    this.events.emit('hold:start', { level: this.#run.level });
    return true;
  }

  endHold() {
    if (this.#phase !== 'holding') return false;
    const r = this.#round;

    const isFalseStart =
      r.holdTime * 1000 < T.falseStart.maxHoldMs && r.size < T.falseStart.maxSize;
    if (isFalseStart) {
      resetHold(r);
      this.#phase = 'roundIdle';
      this.events.emit('round:falseStart', {});
      return true;
    }

    const verdict = judge(currentRatio(r), r.level, this.save.data.upgrades);
    this.#resolve(verdict);
    return true;
  }

  // Interrupted (call, tab switch, pointer lost): never costs a life.
  abortHold() {
    if (this.#phase !== 'holding') return;
    resetHold(this.#round);
    this.#phase = 'roundIdle';
    this.events.emit('round:falseStart', { aborted: true });
  }

  // ---------- simulation ----------

  tick(rawDt) {
    const dt = Math.max(0, Math.min(rawDt, 0.1));

    if (this.#phase === 'roundIdle' || this.#phase === 'holding') {
      const popped = tickRound(this.#round, dt);
      if (popped === 'pop' && this.#phase === 'holding') {
        const r = this.#round;
        const verdict = {
          ...judge(currentRatio(r), r.level, this.save.data.upgrades),
          band: BAND.POP,
        };
        this.events.emit('round:pop', { level: r.level });
        this.#resolve(verdict);
      }
      return;
    }

    if (this.#phase === 'resolving') {
      this.#resolveTimer -= dt;
      if (this.#resolveTimer > 0) return;
      if (this.#pendingEnd) this.#finishRun();
      else {
        this.#newRound();
        this.events.emit('level:change', { level: this.#run.level });
      }
    }
  }

  // ---------- reads ----------

  getState() {
    const d = this.save.data;
    return {
      phase: this.#phase,
      coins: this.economy.coins,
      bestLevel: d.bestLevel,
      equippedShape: d.equippedShape,
      equippedSkin: d.equippedSkin,
      settings: { ...d.settings },
      level: this.#run?.level ?? 0,
      lives: this.#run?.lives ?? 0,
      maxLives: livesFor(d.upgrades),
      streak: this.#run?.streak ?? 0,
      runCoins: this.#run?.coins ?? 0,
    };
  }

  getRoundView() {
    return this.#round ? roundView(this.#round) : null;
  }

  // ---------- settings ----------

  setSetting(key, value) {
    if (key !== 'sound' && key !== 'haptics') return false;
    this.save.data.settings[key] = Boolean(value);
    this.save.persist();
    this.events.emit('settings:change', { key, value: Boolean(value) });
    return true;
  }

  resetSave() {
    this.save.reset();
  }

  // ---------- internals ----------

  #newRound() {
    const run = this.#run;
    this.#round = createRound({
      level: run.level,
      shapeId: this.#pickShape(),
      seed: this.#rng.int(1, 1 << 30),
      upgrades: this.save.data.upgrades,
    });
    this.#phase = 'roundIdle';
  }

  #pickShape() {
    const owned = this.save.data.ownedShapes;
    const equipped = this.save.data.equippedShape;
    let total = 0;
    const weights = owned.map((id) => {
      const w = id === equipped ? T.equippedShapeWeight : 1;
      total += w;
      return w;
    });
    let roll = this.#rng() * total;
    for (let i = 0; i < owned.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return owned[i];
    }
    return owned[owned.length - 1];
  }

  #resolve(verdict) {
    const run = this.#run;
    const d = this.save.data;
    const success = verdict.band === BAND.PERFECT || verdict.band === BAND.GOOD;
    const level = run.level;
    let reward = { total: 0, breakdown: null };
    let leveledUp = false;
    let newModifier = null;

    if (success) {
      run.streak += 1;
      run.bestStreak = Math.max(run.bestStreak, run.streak);
      run.successes += 1;
      reward = this.economy.computeReward({
        band: verdict.band,
        error: verdict.error,
        level,
        streak: run.streak,
        upgrades: d.upgrades,
      });
      this.economy.earn(reward.total, `round:${level}`);
      run.coins += reward.total;

      run.level += 1;
      leveledUp = true;
      d.totalSuccesses += 1;
      if (verdict.band === BAND.PERFECT) d.totalPerfects += 1;
      if (run.level > d.bestLevel) d.bestLevel = run.level;
      d.bestStreak = Math.max(d.bestStreak, run.streak);
      newModifier =
        Object.entries(T.modifierLevels).find(([, lv]) => lv === run.level)?.[0] ?? null;
    } else {
      run.streak = 0;
      run.lives -= 1;
      this.events.emit('lives:change', { lives: run.lives, max: livesFor(d.upgrades) });
      if (run.lives <= 0) this.#pendingEnd = true;
    }

    this.shop.checkMilestones();
    this.save.persist();

    this.events.emit('round:result', {
      ...verdict,
      success,
      coins: reward.total,
      breakdown: reward.breakdown,
      streak: run.streak,
      level,
      nextLevel: run.level,
      leveledUp,
      newModifier,
      livesLeft: run.lives,
    });

    this.#phase = 'resolving';
    this.#resolveTimer = T.resolveSeconds;
  }

  #finishRun() {
    const run = this.#run;
    const d = this.save.data;
    const result = {
      levelReached: run.level,
      runCoins: run.coins,
      successes: run.successes,
      bestStreak: run.bestStreak,
      isNewBest: run.level >= d.bestLevel && run.level > 1,
      bestLevel: d.bestLevel,
    };
    this.save.persist();
    this.#phase = 'gameover';
    this.#round = null;
    this.events.emit('run:end', result);
  }
}
