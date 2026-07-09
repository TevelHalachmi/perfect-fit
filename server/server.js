// Perfect Fit server — zero-dependency Node HTTP backend.
//
//   node server/server.js            (PORT=8787 PF_DATA_DIR=server/data)
//
// Endpoints (all JSON, CORS-open so the GitHub Pages client can call in):
//   GET  /health                     liveness + protocol version
//   POST /register                   → { deviceId, secret, name }
//   POST /sync                       body { deviceId, p, sig }
//        p is a JSON STRING (journal + snapshot), sig = HMAC-SHA256(secret, p)
//        → { coins, uptoSeq, rejected[], name, leaderboard positions }
//   GET  /leaderboard?board=best     → { rows: [{name, value}] }
//   GET  /leaderboard?board=daily&date=YYYY-MM-DD
//
// The server is the source of truth for coins: it approves the offline
// journal entry by entry (validate.js) and returns its own balance. A
// client coming back from offline never "tells" the server its wealth —
// it shows receipts, and the receipts are audited.

import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Store } from './store.js';
import { applyJournal, sanitizeSnapshot, freshDeviceState } from './validate.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR =
  process.env.PF_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const PROTOCOL = 1;

const store = new Store(DATA_DIR);

const ADJECTIVES = ['Wobbly', 'Snug', 'Bouncy', 'Shiny', 'Sleepy', 'Zippy', 'Chunky', 'Dizzy', 'Mellow', 'Plucky', 'Cosmic', 'Turbo'];
const NOUNS = ['Star', 'Blob', 'Heart', 'Moon', 'Bolt', 'Hexa', 'Penny', 'Bloom', 'Gem', 'Boxy', 'Bloop', 'Comet'];

function cuteName(deviceId) {
  const h = crypto.createHash('sha256').update(deviceId).digest();
  return `${ADJECTIVES[h[0] % ADJECTIVES.length]} ${NOUNS[h[1] % NOUNS.length]} #${(h[2] * 256 + h[3]) % 10000}`;
}

const serverDayKey = () => new Date().toISOString().slice(0, 10);

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
  });
  res.end(data);
}

function readBody(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body-too-large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const hmac = (secret, text) => crypto.createHmac('sha256', secret).update(text).digest('hex');

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { ok: true, name: 'perfect-fit-server', protocol: PROTOCOL, time: Date.now() });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/register') {
      const deviceId = `pf_${crypto.randomBytes(8).toString('hex')}`;
      const secret = crypto.randomBytes(24).toString('hex');
      const device = { secret, name: cuteName(deviceId), state: freshDeviceState(), createdAt: Date.now() };
      store.putDevice(deviceId, device);
      json(res, 200, { deviceId, secret, name: device.name, protocol: PROTOCOL });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/sync') {
      const raw = await readBody(req);
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        json(res, 400, { error: 'bad-json' });
        return;
      }
      const { deviceId, p, sig } = body ?? {};
      const device = typeof deviceId === 'string' ? store.getDevice(deviceId) : null;
      if (!device) {
        json(res, 404, { error: 'unknown-device' });
        return;
      }
      if (typeof p !== 'string' || !timingSafeEqualHex(hmac(device.secret, p), sig)) {
        json(res, 401, { error: 'bad-signature' });
        return;
      }
      let payload;
      try {
        payload = JSON.parse(p);
      } catch {
        json(res, 400, { error: 'bad-payload' });
        return;
      }

      const ds = device.state;
      const day = serverDayKey();
      const { rejected, lastSeq } = applyJournal(ds, payload.journal, day);

      const snapshot = sanitizeSnapshot(payload.snapshot);
      if (snapshot.bestLevel > ds.bestLevel) ds.bestLevel = snapshot.bestLevel;
      store.putBest(deviceId, device.name, ds.bestLevel);
      if (snapshot.daily) store.putDaily(snapshot.daily.dateKey, deviceId, device.name, snapshot.daily.level);

      device.lastSyncAt = Date.now();
      store.putDevice(deviceId, device);

      json(res, 200, {
        coins: ds.balance,
        uptoSeq: lastSeq,
        rejected,
        name: device.name,
        bestLevel: ds.bestLevel,
        protocol: PROTOCOL,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/leaderboard') {
      const board = url.searchParams.get('board') ?? 'best';
      if (board === 'daily') {
        const date = url.searchParams.get('date') ?? serverDayKey();
        json(res, 200, { board, date, rows: store.topDaily(date) });
        return;
      }
      json(res, 200, { board: 'best', rows: store.topBest() });
      return;
    }

    json(res, 404, { error: 'not-found' });
  } catch (err) {
    json(res, 500, { error: 'server-error', detail: String(err?.message ?? err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`perfect-fit-server listening on http://${HOST}:${PORT} (data: ${DATA_DIR})`);
});

export default server;
