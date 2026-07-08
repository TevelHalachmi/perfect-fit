// Draws one complete "character": shape body (gradient fill + edge) with
// its kawaii face clipped to the body so nothing spills on slim shapes.
// Shared by the game renderer, title screen and shop previews.

import { traceShape, faceAnchor } from './shapes.js';
import { drawFace } from './faces.js';

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
  ctx.lineWidth = edgeWidth ?? Math.max(2, r * 0.05);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = style.shapeEdge;
  ctx.stroke();

  ctx.save();
  ctx.clip();
  drawFace(ctx, shapeId, r, style, mood, t, faceAnchor(shapeId), intensity);
  ctx.restore();
}
