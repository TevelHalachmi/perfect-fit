// Share cards: a canvas-rendered score card plus the native share sheet,
// with graceful fallbacks all the way down to "here's the link" banner.
// UI-only — the core just records that a share happened.

import { drawShapeSprite } from './draw-shape.js';
import { traceShape } from './shapes.js';
import { getSkinStyle } from './skins.js';

const CARD_W = 1080;
const CARD_H = 1350;
export const PLAY_URL = 'https://tevelhalachmi.github.io/perfect-fit/';

export function buildShareText(result) {
  if (result?.mode === 'daily' && result.daily) {
    const flame = result.daily.streak >= 2 ? ` 🔥${result.daily.streak}` : '';
    return `Perfect Fit Daily #${result.daily.number}${flame} — level ${result.levelReached}. Same shapes, same day. Beat me:`;
  }
  if (result?.mode === 'zen') {
    return `I fitted ${result.successes} shapes in Perfect Fit's zen mode 🧘 Come breathe:`;
  }
  return `I reached level ${result?.levelReached ?? 1} in Perfect Fit! 🎯 Think you can fit?`;
}

export function renderShareCard({ result, state }) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  const style = getSkinStyle(state.equippedSkin);
  const happy = Boolean(result?.isNewBest || result?.mode === 'daily' || result?.mode === 'zen');

  // background: skin gradient + deterministic star dots
  const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
  g.addColorStop(0, style.bg[0]);
  g.addColorStop(1, style.bg[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  let s = 4242;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = style.dots;
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.6;
    ctx.beginPath();
    ctx.arc(rnd() * CARD_W, rnd() * CARD_H, 1.5 + rnd() * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const font = (size, weight = 900) =>
    `${weight} ${size}px "Baloo 2", Nunito, "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';

  // headline
  ctx.fillStyle = '#ffffff';
  ctx.font = font(92);
  ctx.fillText('PERFECT FIT', CARD_W / 2, 150);
  ctx.fillStyle = style.glow;
  ctx.font = font(40, 800);
  ctx.fillText('hold to grow · release to fit', CARD_W / 2, 214);

  // the shape, almost fitting its outline
  const cx = CARD_W / 2;
  const cy = 640;
  const shapeId = state.equippedShape;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = style.outline;
  ctx.setLineDash([34, 26]);
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  traceShape(ctx, shapeId, 320, { blobSeed: 7 });
  ctx.stroke();
  ctx.setLineDash([]);
  drawShapeSprite(ctx, {
    shapeId,
    r: 296,
    style,
    mood: happy ? 'happy' : 'dead',
    t: 1,
    blobSeed: 7,
  });
  ctx.restore();

  // the score
  ctx.fillStyle = '#ffffff';
  if (result?.mode === 'daily' && result.daily) {
    const flame = result.daily.streak >= 2 ? ` · 🔥${result.daily.streak}` : '';
    ctx.font = font(58);
    ctx.fillStyle = style.glow;
    ctx.fillText(`DAILY #${result.daily.number}${flame}`, CARD_W / 2, 1032);
    ctx.fillStyle = '#ffffff';
    ctx.font = font(96);
    ctx.fillText(`LEVEL ${result.levelReached}`, CARD_W / 2, 1140);
  } else if (result?.mode === 'zen') {
    ctx.font = font(58);
    ctx.fillStyle = style.glow;
    ctx.fillText('🧘 ZEN SESSION', CARD_W / 2, 1032);
    ctx.fillStyle = '#ffffff';
    ctx.font = font(96);
    ctx.fillText(`${result.successes} SHAPES FITTED`, CARD_W / 2, 1140);
  } else {
    ctx.font = font(96);
    ctx.fillText(`LEVEL ${result?.levelReached ?? 1}`, CARD_W / 2, 1080);
    if (result?.isNewBest) {
      ctx.font = font(46);
      ctx.fillStyle = '#ffd166';
      ctx.fillText('★ NEW BEST ★', CARD_W / 2, 1145);
    }
  }

  // stat strip
  const bits = [];
  if (result?.bestAccuracy) bits.push(`⭐ ${result.bestAccuracy.toFixed(1)}% best`);
  if (result?.bestStreak >= 2) bits.push(`🔥 ${result.bestStreak} streak`);
  if (result?.runCoins > 0) bits.push(`🪙 ${result.runCoins}`);
  if (bits.length) {
    ctx.font = font(40, 800);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(bits.join('   ·   '), CARD_W / 2, 1218);
  }

  // footer
  ctx.font = font(36, 800);
  ctx.fillStyle = style.glow;
  ctx.fillText(PLAY_URL.replace('https://', 'play at '), CARD_W / 2, 1300);

  return canvas;
}

export function cardToBlob(canvas) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

// Share chain. Returns how it went: 'shared' | 'copied' | 'shown' | 'aborted'.
// The blob should be pre-rendered (iOS voids the gesture across async work).
export async function shareResult({ blob, text }) {
  const url = PLAY_URL;
  try {
    if (blob && navigator.canShare) {
      const file = new File([blob], 'perfect-fit.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, url });
        return 'shared';
      }
    }
    if (navigator.share) {
      await navigator.share({ text, url });
      return 'shared';
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return 'aborted'; // user closed the sheet
    /* fall through to clipboard */
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return 'copied';
  } catch {
    return 'shown';
  }
}
