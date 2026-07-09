// The anti-cheat brain. The server never trusts a claimed balance — it
// approves the client's coin journal entry by entry, against the SAME pure
// game core the client runs (this is the payoff of the frontend/backend
// split: one source of truth for what is even possible).
//
// Approval rules per reason:
//   round:L        earn ≤ theoretical max for level L (perfect, streak cap,
//                  Midas maxed)
//   boss:L         L is a boss level; earn ≤ max chest at L
//   daily          ≤ the daily bonus cap, once per dateKey per device
//   mission:id     exactly the template reward, once per id per dateKey
//   achievement:id exactly the badge reward, once per id ever
//   shape/skin/upgrade:id  spend equals the real catalog price, no double
//                  purchases, upgrade tiers bought in order
//   anything else  rejected (test grants, sync echoes, inventions)
// Plus replay protection (seq must advance) and a per-sync-day earn cap.

import { TUNING as T } from '../www/src/core/constants.js';
import { Economy } from '../www/src/core/economy.js';
import { SHAPES, SKINS, UPGRADES, shapeById, skinById, upgradeById } from '../www/src/core/catalog.js';
import { ACHIEVEMENTS, achievementById } from '../www/src/core/achievements.js';
import { missionTemplateById } from '../www/src/core/missions.js';
import { isBossLevel } from '../www/src/core/difficulty.js';

const probe = new Economy(0, null);
const MAX_LEVEL_CLAIM = 200; // beyond human, beyond belief
const DAILY_EARN_CAP = 20000; // hard per-device cap per server day

export function maxRoundCoins(level) {
  return probe.computeReward({
    band: 'perfect',
    error: 0,
    level,
    streak: T.reward.streakBonusCap,
    upgrades: { midas: T.upgrades.midas.maxLevel },
  }).total;
}

