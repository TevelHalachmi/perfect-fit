// Tiny JSON-file store: devices and leaderboards held in memory, flushed
// atomically (tmp + rename) on mutation. Zero dependencies. Swap this file
// for a real database when the player count demands it — the server only
// talks to the Store API.

import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(dir) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
    this.devices = this.#load('devices.json', {});
    this.boards = this.#load('boards.json', { best: {}, daily: {} });
  }

  #load(file, fallback) {
    const p = path.join(this.dir, file);
    if (!existsSync(p)) return fallback;
    try {
      return JSON.parse(readFileSync(p, 'utf8'));
    } catch {
      return fallback;
    }
  }

  #flush(file, data) {
    const p = path.join(this.dir, file);
    const tmp = `${p}.tmp`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, p);
  }

  getDevice(id) {
    return this.devices[id] ?? null;
  }

  putDevice(id, device) {
    this.devices[id] = device;
    this.#flush('devices.json', this.devices);
  }

  // board 'best': { deviceId: {name, value} } — lifetime best level
  // board 'daily': { dateKey: { deviceId: {name, value} } }
  putBest(deviceId, name, value) {
    const cur = this.boards.best[deviceId];
    if (!cur || value > cur.value) {
      this.boards.best[deviceId] = { name, value };
      this.#flush('boards.json', this.boards);
    }
  }

  putDaily(dateKey, deviceId, name, value) {
    const day = (this.boards.daily[dateKey] ??= {});
    const cur = day[deviceId];
    if (!cur || value > cur.value) {
      day[deviceId] = { name, value };
      this.#flush('boards.json', this.boards);
    }
  }

  topBest(limit = 20) {
    return Object.entries(this.boards.best)
      .map(([deviceId, row]) => ({ deviceId, ...row }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  topDaily(dateKey, limit = 20) {
    return Object.entries(this.boards.daily[dateKey] ?? {})
      .map(([deviceId, row]) => ({ deviceId, ...row }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }
}
