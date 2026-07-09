// SyncManager: decides online vs offline and keeps the server's approved
// state and the local game reconciled.
//
//   · no server configured → 'offline' forever, game fully playable
//   · server unreachable   → 'offline', quiet retry every 60s
//   · server reachable     → register once (device credentials stored
//     locally), then push the coin journal on run end / purchases / every
//     90s; adopt the server's approved balance via core.applySync()
//
// The client never asserts wealth — it presents receipts. If the server
// clamps or rejects entries, the local balance follows the server.

import { fetchJson, hmacHex } from './api.js';

const ID_KEY = 'pf.net.device';
const SECRET_KEY = 'pf.net.secret';

export class SyncManager {
  #core;
  #storage;
  #url;
  #listeners = new Set();
  #timer = 0;
  #retryTimer = 0;
  #syncing = false;

  status = 'offline'; // 'offline' | 'connecting' | 'online'
  name = null; // server-assigned player name
  lastSync = null; // { coins, rejected } from the last good sync

  constructor({ core, storage, serverUrl }) {
    this.#core = core;
    this.#storage = storage;
    this.#url = (serverUrl ?? '').replace(/\/+$/, '');
  }

  get enabled() {
    return this.#url !== '';
  }

  onStatus(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #set(status) {
    if (this.status === status) return;
    this.status = status;
    for (const fn of [...this.#listeners]) fn(status);
  }

  async boot() {
    if (!this.enabled) return; // offline mode by configuration
    this.#set('connecting');
    const up = await this.#health();
    if (!up) {
      this.#set('offline');
      this.#scheduleRetry();
      return;
    }
    const creds = await this.#credentials();
    if (!creds) {
      this.#set('offline');
      this.#scheduleRetry();
      return;
    }
    await this.sync();
    if (this.status === 'online') {
      // periodic reconcile + on the moments that matter
      clearInterval(this.#timer);
      this.#timer = setInterval(() => this.sync(), 90_000);
      this.#core.events.on('run:end', () => this.sync());
      this.#core.events.on('shop:purchase', () => this.sync());
    }
  }

  async #health() {
    try {
      const { ok, data } = await fetchJson(`${this.#url}/health`, { timeoutMs: 3500 });
      return ok && data?.ok === true;
    } catch {
      return false;
    }
  }

  async #credentials() {
    try {
      const id = this.#storage.getItem(ID_KEY);
      const secret = this.#storage.getItem(SECRET_KEY);
      if (id && secret) return { deviceId: id, secret };
      const { ok, data } = await fetchJson(`${this.#url}/register`, { method: 'POST', timeoutMs: 4000 });
      if (!ok || !data?.deviceId) return null;
      this.#storage.setItem(ID_KEY, data.deviceId);
      this.#storage.setItem(SECRET_KEY, data.secret);
      this.name = data.name ?? null;
      return { deviceId: data.deviceId, secret: data.secret };
    } catch {
      return null;
    }
  }

  async sync() {
    if (!this.enabled || this.#syncing) return false;
    this.#syncing = true;
    try {
      const creds = await this.#credentials();
      if (!creds) throw new Error('no-credentials');

      const d = this.#core.save.data;
      const snapshot = {
        bestLevel: d.bestLevel,
        daily:
          d.daily.totalPlayed > 0 && d.daily.lastPlayedKey
            ? { dateKey: d.daily.lastPlayedKey, level: d.daily.lastLevel }
            : null,
      };
      const p = JSON.stringify({ journal: this.#core.getJournal(), snapshot });
      const sig = await hmacHex(creds.secret, p);
      if (!sig) throw new Error('no-webcrypto');

      const { ok, status, data } = await fetchJson(`${this.#url}/sync`, {
        method: 'POST',
        timeoutMs: 6000,
        body: { deviceId: creds.deviceId, p, sig },
      });
      if (status === 404) {
        // server lost us (wiped data dir?) — re-register next round
        this.#storage.removeItem(ID_KEY);
        this.#storage.removeItem(SECRET_KEY);
        throw new Error('unknown-device');
      }
      if (!ok) throw new Error(`sync-${status}`);

      this.#core.applySync({ coins: data.coins, uptoSeq: data.uptoSeq });
      this.name = data.name ?? this.name;
      this.lastSync = { coins: data.coins, rejected: data.rejected ?? [] };
      this.#set('online');
      return true;
    } catch {
      this.#set('offline');
      this.#scheduleRetry();
      return false;
    } finally {
      this.#syncing = false;
    }
  }

  #scheduleRetry() {
    clearTimeout(this.#retryTimer);
    this.#retryTimer = setTimeout(() => this.boot(), 60_000);
  }

  async leaderboard(board, date) {
    const query = board === 'daily' ? `board=daily&date=${encodeURIComponent(date)}` : 'board=best';
    const { ok, data } = await fetchJson(`${this.#url}/leaderboard?${query}`, { timeoutMs: 5000 });
    return ok ? (data.rows ?? []) : null;
  }
}