export function maxBossChest(level) {
  return probe.computeBossChest(level, { midas: T.upgrades.midas.maxLevel });
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function freshDeviceState() {
  return {
    balance: 0,
    lastSeq: 0,
    bestLevel: 0,
    ownedShapes: [], // beyond the free ones
    ownedSkins: [],
    upgrades: {}, // id -> tiers bought
    achievements: [],
    dailyKeys: {}, // dateKey -> true (bonus claimed)
    missionKeys: {}, // `${id}:${dateKey}` -> true
    earnDay: '', // server-clock day for the cap
    earnedToday: 0,
  };
}

// Mutates ds. Returns { accepted, rejected: [{seq, why}], lastSeq }.
export function applyJournal(ds, journal, serverDayKey) {
  const rejected = [];
  let accepted = 0;

  if (ds.earnDay !== serverDayKey) {
    ds.earnDay = serverDayKey;
    ds.earnedToday = 0;
  }

  const entries = (Array.isArray(journal) ? journal : [])
    .filter(
      (e) =>
        e &&
        typeof e === 'object' &&
        Number.isInteger(e.seq) &&
        e.seq > 0 &&
        Number.isInteger(e.d) &&
        typeof e.r === 'string'
    )
    .sort((a, b) => a.seq - b.seq)
    .slice(0, 600);

  for (const e of entries) {
    if (e.seq <= ds.lastSeq) continue; // replay or already judged
    ds.lastSeq = e.seq;
    const why = judge(ds, e, serverDayKey);
    if (why) {
      rejected.push({ seq: e.seq, why });
      continue;
    }
    accepted += 1;
  }
  return { accepted, rejected, lastSeq: ds.lastSeq };
}

// Returns a rejection reason string, or null when the entry is approved
// (and applied to ds).
function judge(ds, e, serverDayKey) {
  const { d, r } = e;
  const meta = e.m && typeof e.m === 'object' ? e.m : {};

  const credit = (amount) => {
    if (ds.earnedToday + amount > DAILY_EARN_CAP) return 'daily-earn-cap';
    ds.earnedToday += amount;
    ds.balance += amount;
    return null;
  };

  if (r.startsWith('round:')) {
    const level = Number(r.slice(6));
    if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL_CLAIM) return 'bad-level';
    if (d <= 0 || d > maxRoundCoins(level)) return 'implausible-round-coins';
    return credit(d);
  }

  if (r.startsWith('boss:')) {
    const level = Number(r.slice(5));
    if (!Number.isInteger(level) || !isBossLevel(level) || level > MAX_LEVEL_CLAIM) return 'not-a-boss';
    if (d <= 0 || d > maxBossChest(level)) return 'implausible-chest';
    return credit(d);
  }

  if (r === 'daily') {
    const key = typeof meta.dateKey === 'string' && DATE_KEY.test(meta.dateKey) ? meta.dateKey : null;
    if (!key) return 'daily-needs-date';
    if (ds.dailyKeys[key]) return 'daily-already-claimed';
    if (d <= 0 || d > T.daily.bonusMax) return 'implausible-daily-bonus';
    const out = credit(d);
    if (!out) ds.dailyKeys[key] = true;
    return out;
  }

  if (r.startsWith('mission:')) {
    const id = r.slice(8);
    const template = missionTemplateById(id);
    if (!template) return 'unknown-mission';
    const key = typeof meta.dateKey === 'string' && DATE_KEY.test(meta.dateKey) ? meta.dateKey : serverDayKey;
    const dedupeKey = `${id}:${key}`;
    if (ds.missionKeys[dedupeKey]) return 'mission-already-claimed';
    if (d !== template.reward) return 'wrong-mission-reward';
    const out = credit(d);
    if (!out) ds.missionKeys[dedupeKey] = true;
    return out;
  }

  if (r.startsWith('achievement:')) {
    const id = r.slice(12);
    const badge = achievementById(id);
    if (!badge) return 'unknown-achievement';
    if (ds.achievements.includes(id)) return 'achievement-already-claimed';
    if (d !== badge.reward) return 'wrong-achievement-reward';
    const out = credit(d);
    if (!out) ds.achievements.push(id);
    return out;
  }

  if (r.startsWith('shape:')) {
    const shape = shapeById(r.slice(6));
    if (!shape || shape.unlock.type !== 'coins') return 'not-purchasable';
    if (ds.ownedShapes.includes(shape.id)) return 'already-owned';
    if (d !== -shape.unlock.price) return 'wrong-price';
    if (ds.balance + d < 0) return 'insufficient-approved-funds';
    ds.balance += d;
    ds.ownedShapes.push(shape.id);
    return null;
  }

  if (r.startsWith('skin:')) {
    const skin = skinById(r.slice(5));
    if (!skin || !skin.price) return 'not-purchasable';
    if (ds.ownedSkins.includes(skin.id)) return 'already-owned';
    if (d !== -skin.price) return 'wrong-price';
    if (ds.balance + d < 0) return 'insufficient-approved-funds';
    ds.balance += d;
    ds.ownedSkins.push(skin.id);
    return null;
  }

  if (r.startsWith('upgrade:')) {
    const upgrade = upgradeById(r.slice(8));
    if (!upgrade) return 'not-purchasable';
    const tier = ds.upgrades[upgrade.id] ?? 0;
    if (tier >= upgrade.costs.length) return 'already-maxed';
    if (d !== -upgrade.costs[tier]) return 'wrong-price';
    if (ds.balance + d < 0) return 'insufficient-approved-funds';
    ds.balance += d;
    ds.upgrades[upgrade.id] = tier + 1;
    return null;
  }

  return 'unknown-reason';
}

// Snapshot claims feed the leaderboards; they are clamped, never trusted.
export function sanitizeSnapshot(snapshot) {
  const s = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const int = (v, max) =>
    Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Math.floor(Number(v)))) : 0;
  return {
    bestLevel: int(s.bestLevel, MAX_LEVEL_CLAIM),
    daily:
      s.daily && typeof s.daily === 'object' && DATE_KEY.test(s.daily.dateKey ?? '')
        ? { dateKey: s.daily.dateKey, level: int(s.daily.level, 100) }
        : null,
  };
}

export const catalogsLoaded = SHAPES.length > 0 && SKINS.length > 0 && UPGRADES.length > 0 && ACHIEVEMENTS.length > 0;
