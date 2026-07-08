// Persistence. The save blob is signed with a checksum so casually edited
// saves (coins: 999999) are rejected and quarantined. This is tamper
// *resistance*, not security — a client-only game can never be hack-proof.

import { FREE_SHAPES, FREE_SKINS, SHAPES, SKINS, UPGRADES } from './catalog.js';
import { TUNING as T } from './constants.js';

const KEY = 'pf.save';
const BACKUP_KEY = 'pf.save.backup';
const VERSION = 1;
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
      if (
        blob &&
        typeof blob === 'object' &&
        blob.v === VERSION &&
        blob.data &&
        typeof blob.sig === 'string' &&
        sign(blob.data) === blob.sig
      ) {
        this.loadedFrom = 'disk';
        return repair(blob.data);
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
  return d;
}
