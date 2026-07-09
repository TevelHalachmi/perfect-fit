// Draws one complete "character": shape body (gradient fill + skin finish
// + gloss + edge) with its kawaii face, everything clipped to the body so
// nothing spills on slim shapes. Shared by the game renderer, title screen,
// shop previews and share cards.
//
// All finish geometry is deterministic and expressed in units of r, so it
// scales with the shape and never allocates.

import { traceShape, faceAnchor } from './shapes.js';
import { drawFace } from './faces.js';

const TAU = Math.PI * 2;

export function drawShapeSprite(
  ctx,
  { shapeId, r, style, mood = 'idle', t = 0, blobSeed = 1, intensity = 0, edgeWidth }
) {
  const fill = ctx.createLinearGradient(0, -r, 0, r);
  fill.addColorStop(0, style.shape[0]);
  fill.addColorStop(1, style.shape[1]);
  ctx.fillStyle = fill;
  traceShape(ctx, shapeId, r, { blobSeed });
  ctx.fill();

  ctx.save();
  ctx.clip();
  drawPattern(ctx, r, style);
  drawGloss(ctx, r);
  drawFace(ctx, shapeId, r, style, mood, t, faceAnchor(shapeId), intensity);
  ctx.restore();

  // edge stroke last so it stays crisp above the finish
  ctx.lineWidth = edgeWidth ?? Math.max(2, r * 0.05);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = style.shapeEdge;
  traceShape(ctx, shapeId, r, { blobSeed });
  ctx.stroke();
}

// Soft light from the top-left + a whisper of ground shadow: instant candy.
function drawGloss(ctx, r) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.4, r * 0.48, r * 0.3, -0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.62, r * 0.62, r * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPattern(ctx, r, style) {
  switch (style.pattern) {
    case 'candy': return candy(ctx, r);
    case 'waves': return waves(ctx, r);
    case 'scanlines': return scanlines(ctx, r, style);
    case 'bands': return bands(ctx, r);
    case 'nebula': return nebula(ctx, r);
    case 'veins': return veins(ctx, r);
    case 'sheen': return sheen(ctx, r);
    default: return undefined;
  }
}

function candy(ctx, r) {
  ctx.save();
  ctx.rotate(-Math.PI / 5);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  for (let x = -1.6; x <= 1.6; x += 0.46) {
    ctx.fillRect(x * r, -1.7 * r, 0.17 * r, 3.4 * r);
  }
  ctx.restore();
}

function waves(ctx, r) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  for (const y0 of [0.18, 0.62]) {
    ctx.beginPath();
    ctx.moveTo(-1.4 * r, y0 * r);
    for (let i = 0; i <= 20; i++) {
      const x = -1.4 + (2.8 * i) / 20;
      ctx.lineTo(x * r, (y0 + 0.06 * Math.sin(i * 0.9)) * r);
    }
    ctx.lineTo(1.4 * r, 1.7 * r);
    ctx.lineTo(-1.4 * r, 1.7 * r);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = Math.max(1, r * 0.03);
  for (const [bx, by, br] of [[-0.38, -0.34, 0.07], [0.18, -0.55, 0.05], [0.46, -0.2, 0.085]]) {
    ctx.beginPath();
    ctx.arc(bx * r, by * r, br * r, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function scanlines(ctx, r, style) {
  ctx.save();
  // inner rim glow (wide stroke, half clipped away)
  ctx.strokeStyle = style.glow;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = r * 0.22;
  ctx.stroke(); // strokes the current (clipped) path
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = -1; y <= 1; y += 0.16) {
    ctx.fillRect(-1.6 * r, y * r, 3.2 * r, 0.05 * r);
  }
  ctx.restore();
}

function bands(ctx, r) {
  ctx.save();
  const alphas = [0.18, 0.13, 0.09];
  [0.12, 0.42, 0.7].forEach((y, i) => {
    ctx.fillStyle = `rgba(255,240,200,${alphas[i]})`;
    ctx.fillRect(-1.6 * r, y * r, 3.2 * r, 0.13 * r);
  });
  ctx.restore();
}

function nebula(ctx, r) {
  ctx.save();
  const blob = (x, y, radius, color) => {
    const g = ctx.createRadialGradient(x * r, y * r, 0, x * r, y * r, radius * r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-1.6 * r, -1.6 * r, 3.2 * r, 3.2 * r);
  };
  blob(-0.32, -0.28, 0.75, 'rgba(120,220,255,0.30)');
  blob(0.4, 0.34, 0.65, 'rgba(255,120,220,0.24)');
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x, y, s] of [
    [-0.55, 0.1, 0.028], [-0.15, -0.62, 0.02], [0.2, -0.15, 0.032],
    [0.58, -0.42, 0.02], [0.05, 0.55, 0.024], [-0.4, -0.55, 0.018], [0.62, 0.12, 0.022],
  ]) {
    ctx.beginPath();
    ctx.arc(x * r, y * r, s * r, 0, TAU);
    ctx.fill();
  }
  sparkle(ctx, 0.3 * r, -0.38 * r, 0.11 * r, 'rgba(255,255,255,0.9)');
  ctx.restore();
}

