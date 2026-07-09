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
import { livesFor, isBossLevel, zenEffectiveLevel } from './difficulty.js';
import { createRound, startHold, resetHold, tickRound, roundView, currentRatio } from './round.js';
import { createDailyRound, dayNumberFromKey, isValidKey } from './daily.js';
import { rotateMissions, missionEvent, missionTemplateById } from './missions.js';
import { ACHIEVEMENTS, checkAchievements } from './achievements.js';

export class GameCore {
  #rng;
  #getDateKey;
  #phase = 'title'; // 'title' | 'roundIdle' | 'holding' | 'resolving' | 'gameover'
  #round = null;
  #run = null;
  #resolveTimer = 0;
  #pendingEnd = false;

  #getNow;
  #suppressJournal = false;

  constructor({ storage, seed, getDateKey = () => null, getNow = () => 0 }) {
    this.events = createEmitter();
    this.save = new SaveManager(storage);
    this.economy = new Economy(this.save.data.coins, this.events);
    this.shop = new Shop({ save: this.save, economy: this.economy, events: this.events });
    this.#rng = createRng(seed >>> 0 || 1);
    this.#getNow = () => Math.max(0, Math.floor(Number(getNow()) || 0));
    this.#getDateKey = () => {
      const key = getDateKey();
      return isValidKey(key) ? key : null;
    };

    // The ledger is the source of truth; mirror it into the save blob.
    // Lifetime earn/spend totals ride along, and every movement lands in
    // the reconciliation journal so a server can approve offline play.
    this.events.on('coins:change', ({ coins, delta, reason, meta }) => {
      const d = this.save.data;
      d.coins = coins;
      if (delta > 0) d.stats.coinsEarned += delta;
      else d.stats.coinsSpent += -delta;

      if (!this.#suppressJournal) {
        d.journalSeq += 1;
        d.journal.push({
          seq: d.journalSeq,
          t: this.#getNow(),
          d: delta,
          r: reason ?? '',
          ...(meta ? { m: meta } : {}),
        });
        if (d.journal.length > 500) d.journal.splice(0, d.journal.length - 500);
      }
    });

    // Purchases can flip shop-flavoured badges (first skin, all shapes…).
    this.events.on('shop:purchase', () => this.#awardAchievements());
    this.events.on('shop:unlock', () => this.#awardAchievements());
  }

  // ---------- run lifecycle ----------

  startRun({ mode = 'normal' } = {}) {
    const zen = mode === 'zen';
    this.#run = {
      mode,
      level: 1,
      lives: zen ? 0 : livesFor(this.save.data.upgrades), // zen has no lives at all
      maxLives: zen ? 0 : livesFor(this.save.data.upgrades),
      streak: 0,
      bestStreak: 0,
      coins: 0,
      successes: 0,
      bestAccuracy: 0,
      missFree: true,
    };
    this.save.data.stats.runs += 1;
    this.#ensureMissions();
    this.#pendingEnd = false;
    this.#newRound();
    this.events.emit('run:start', { lives: this.#run.lives, mode });
    this.events.emit('lives:change', { lives: this.#run.lives, max: this.#run.maxLives });
    this.events.emit('level:change', { level: 1 });
  }

  // ---------- missions / achievements / stats ----------

  // Missions belong to a calendar day; rotate lazily whenever it changes.
  #ensureMissions() {
    const key = this.#getDateKey();
    if (!key || this.save.data.missions.dateKey === key) return;
    this.save.data.missions = { dateKey: key, list: rotateMissions(key) };
    this.save.persist();
  }

  getMissions() {
    this.#ensureMissions();
    return this.save.data.missions.list.map((m) => {
      const t = missionTemplateById(m.templateId);
      return {
        id: m.templateId,
        name: t?.name ?? m.templateId,
        desc: t?.desc ?? '',
        progress: m.progress,
        target: m.target,
        reward: m.reward,
        done: m.done,
      };
    });
  }

  getAchievements() {
    const unlocked = new Set(this.save.data.achievements);
    return ACHIEVEMENTS.map((a) => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      desc: a.desc,
      reward: a.reward,
      unlocked: unlocked.has(a.id),
    }));
  }

  getStats() {
    const d = this.save.data;
    return {
      ...d.stats,
      totalSuccesses: d.totalSuccesses,
      totalPerfects: d.totalPerfects,
      bestLevel: d.bestLevel,
      bestStreak: d.bestStreak,
      dailyBestStreak: d.daily.bestStreak,
      dailyBestLevel: d.daily.bestLevel,
    };
  }

  // Called by the UI after a successful (or attempted) share.
  recordShare() {
    this.save.data.stats.shares += 1;
    this.#awardAchievements();
    this.save.persist();
  }

  // ---------- server reconciliation ----------

  getJournal() {
    return this.save.data.journal.map((e) => ({ ...e }));
  }

  // Adopt the server's approved balance: trim acknowledged journal entries
  // and adjust the local ledger to match. The adjustment itself is not
  // journaled (it IS the server's answer, not new activity).
  applySync({ coins, uptoSeq }) {
    const d = this.save.data;
    const seq = Math.max(0, Math.floor(Number(uptoSeq) || 0));
    d.journal = d.journal.filter((e) => e.seq > seq);
    const target = Math.max(0, Math.floor(Number(coins) || 0));
    const diff = target - this.economy.coins;
    this.#suppressJournal = true;
    if (diff > 0) this.economy.earn(diff, 'sync');
    else if (diff < 0) this.economy.spend(-diff, 'sync');
    this.#suppressJournal = false;
    this.save.persist();
    return { adjusted: diff };
  }

  // Feed one gameplay fact to the missions and pay any completions.
  #applyMissionEvent(ev) {
    this.#ensureMissions();
    const completed = missionEvent(this.save.data.missions.list, ev);
    for (const m of completed) {
      this.economy.earn(m.reward, `mission:${m.templateId}`, {
        dateKey: this.save.data.missions.dateKey,
      });
    }
    return completed;
  }

