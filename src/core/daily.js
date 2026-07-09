// Daily challenge date math and seed derivation. Pure — no Date object
// anywhere; the current date key ('YYYY-MM-DD', local) is injected by the
// shell. Civil-calendar arithmetic (Howard Hinnant's algorithm) turns keys
// into day numbers so streak gaps and epochs are integer math.

import { TUNING as T } from './constants.js';
import { hashStr32, createRng } from './rng.js';
import { SHAPES } from './catalog.js';
import { isBossLevel } from './difficulty.js';
import { createRound } from './round.js';

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// days since civil epoch 1970-01-01 (negative before)
function daysFromCivil(y, m, d) {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z) {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: y + (m <= 2 ? 1 : 0), m, d };
}

export function isValidKey(key) {
  const match = typeof key === 'string' && key.match(KEY_RE);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  const roundTrip = civilFromDays(daysFromCivil(y, m, d));
  return roundTrip.y === y && roundTrip.m === m && roundTrip.d === d;
}

const epochDays = () => {
  const [, y, m, d] = T.daily.epochKey.match(KEY_RE).map(Number);
  return daysFromCivil(y, m, d);
};

// The epoch date is Daily #1.
export function dayNumberFromKey(key) {
  const match = key.match(KEY_RE).map(Number);
  return daysFromCivil(match[1], match[2], match[3]) - epochDays() + 1;
}

export function keyFromDayNumber(n) {
  const { y, m, d } = civilFromDays(epochDays() + (n - 1));
  const pad = (v) => String(v).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function dailySeed(key) {
  return hashStr32(`pf-daily:${key}`);
}

// The round for (dateKey, level) depends only on this — not on how many
// rng calls a player consumed getting there. Retries replay the identical
// round, and every player on Earth sees the same one.
export function dailyRoundSeed(seed, level) {
  return (seed ^ Math.imul(level, 0x9e3779b9)) >>> 0;
}

// Build the canonical daily round for a level. Full catalog (owned or not),
// no upgrades — everyone plays exactly the same game.
export function createDailyRound(dateKey, level) {
  const rng = createRng(dailyRoundSeed(dailySeed(dateKey), level));
  return createRound({
    level,
    shapeId: rng.pick(SHAPES).id,
    seed: rng.int(1, 1 << 30),
    upgrades: {},
    boss: isBossLevel(level),
  });
}
