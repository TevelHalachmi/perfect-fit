// Pooled particle system. The pool is allocated once; bursts recycle dead
// slots and draw costs nothing when idle. Zero allocation per frame.

const POOL_SIZE = 320;

export class ParticleSystem {
  constructor() {
    this.pool = Array.from({ length: POOL_SIZE }, () => ({
      active: false,
      kind: 'rect', // 'rect' | 'dot' | 'shard'
      x: 0, y: 0, vx: 0, vy: 0,
      rot: 0, vrot: 0,
      size: 4, color: '#fff',
      life: 0, ttl: 1,
      gravity: 600,
    }));
    this.activeCount = 0;
  }

  get poolSize() {
    return POOL_SIZE;
  }

  burst({
    x, y, colors, count = 40, speed = [120, 420], ttl = [0.5, 1.1],
    size = [3, 8], gravity = 700, kind = 'confetti', angle = null, spread = Math.PI * 2,
  }) {
    let spawned = 0;
    for (const p of this.pool) {
      if (spawned >= count) break;
      if (p.active) continue;
      spawned++;
      p.active = true;
      const a = angle == null ? Math.random() * Math.PI * 2 : angle + (Math.random() - 0.5) * spread;
      const v = speed[0] + Math.random() * (speed[1] - speed[0]);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v - (kind === 'confetti' ? 140 : kind === 'mote' ? 0 : 40);
      p.rot = Math.random() * Math.PI * 2;
      p.vrot = (Math.random() - 0.5) * 14;
      p.size = size[0] + Math.random() * (size[1] - size[0]);
      p.color = colors[(Math.random() * colors.length) | 0];
      p.ttl = ttl[0] + Math.random() * (ttl[1] - ttl[0]);
      p.life = 0;
      p.gravity = gravity;
      p.kind =
        kind === 'confetti' ? (Math.random() < 0.4 ? 'dot' : 'rect') : kind === 'mote' ? 'dot' : 'shard';
    }
    this.activeCount = this.pool.reduce((n, p) => n + (p.active ? 1 : 0), 0);
  }

  update(dt) {
    let n = 0;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.ttl) {
        p.active = false;
        continue;
      }
      n++;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.6 * dt; // air drag
      p.rot += p.vrot * dt;
    }
    this.activeCount = n;
  }

  draw(ctx) {
    if (this.activeCount === 0) return;
    for (const p of this.pool) {
      if (!p.active) continue;
      const k = p.life / p.ttl;
      ctx.save();
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.kind === 'dot') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'shard') {
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 0.7);
        ctx.lineTo(p.size * 0.6, p.size * 0.5);
        ctx.lineTo(-p.size * 0.6, p.size * 0.5);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }
  }
}