function veins(ctx, r) {
  ctx.save();
  ctx.lineCap = 'round';
  const vein = (pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * r, pts[0][1] * r);
    for (let i = 1; i < pts.length - 1; i += 2) {
      ctx.quadraticCurveTo(pts[i][0] * r, pts[i][1] * r, pts[i + 1][0] * r, pts[i + 1][1] * r);
    }
    ctx.strokeStyle = 'rgba(255,230,140,0.16)';
    ctx.lineWidth = r * 0.11;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,170,0.55)';
    ctx.lineWidth = r * 0.035;
    ctx.stroke();
  };
  vein([[-0.9, 0.35], [-0.4, 0.05], [-0.05, 0.35], [0.35, 0.6], [0.85, 0.4]]);
  vein([[-0.6, 0.85], [-0.2, 0.55], [0.15, 0.8]]);
  vein([[0.15, -0.9], [0.35, -0.5], [0.6, -0.7]]);
  for (const [x, y] of [[-0.5, 0.5], [0.3, 0.75], [0.7, 0.15], [-0.15, 0.9]]) {
    const g = ctx.createRadialGradient(x * r, y * r, 0, x * r, y * r, 0.08 * r);
    g.addColorStop(0, 'rgba(255,240,150,0.9)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x * r, y * r, 0.08 * r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function sheen(ctx, r) {
  ctx.save();
  ctx.rotate(-Math.PI / 4);
  const g = ctx.createLinearGradient(-0.5 * r, 0, 0.35 * r, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-0.55 * r, -1.7 * r, 0.95 * r, 3.4 * r);
  ctx.restore();
  sparkle(ctx, -0.42 * r, -0.3 * r, 0.1 * r, 'rgba(255,255,255,0.95)');
  sparkle(ctx, 0.5 * r, 0.42 * r, 0.075 * r, 'rgba(255,255,255,0.8)');
  sparkle(ctx, 0.25 * r, -0.55 * r, 0.06 * r, 'rgba(255,255,255,0.7)');
  ctx.save();
  ctx.fillStyle = 'rgba(120,80,0,0.18)';
  for (const [x, y] of [[-0.6, 0.55], [-0.1, 0.72], [0.55, 0.6], [0.05, 0.35], [-0.35, 0.15]]) {
    ctx.beginPath();
    ctx.arc(x * r, y * r, 0.022 * r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Four-point twinkle.
function sparkle(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(s * 0.18, -s * 0.18, s, 0);
  ctx.quadraticCurveTo(s * 0.18, s * 0.18, 0, s);
  ctx.quadraticCurveTo(-s * 0.18, s * 0.18, -s, 0);
  ctx.quadraticCurveTo(-s * 0.18, -s * 0.18, 0, -s);
  ctx.fill();
  ctx.restore();
}
