// Kawaii faces. Drawn on top of any shape in its local space; mood follows
// gameplay (idle → strain while growing → ecstatic/dead on release).
// All geometry is in units of the face radius fr.

const TAU = Math.PI * 2;

// mood: 'idle' | 'strain' | 'happy' | 'dead'
// t drives idle blinking and strain trembling (seconds, any epoch).
export function drawFace(ctx, shapeId, r, style, mood, t, anchor, intensity = 0) {
  const fr = r * anchor.scale;
  const fx = anchor.x * r;
  const fy = anchor.y * r;
  const ex = 0.36 * fr; // eye x offset
  const ey = -0.1 * fr; // eye y offset
  const er = 0.14 * fr; // eye radius

  ctx.save();
  ctx.translate(fx, fy);
  ctx.fillStyle = style.face;
  ctx.strokeStyle = style.face;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // blush is permanent — cuteness is not optional
  ctx.fillStyle = style.blush;
  ctx.beginPath();
  ctx.arc(-0.62 * fr, 0.16 * fr, 0.13 * fr, 0, TAU);
  ctx.arc(0.62 * fr, 0.16 * fr, 0.13 * fr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = style.face;

  if (mood === 'idle') {
    const blinking = t % 3.4 > 3.26;
    const winking = !blinking && t % 7.3 > 7.08; // a cheeky wink now and then
    if (blinking) {
      eyeLine(ctx, -ex, ey, er);
      eyeLine(ctx, ex, ey, er);
    } else if (winking) {
      ctx.lineWidth = Math.max(1.5, er * 0.6);
      happyEye(ctx, -ex, ey, er);
      eyeDot(ctx, ex, ey, er);
    } else {
      eyeDot(ctx, -ex, ey, er);
      eyeDot(ctx, ex, ey, er);
    }
    smile(ctx, fr, 0.32);
  } else if (mood === 'strain') {
    // eyes squeeze shut and the mouth wobbles as pressure builds
    const tremble = Math.sin(t * 43) * 0.03 * fr * (0.4 + intensity);
    ctx.lineWidth = Math.max(1.5, er * 0.55);
    squeezeEye(ctx, -ex, ey + tremble, er);
    squeezeEye(ctx, ex, ey - tremble, er);
    ctx.beginPath();
    const mw = 0.34 * fr;
    const my = 0.34 * fr;
    ctx.moveTo(-mw, my + tremble);
    ctx.quadraticCurveTo(0, my + (0.16 + intensity * 0.2) * fr, mw, my - tremble);
    ctx.stroke();
  } else if (mood === 'happy') {
    // ^ ^ eyes + big open smile
    ctx.lineWidth = Math.max(1.5, er * 0.6);
    happyEye(ctx, -ex, ey, er);
    happyEye(ctx, ex, ey, er);
    ctx.beginPath();
    ctx.arc(0, 0.22 * fr, 0.3 * fr, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.closePath();
    ctx.fill();
  } else if (mood === 'dead') {
    ctx.lineWidth = Math.max(1.5, er * 0.55);
    xEye(ctx, -ex, ey, er);
    xEye(ctx, ex, ey, er);
    ctx.beginPath();
    ctx.arc(0, 0.36 * fr, 0.12 * fr, 0, TAU);
    ctx.stroke();
  }

  ctx.restore();
}

function eyeDot(ctx, x, y, er) {
  ctx.beginPath();
  ctx.arc(x, y, er, 0, TAU);
  ctx.fill();
  // glint
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(x + er * 0.35, y - er * 0.35, er * 0.32, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function eyeLine(ctx, x, y, er) {
  ctx.lineWidth = Math.max(1.5, er * 0.5);
  ctx.beginPath();
  ctx.moveTo(x - er, y);
  ctx.lineTo(x + er, y);
  ctx.stroke();
}

function squeezeEye(ctx, x, y, er) {
  ctx.beginPath();
  ctx.moveTo(x - er, y - er * 0.3);
  ctx.quadraticCurveTo(x, y + er * 0.7, x + er, y - er * 0.3);
  ctx.stroke();
}

function happyEye(ctx, x, y, er) {
  ctx.beginPath();
  ctx.moveTo(x - er, y + er * 0.35);
  ctx.quadraticCurveTo(x, y - er * 1.05, x + er, y + er * 0.35);
  ctx.stroke();
}

function xEye(ctx, x, y, er) {
  const k = er * 0.8;
  ctx.beginPath();
  ctx.moveTo(x - k, y - k);
  ctx.lineTo(x + k, y + k);
  ctx.moveTo(x + k, y - k);
  ctx.lineTo(x - k, y + k);
  ctx.stroke();
}

function smile(ctx, fr, y) {
  ctx.lineWidth = Math.max(1.5, fr * 0.09);
  ctx.beginPath();
  ctx.moveTo(-0.26 * fr, y * fr);
  ctx.quadraticCurveTo(0, (y + 0.18) * fr, 0.26 * fr, y * fr);
  ctx.stroke();
}
