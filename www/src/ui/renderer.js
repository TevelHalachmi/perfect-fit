// Canvas renderer. Pure presentation: reads a frame description each rAF
// and draws it. All gameplay motion arrives inside the round view; the
// renderer adds only cosmetics (dash march, glow, dots, squash, shake).

import { traceShape } from './shapes.js';
import { drawShapeSprite } from './draw-shape.js';
import { getSkinStyle } from './skins.js';
import { TUNING } from '../core/constants.js';

const TAU = Math.PI * 2;
const DOT_COUNT = 42;

export class Renderer {
  #canvas;
  #ctx;
  #w = 0; // CSS px
  #h = 0;
  #cx = 0;
  #cy = 0;
  #R = 100; // target radius in CSS px
  #bgCache = null; // { key, gradient, halo, dots }
  #onResize;

  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this.#onResize = () => this.resize();
    window.addEventListener('resize', this.#onResize);
    window.addEventListener('orientationchange', this.#onResize);
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.#w = this.#canvas.clientWidth;
    this.#h = this.#canvas.clientHeight;
    this.#canvas.width = Math.max(1, Math.round(this.#w * dpr));
    this.#canvas.height = Math.max(1, Math.round(this.#h * dpr));
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.#cx = this.#w / 2;
    this.#cy = this.#h * 0.46;
    this.#R = Math.min(this.#w * 0.36, this.#h * 0.26);
    this.#bgCache = null; // gradients are size-dependent
  }

  get metrics() {
    return { w: this.#w, h: this.#h, cx: this.#cx, cy: this.#cy, R: this.#R };
  }

  // frame: { mode, view, skinId, shapeId, level, mood, moodIntensity, t,
  //          fx: {shakeX,shakeY,squashX,squashY,flash}, hidePlayer,
  //          particles, drawTexts }
  draw(frame) {
    const ctx = this.#ctx;
    const style = getSkinStyle(frame.skinId);
    const fx = frame.fx ?? {};

    this.#paintBackground(style, frame.skinId, frame.level ?? 0, frame.t ?? 0);

    ctx.save();
    if (fx.shakeX || fx.shakeY) ctx.translate(fx.shakeX ?? 0, fx.shakeY ?? 0);

    if (frame.mode === 'title') {
      this.#drawTitleShape(frame, style);
    } else if (frame.view) {
      // boss rounds get a camera zoom: target AND player scale together so
      // what you see is exactly what's judged
      const baseR = this.#R * (frame.view.boss ? TUNING.boss.visualScale : 1);
      // outline drawn on top so the reference stays visible at near-fit sizes
      if (!frame.hidePlayer) this.#drawPlayer(frame, style, baseR);
      this.#drawTarget(frame.view, style, frame.t, baseR);
    }

    frame.particles?.draw(ctx);
    frame.drawTexts?.(ctx);
    ctx.restore();

    if (fx.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, fx.flash);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, this.#w, this.#h);
      ctx.restore();
    }
  }

  #paintBackground(style, skinId, level, t) {
    const ctx = this.#ctx;
    const hueStep = 8 * Math.floor(Math.max(0, level - 1) / 3); // shift every 3 levels
    const key = `${skinId}|${hueStep}|${this.#w}x${this.#h}`;
    if (!this.#bgCache || this.#bgCache.key !== key) {
      const top = shiftHue(style.bg[0], hueStep);
      const bottom = shiftHue(style.bg[1], hueStep * 0.6);
      const g = ctx.createLinearGradient(0, 0, 0, this.#h);
      g.addColorStop(0, top);
      g.addColorStop(1, bottom);
      const halo = ctx.createRadialGradient(
        this.#cx, this.#cy, this.#R * 0.2,
        this.#cx, this.#cy, Math.max(this.#w, this.#h) * 0.75
      );
      halo.addColorStop(0, 'rgba(255,255,255,0.07)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      // deterministic little stars, twinkle phase baked per dot
      let s = 1234 + this.#w * 7 + this.#h;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const dots = Array.from({ length: DOT_COUNT }, () => ({
        x: rnd() * this.#w,
        y: rnd() * this.#h,
        r: 0.6 + rnd() * 1.7,
        phase: rnd() * TAU,
        speed: 0.4 + rnd() * 1.1,
      }));
      this.#bgCache = { key, gradient: g, halo, dots };
    }
    ctx.fillStyle = this.#bgCache.gradient;
    ctx.fillRect(0, 0, this.#w, this.#h);
    ctx.fillStyle = this.#bgCache.halo;
    ctx.fillRect(0, 0, this.#w, this.#h);

    ctx.save();
    ctx.fillStyle = style.dots;
    for (const d of this.#bgCache.dots) {
      ctx.globalAlpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * d.speed + d.phase));
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  #drawTarget(view, style, t, baseR = this.#R) {
    const ctx = this.#ctx;
    const R = baseR * view.targetScale;
    const x = this.#cx + view.driftX * baseR;
    const y = this.#cy + view.driftY * baseR;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(view.angle);
    ctx.globalAlpha = Math.max(0, Math.min(1, view.ghostAlpha));

    // in-band glow — the training wheel that vanishes after level 9
    if (view.inBand && view.level <= TUNING.inBandGlowMaxLevel) {
      const glowAlpha = view.inBand === 'perfect' ? 0.5 : 0.28;
      for (let i = 3; i >= 1; i--) {
        ctx.save();
        ctx.globalAlpha *= glowAlpha / i;
        ctx.lineWidth = 4 + i * 7;
        ctx.strokeStyle = style.glow;
        traceShape(ctx, view.shapeId, R, { blobSeed: view.blobSeed });
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.setLineDash([baseR * 0.11, baseR * 0.085]);
    ctx.lineDashOffset = -t * baseR * 0.06; // slow marching ants
    ctx.lineWidth = Math.max(2.5, baseR * 0.028);
    ctx.lineCap = 'round';
    ctx.strokeStyle = style.outline;
    traceShape(ctx, view.shapeId, R, { blobSeed: view.blobSeed });
    ctx.stroke();

    if (view.boss) this.#drawBossFace(view, style, R);
    ctx.restore();
  }

  // Angry brows + a little crown on the outline: the boss means business.
  #drawBossFace(view, style, R) {
    const ctx = this.#ctx;
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = style.outline;
    ctx.fillStyle = style.outline;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, R * 0.045);

    // eyebrows, slanted inward
    ctx.beginPath();
    ctx.moveTo(-R * 0.38, -R * 0.34);
    ctx.lineTo(-R * 0.14, -R * 0.22);
    ctx.moveTo(R * 0.38, -R * 0.34);
    ctx.lineTo(R * 0.14, -R * 0.22);
    ctx.stroke();

    // crown perched on top
    const cw = R * 0.34;
    const cy = -R * 1.06;
    ctx.beginPath();
    ctx.moveTo(-cw / 2, cy);
    ctx.lineTo(-cw / 2, cy - R * 0.16);
    ctx.lineTo(-cw / 6, cy - R * 0.06);
    ctx.lineTo(0, cy - R * 0.2);
    ctx.lineTo(cw / 6, cy - R * 0.06);
    ctx.lineTo(cw / 2, cy - R * 0.16);
    ctx.lineTo(cw / 2, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  #drawPlayer(frame, style, baseR = this.#R) {
    const ctx = this.#ctx;
    const view = frame.view;
    const r = baseR * view.size;
    const x = this.#cx + view.wobbleX * baseR;
    const y = this.#cy + view.wobbleY * baseR;
    const fx = frame.fx ?? {};

    // faint streaks flying with the wind while it pushes
    if (view.wind && view.holding) {
      const mag = Math.hypot(view.wind.x, view.wind.y);
      if (mag > 0.008) this.#drawWindStreaks(view, x, y, baseR, frame.t);
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(view.angle);
    if (fx.squashX || fx.squashY) ctx.scale(fx.squashX ?? 1, fx.squashY ?? 1);
    drawShapeSprite(ctx, {
      shapeId: view.shapeId,
      r,
      style,
      mood: frame.mood ?? 'idle',
      t: frame.t,
      blobSeed: view.blobSeed,
      intensity: frame.moodIntensity ?? 0,
    });
    ctx.restore();
  }

  #drawWindStreaks(view, px, py, baseR, t) {
    const ctx = this.#ctx;
    const angle = Math.atan2(view.wind.y, view.wind.x);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const lane = (i - 2.5) * baseR * 0.22;
      const phase = (t * 1.6 + i * 0.37) % 1;
      const x = -baseR * (1.15 - phase * 0.9);
      ctx.globalAlpha = 0.28 * Math.sin(phase * Math.PI);
      ctx.beginPath();
      ctx.moveTo(x, lane + Math.sin(t * 3 + i) * 3);
      ctx.lineTo(x + baseR * 0.2, lane + Math.sin(t * 3 + i) * 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  #drawTitleShape(frame, style) {
    const ctx = this.#ctx;
    const r = this.#R * 0.62;
    const bob = Math.sin(frame.t * 1.6) * this.#R * 0.05;
    const tilt = Math.sin(frame.t * 0.9) * 0.06;

    ctx.save();
    ctx.translate(this.#cx, this.#cy + this.#R * 0.1 + bob);
    ctx.rotate(tilt);
    drawShapeSprite(ctx, { shapeId: frame.shapeId, r, style, mood: 'idle', t: frame.t, blobSeed: 7 });
    ctx.restore();
  }
}

// Rotate a #rrggbb color's hue by deg (via HSL round-trip).
function shiftHue(hex, deg) {
  if (!deg) return hex;
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) / 255;
  let g = ((n >> 8) & 255) / 255;
  let b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  h = (h + deg / 360) % 1;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const chan = (tc) => {
    let tt = tc;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const toHex = (v) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(chan(h + 1 / 3))}${toHex(chan(h))}${toHex(chan(h - 1 / 3))}`;
}
