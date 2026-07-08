// Shop rules: what can be bought, equipped or milestone-unlocked.
// All purchases route through Economy.spend — the only door to the coins.

import { SHAPES, SKINS, UPGRADES, shapeById, skinById, upgradeById } from './catalog.js';

export class Shop {
  #save;
  #economy;
  #events;

  constructor({ save, economy, events }) {
    this.#save = save;
    this.#economy = economy;
    this.#events = events;
  }

  listItems(tab) {
    const d = this.#save.data;
    if (tab === 'shapes') {
      return SHAPES.map((s) => ({
        ...s,
        kind: 'shape',
        owned: d.ownedShapes.includes(s.id),
        equipped: d.equippedShape === s.id,
        price: s.unlock.type === 'coins' ? s.unlock.price : null,
        canBuy: this.canBuy(s.id),
        lockText: milestoneText(s),
      }));
    }
    if (tab === 'skins') {
      return SKINS.map((s) => ({
        ...s,
        kind: 'skin',
        owned: d.ownedSkins.includes(s.id),
        equipped: d.equippedSkin === s.id,
        price: s.price || null,
        canBuy: this.canBuy(s.id),
        lockText: null,
      }));
    }
    if (tab === 'upgrades') {
      return UPGRADES.map((u) => {
        const level = d.upgrades[u.id] ?? 0;
        const maxLevel = u.costs.length;
        return {
          ...u,
          kind: 'upgrade',
          level,
          maxLevel,
          owned: level >= maxLevel,
          equipped: false,
          price: level < maxLevel ? u.costs[level] : null,
          canBuy: this.canBuy(u.id),
          lockText: null,
        };
      });
    }
    return [];
  }

  canBuy(id) {
    const d = this.#save.data;
    const coins = this.#economy.coins;

    const shape = shapeById(id);
    if (shape) {
      if (d.ownedShapes.includes(id)) return { ok: false, reason: 'owned' };
      if (shape.unlock.type !== 'coins') return { ok: false, reason: 'milestone' };
      if (coins < shape.unlock.price) return { ok: false, reason: 'coins' };
      return { ok: true, reason: null };
    }

    const skin = skinById(id);
    if (skin) {
      if (d.ownedSkins.includes(id)) return { ok: false, reason: 'owned' };
      if (coins < skin.price) return { ok: false, reason: 'coins' };
      return { ok: true, reason: null };
    }

    const upgrade = upgradeById(id);
    if (upgrade) {
      const level = d.upgrades[id] ?? 0;
      if (level >= upgrade.costs.length) return { ok: false, reason: 'maxed' };
      if (coins < upgrade.costs[level]) return { ok: false, reason: 'coins' };
      return { ok: true, reason: null };
    }

    return { ok: false, reason: 'unknown' };
  }

  buy(id) {
    if (!this.canBuy(id).ok) return false;
    const d = this.#save.data;

    const shape = shapeById(id);
    if (shape) {
      if (!this.#economy.spend(shape.unlock.price, `shape:${id}`)) return false;
      d.ownedShapes.push(id);
    } else if (skinById(id)) {
      if (!this.#economy.spend(skinById(id).price, `skin:${id}`)) return false;
      d.ownedSkins.push(id);
    } else {
      const upgrade = upgradeById(id);
      const level = d.upgrades[id] ?? 0;
      if (!this.#economy.spend(upgrade.costs[level], `upgrade:${id}`)) return false;
      d.upgrades[id] = level + 1;
    }

    this.#save.persist();
    this.#events.emit('shop:purchase', { id });
    return true;
  }

  equip(id) {
    const d = this.#save.data;
    if (shapeById(id) && d.ownedShapes.includes(id)) d.equippedShape = id;
    else if (skinById(id) && d.ownedSkins.includes(id)) d.equippedSkin = id;
    else return false;
    this.#save.persist();
    this.#events.emit('equip:change', { id });
    return true;
  }

  upgradeLevel(id) {
    return this.#save.data.upgrades[id] ?? 0;
  }

  // Grant milestone shapes whose conditions the player now meets.
  checkMilestones() {
    const d = this.#save.data;
    const unlocked = [];
    for (const s of SHAPES) {
      if (d.ownedShapes.includes(s.id)) continue;
      const u = s.unlock;
      const met =
        (u.type === 'level' && d.bestLevel >= u.level) ||
        (u.type === 'perfects' && d.totalPerfects >= u.count);
      if (met) {
        d.ownedShapes.push(s.id);
        unlocked.push(s.id);
      }
    }
    if (unlocked.length) {
      this.#save.persist();
      for (const id of unlocked) this.#events.emit('shop:unlock', { id, reason: 'milestone' });
    }
    return unlocked;
  }
}

function milestoneText(shape) {
  const u = shape.unlock;
  if (u.type === 'level') return `Reach level ${u.level}`;
  if (u.type === 'perfects') return `${u.count} PERFECTs`;
  return null;
}