  // Award any newly-true achievements; returns them for event emission.
  #awardAchievements() {
    const d = this.save.data;
    const earned = checkAchievements(d);
    for (const a of earned) {
      d.achievements.push(a.id);
      this.economy.earn(a.reward, `achievement:${a.id}`);
      this.events.emit('achievement:unlock', { id: a.id, name: a.name, reward: a.reward });
    }
    if (earned.length) this.save.persist();
    return earned;
  }

  // ---------- daily challenge ----------

  getDaily() {
    const key = this.#getDateKey();
    const d = this.save.data.daily;
    if (!key) {
      return { available: false, playedToday: false, dailyNumber: 0, dateKey: null, ...d };
    }
    const playedToday =
      d.lastPlayedKey !== '' && dayNumberFromKey(key) <= dayNumberFromKey(d.lastPlayedKey);
    return {
      available: !playedToday,
      playedToday,
      dailyNumber: dayNumberFromKey(key),
      dateKey: key,
      streak: d.streak,
      bestStreak: d.bestStreak,
      bestLevel: d.bestLevel,
      lastLevel: d.lastLevel,
      totalPlayed: d.totalPlayed,
    };
  }

  // One attempt per day, consumed the moment the run starts — closing the
  // app mid-daily can't re-roll it. Returns false when locked.
  startDaily() {
    const info = this.getDaily();
    if (!info.available) return false;
    const d = this.save.data.daily;

    const prev = d.lastPlayedKey;
    const gap = prev === '' ? Infinity : dayNumberFromKey(info.dateKey) - dayNumberFromKey(prev);
    d.streak = gap === 1 ? d.streak + 1 : 1;
    d.bestStreak = Math.max(d.bestStreak, d.streak);
    d.lastPlayedKey = info.dateKey;
    d.totalPlayed += 1;
    this.save.data.stats.dailiesPlayed += 1;
    this.save.persist();
    this.#ensureMissions();
    this.#awardAchievements(); // daily-streak badges flip at start

    this.#run = {
      mode: 'daily',
      dateKey: info.dateKey,
      dailyNumber: info.dailyNumber,
      level: 1,
      lives: livesFor({}), // upgrades are ignored: everyone gets 3
      maxLives: livesFor({}),
      streak: 0,
      bestStreak: 0,
      coins: 0,
      successes: 0,
      bestAccuracy: 0,
      missFree: true,
    };
    this.save.data.stats.runs += 1;
    this.#pendingEnd = false;
    this.#newRound();
    this.events.emit('run:start', { lives: this.#run.lives, mode: 'daily' });
    this.events.emit('lives:change', { lives: this.#run.lives, max: this.#run.maxLives });
    this.events.emit('level:change', { level: 1 });
    return true;
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

    // Distance-from-start form: identical to the old size<0.30 check for
    // normal rounds, and it still works when INVERT starts the shape big.
    const isFalseStart =
      r.holdTime * 1000 < T.falseStart.maxHoldMs &&
      Math.abs(r.size - r.startSize) < T.falseStart.maxSize - T.startSize;
    if (isFalseStart) {
      resetHold(r);
      this.#phase = 'roundIdle';
      this.save.data.stats.falseStarts += 1;
      this.events.emit('round:falseStart', {});
      return true;
    }

    // The round carries its own upgrades (empty for daily fairness).
    const verdict = judge(currentRatio(r), r.level, r.upgrades);
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
    if (this.#run) {
      this.save.data.stats.timePlayedSeconds += dt;
      if (this.#run.mode === 'zen') this.save.data.stats.zenSeconds += dt;
    }

    if (this.#phase === 'roundIdle' || this.#phase === 'holding') {
      const popped = tickRound(this.#round, dt);
      if (popped === 'pop' && this.#phase === 'holding') {
        const r = this.#round;
        const verdict = {
          ...judge(currentRatio(r), r.level, r.upgrades),
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
      mode: this.#run?.mode ?? 'normal',
      coins: this.economy.coins,
      bestLevel: d.bestLevel,
      equippedShape: d.equippedShape,
      equippedSkin: d.equippedSkin,
      settings: { ...d.settings },
      level: this.#run?.level ?? 0,
      lives: this.#run?.lives ?? 0,
      // from the run when one exists — daily runs ignore the Extra Life
      // upgrade, so the HUD must not show phantom empty hearts
      maxLives: this.#run?.maxLives ?? livesFor(d.upgrades),
      streak: this.#run?.streak ?? 0,
      runCoins: this.#run?.coins ?? 0,
    };
  }

  getRoundView() {
    return this.#round ? roundView(this.#round) : null;
  }

  // ---------- settings ----------

  setSetting(key, value) {
    if (key !== 'sound' && key !== 'haptics' && key !== 'music') return false;
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
    if (run.mode === 'daily') {
      // Canonical, seed-stable round: identical for every player, and a
      // retried level replays exactly the same round.
      this.#round = createDailyRound(run.dateKey, run.level);
    } else {
      // Zen remaps the displayed level onto a gentler point of the curve;
      // the round (and therefore judgment) lives entirely at that level.
      const level = run.mode === 'zen' ? zenEffectiveLevel(run.level) : run.level;
      this.#round = createRound({
        level,
        shapeId: this.#pickShape(),
        seed: this.#rng.int(1, 1 << 30),
        upgrades: this.save.data.upgrades,
        boss: run.mode !== 'zen' && isBossLevel(run.level),
      });
    }
    this.#phase = 'roundIdle';
    if (this.#round.boss) this.events.emit('round:boss', { level: run.level });
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

    d.stats.rounds += 1;
    if (verdict.band === BAND.PERFECT) d.stats.perfects += 1;
    else if (verdict.band === BAND.GOOD) d.stats.goods += 1;
    else if (verdict.band === BAND.POP) d.stats.pops += 1;
    else d.stats.misses += 1;
    if (run.mode === 'zen') d.stats.zenRounds += 1;
    if (success) {
      run.bestAccuracy = Math.max(run.bestAccuracy, verdict.accuracy);
      d.stats.bestAccuracy = Math.max(d.stats.bestAccuracy, verdict.accuracy);
    }

    const isBoss = this.#round?.boss ?? false;
    // Daily runs ignore upgrades everywhere, including Midas.
    const rewardUpgrades = run.mode === 'daily' ? {} : d.upgrades;
    let chestCoins = 0;

    if (success) {
      run.streak += 1;
      run.bestStreak = Math.max(run.bestStreak, run.streak);
      run.successes += 1;
      reward = this.economy.computeReward({
        band: verdict.band,
        error: verdict.error,
        level,
        streak: run.streak,
        upgrades: rewardUpgrades,
        mult: run.mode === 'zen' ? T.zen.coinMult : 1,
      });
      this.economy.earn(reward.total, `round:${level}`);
      run.coins += reward.total;

      if (isBoss) {
        chestCoins = this.economy.computeBossChest(level, rewardUpgrades);
        this.economy.earn(chestCoins, `boss:${level}`);
        run.coins += chestCoins;
        d.stats.bossesBeaten += 1;
      }

      run.level += 1;
      leveledUp = true;
      d.totalSuccesses += 1;
      if (verdict.band === BAND.PERFECT) d.totalPerfects += 1;
      if (run.mode !== 'zen' && run.level > d.bestLevel) d.bestLevel = run.level;
      d.bestStreak = Math.max(d.bestStreak, run.streak);
      newModifier =
        run.mode === 'zen'
          ? null
          : (Object.entries(T.modifierLevels).find(([, lv]) => lv === run.level)?.[0] ?? null);
    } else {
      run.streak = 0;
      run.missFree = false;
      if (run.mode !== 'zen') {
        run.lives -= 1;
        this.events.emit('lives:change', { lives: run.lives, max: run.maxLives });
        if (run.lives <= 0) this.#pendingEnd = true;
      }
    }

    this.shop.checkMilestones();

    const missionsCompleted = this.#applyMissionEvent({
      type: 'result',
      band: verdict.band,
      success,
      streak: run.streak,
      nextLevel: run.level,
      coins: reward.total + chestCoins,
      shapeId: this.#round.shapeId,
      mode: run.mode,
      missFree: run.missFree,
      bossBeaten: isBoss && success,
    });

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
      boss: isBoss,
      bossBeaten: isBoss && success,
      chestCoins,
      mode: run.mode,
    });
    for (const m of missionsCompleted) {
      this.events.emit('mission:complete', {
        id: m.templateId,
        name: missionTemplateById(m.templateId)?.name ?? m.templateId,
        reward: m.reward,
      });
    }
    this.#awardAchievements();

    this.#phase = 'resolving';
    this.#resolveTimer = T.resolveSeconds;
  }

  #finishRun() {
    const run = this.#run;
    const d = this.save.data;
    const result = {
      mode: run.mode,
      levelReached: run.level,
      runCoins: run.coins,
      successes: run.successes,
      bestStreak: run.bestStreak,
      bestAccuracy: run.bestAccuracy,
      isNewBest: run.mode !== 'zen' && run.level >= d.bestLevel && run.level > 1,
      bestLevel: d.bestLevel,
    };

    let dailyMissions = [];
    if (run.mode === 'daily') {
      const bonus = Math.min(
        T.daily.completionBase +
          Math.floor(run.coins * T.daily.streakBonusPer * Math.min(d.daily.streak, T.daily.streakCap)),
        T.daily.bonusMax
      );
      this.economy.earn(bonus, 'daily', { dateKey: run.dateKey, n: run.dailyNumber });
      d.daily.lastLevel = run.level;
      d.daily.bestLevel = Math.max(d.daily.bestLevel, run.level);
      result.daily = { number: run.dailyNumber, streak: d.daily.streak, bonus };
      dailyMissions = this.#applyMissionEvent({ type: 'daily-done' });
      this.events.emit('daily:done', {
        dailyNumber: run.dailyNumber,
        dateKey: run.dateKey,
        streak: d.daily.streak,
        levelReached: run.level,
        runCoins: run.coins,
        bonus,
      });
    }

    this.save.persist();
    this.#phase = 'gameover';
    this.#round = null;
    this.events.emit('run:end', result);
    for (const m of dailyMissions) {
      this.events.emit('mission:complete', {
        id: m.templateId,
        name: missionTemplateById(m.templateId)?.name ?? m.templateId,
        reward: m.reward,
      });
    }
    this.#awardAchievements();
  }
}
