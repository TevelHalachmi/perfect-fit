// Persistence. The save blob is signed with a checksum so casually edited
// saves (coins: 999999) are rejected and quarantined. This is tamper
// *resistance*, not security — a client-only game can never be hack-proof.

import { FREE_SHAPES, FREE_SKINS, SHAPES, SKINS, UPGRADES } from './catalog.js';
import { TUNING as T } from './constants.js';
import { missionTemplateById } from './missions.js';
import { achievementById } from './achievements.js';

const KEY = 'pf.save';
const BACKUP_KEY = 'pf.save.backup';
const VERSION = 2;
// The salt is an opaque tamper token, not a version marker — keeping it
// stable lets valid v1 signatures verify, which enables in-place migration.
const SALT = 'perfect-fit:v1:9b1c';

export function defaultData() {
  return {
    coins: 0,
    bestLevel: 0,
    totalSuccesses: 0,
    totalPerfects: 0,
    bestStreak: 0,
    ownedShapes: [...FREE_SHAPES],
    ownedSkins: [...FREE_SKINS],
    equippedShape: FREE_SHAPES[0],
    equippedSkin: FREE_SKINS[0],
    upgrades: { steady: 0, zen: 0, forgive: 0, midas: 0, life: 0 },
    settings: { sound: true, haptics: true },
    daily: {
      lastPlayedKey: '',
      streak: 0,
      bestStreak: 0,
      bestLevel: 0,
      lastLevel: 0,
      totalPlayed: 0,
    },
    missions: { dateKey: '', list: [] },
    achievements: [],
    stats: {
      rounds: 0,
      perfects: 0,
      goods: 0,
      misses: 0,
      pops: 0,
      falseStarts: 0,
      runs: 0,
      coinsEarned: 0,
      coinsSpent: 0,
      bestAccuracy: 0,
      dailiesPlayed: 0,
      bossesBeaten: 0,
      zenRounds: 0,
      zenSeconds: 0,
      timePlayedSeconds: 0,
      shares: 0,
    },
  };
}

// FNV-1a 32-bit — tiny, fast, dependency-free.
export function checksum(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const sign = (data) => checksum(JSON.stringify(data) + SALT);

export class SaveManager {
  #storage;
  data;
  loadedFrom; // 'fresh' | 'disk' | 'rejected' — how this session's data began

  constructor(storage) {
    this.#storage = storage;
    this.data = this.#load();
  }

  #load() {
    let raw = null;
    try {
      raw = this.#storage.getItem(KEY);
    } catch {
      /* storage unavailable — play with a fresh in-memory save */
    }
    if (raw == null) {
      this.loadedFrom = 'fresh';
      return defaultData();
    }

    try {
      const blob = JSON.parse(raw);
      const signed =
        blob &&
        typeof blob === 'object' &&
        blob.data &&
        typeof blob.sig === 'string' &&
        sign(blob.data) === blob.sig;
      if (signed && blob.v === VERSION) {
        this.loadedFrom = 'disk';
        return repair(blob.data);
      }
      // Older signed saves migrate in place: repair() starts from the v2
      // defaults, so missing fields appear while coins/ownership survive.
      if (signed && blob.v === 1) {
        this.loadedFrom = 'migrated';
        this.data = repair(blob.data);
        this.persist(); // disk is v2 from now on
        return this.data;
      }
    } catch {
      /* corrupt JSON falls through to rejection */
    }

    // Tampered or corrupt: quarantine the raw blob and start over.
    try {
      this.#storage.setItem(BACKUP_KEY, raw);
      this.#storage.removeItem(KEY);
    } catch {
      /* best effort */
    }
    this.loadedFrom = 'rejected';
    return defaultData();
  }

  persist() {
    try {
      this.#storage.setItem(KEY, JSON.stringify({ v: VERSION, data: this.data, sig: sign(this.data) }));
      return true;
    } catch {
      return false;
    }
  }

  reset() {
    this.data = defaultData();
    try {
      this.#storage.removeItem(BACKUP_KEY);
    } catch {
      /* best effort */
    }
    this.persist();
  }
}

// Clamp a signed-but-odd blob back into a valid shape (e.g. after a version
// skew) — unknown ids are dropped, numbers sanitized, invariants restored.
export function repair(data) {
  const d = defaultData();
  const src = data && typeof data === 'object' ? data : {};

  const int = (v, fallback = 0) =>
    Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : fallback;

  d.coins = int(src.coins);
  d.bestLevel = int(src.bestLevel);
  d.totalSuccesses = int(src.totalSuccesses);
  d.totalPerfects = int(src.totalPerfects);
  d.bestStreak = int(src.bestStreak);

  const shapeIds = new Set(SHAPES.map((s) => s.id));
  const skinIds = new Set(SKINS.map((s) => s.id));
  d.ownedShapes = [...new Set([...FREE_SHAPES, ...(Array.isArray(src.ownedShapes) ? src.ownedShapes : [])])]
    .filter((id) => shapeIds.has(id));
  d.ownedSkins = [...new Set([...FREE_SKINS, ...(Array.isArray(src.ownedSkins) ? src.ownedSkins : [])])]
    .filter((id) => skinIds.has(id));

  d.equippedShape = d.ownedShapes.includes(src.equippedShape) ? src.equippedShape : d.ownedShapes[0];
  d.equippedSkin = d.ownedSkins.includes(src.equippedSkin) ? src.equippedSkin : d.ownedSkins[0];

  for (const u of UPGRADES) {
    const cap = T.upgrades[u.id]?.maxLevel ?? u.costs.length;
    d.upgrades[u.id] = Math.min(int(src.upgrades?.[u.id]), cap);
  }

  d.settings.sound = src.settings?.sound !== false;
  d.settings.haptics = src.settings?.haptics !== false;

  // --- v2 fields (absent in v1 saves → defaults) ---
  const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
  const dateKey = (v) => (typeof v === 'string' && DATE_KEY.test(v) ? v : '');

  const daily = src.daily ?? {};
  d.daily.lastPlayedKey = dateKey(daily.lastPlayedKey);
  d.daily.streak = int(daily.streak);
  d.daily.bestStreak = Math.max(int(daily.bestStreak), d.daily.streak);
  d.daily.bestLevel = int(daily.bestLevel);
  d.daily.lastLevel = int(daily.lastLevel);
  d.daily.totalPlayed = int(daily.totalPlayed);

  d.missions.dateKey = dateKey(src.missions?.dateKey);
  d.missions.list = (Array.isArray(src.missions?.list) ? src.missions.list : [])
    .filter(
      (m) =>
        m && typeof m === 'object' && typeof m.templateId === 'string' && missionTemplateById(m.templateId)
    )
    .slice(0, T.missions.perDay)
    .map((m) => ({
      templateId: m.templateId,
      target: Math.max(1, int(m.target, 1)),
      progress: Math.min(int(m.progress), Math.max(1, int(m.target, 1))),
      reward: int(m.reward),
      done: m.done === true,
      data: m.data && typeof m.data === 'object' && !Array.isArray(m.data) ? m.data : {},
    }));

  d.achievements = [...new Set(Array.isArray(src.achievements) ? src.achievements : [])].filter(
    (id) => typeof id === 'string' && achievementById(id)
  );

  for (const key of Object.keys(d.stats)) {
    d.stats[key] = int(src.stats?.[key]);
  }
  d.stats.bestAccuracy = Math.min(100, Number(src.stats?.bestAccuracy) || 0);
  if (d.stats.bestAccuracy < 0) d.stats.bestAccuracy = 0;

  return d;
}
