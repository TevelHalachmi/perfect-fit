// The twelve shapes, drawn procedurally. Each entry traces a closed path
// centred on the origin at "radius" r (target and player use the same path
// at different r, so fit judgment is purely about scale). Corners are
// rounded and proportions tuned to look plump and friendly.
//
// face: where the kawaii face sits, in units of r.

import { createRng } from '../core/rng.js';

const TAU = Math.PI * 2;

// Trace a polygon with rounded corners.
function roundedPoly(ctx, pts, radius) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const v1 = norm(p[0] - prev[0], p[1] - prev[1]);
    const v2 = norm(next[0] - p[0], next[1] - p[1]);
    const r = Math.min(radius, dist(p, prev) / 2, dist(p, next) / 2);
    const a = [p[0] - v1[0] * r, p[1] - v1[1] * r];
    const b = [p[0] + v2[0] * r, p[1] + v2[1] * r];
    if (i === 0) ctx.moveTo(a[0], a[1]);
    else ctx.lineTo(a[0], a[1]);
    ctx.quadraticCurveTo(p[0], p[1], b[0], b[1]);
  }
  ctx.closePath();
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function norm(x, y) {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

function regularPoints(sides, r, startAngle = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = startAngle + (i / sides) * TAU;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

function starPoints(r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * TAU;
    const rr = i % 2 === 0 ? r : r * 0.52;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return pts;
}

// Smooth closed polar curve r(θ), sampled and drawn with quadratic midpoints.
function polarCurve(ctx, radiusAt, steps = 96) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    const rr = radiusAt(a);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  ctx.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
  for (let i = 1; i <= steps; i++) {
    const p = pts[i % steps];
    const q = pts[(i + 1) % steps];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

// Blob lobe amplitudes come from the round seed — target and player pass the
// same seed, so they are always the same blob.
function blobRadius(seed) {
  const rng = createRng(seed);
  const a2 = rng.range(0.05, 0.1);
  const a3 = rng.range(0.04, 0.08);
  const a4 = rng.range(0.02, 0.05);
  const p2 = rng() * TAU;
  const p3 = rng() * TAU;
  const p4 = rng() * TAU;
  return (a) =>
    1 + a2 * Math.sin(2 * a + p2) + a3 * Math.sin(3 * a + p3) + a4 * Math.sin(4 * a + p4);
}

export const SHAPE_DEFS = {
  circle: {
    face: { x: 0, y: 0, scale: 1 },
    path(ctx, r) {
      ctx.arc(0, 0, r, 0, TAU);
      ctx.closePath();
    },
  },

  square: {
    face: { x: 0, y: 0, scale: 1 },
    path(ctx, r) {
      const a = r * 0.88;
      roundedPoly(ctx, [[-a, -a], [a, -a], [a, a], [-a, a]], r * 0.24);
    },
  },

  triangle: {
    face: { x: 0, y: 0.18, scale: 0.9 },
    path(ctx, r) {
      roundedPoly(ctx, regularPoints(3, r * 1.1), r * 0.16);
    },
  },

  hexagon: {
    face: { x: 0, y: 0, scale: 1 },
    path(ctx, r) {
      roundedPoly(ctx, regularPoints(6, r * 1.02), r * 0.14);
    },
  },

  pentagon: {
    face: { x: 0, y: 0.05, scale: 0.95 },
    path(ctx, r) {
      roundedPoly(ctx, regularPoints(5, r * 1.05), r * 0.15);
    },
  },

  star: {
    face: { x: 0, y: 0.02, scale: 0.8 },
    path(ctx, r) {
      roundedPoly(ctx, starPoints(r * 1.12), r * 0.1);
    },
  },

  diamond: {
    face: { x: 0, y: 0, scale: 0.8 },
    path(ctx, r) {
      roundedPoly(ctx, [[0, -r * 1.12], [r * 0.82, 0], [0, r * 1.12], [-r * 0.82, 0]], r * 0.14);
    },
  },

  heart: {
    face: { x: 0, y: 0.05, scale: 0.9 },
    path(ctx, r) {
      const s = r * 1.08;
      ctx.moveTo(0, -0.28 * s);
      ctx.bezierCurveTo(-0.12 * s, -0.62 * s, -0.68 * s, -0.68 * s, -0.76 * s, -0.24 * s);
      ctx.bezierCurveTo(-0.82 * s, 0.12 * s, -0.38 * s, 0.44 * s, 0, 0.74 * s);
      ctx.bezierCurveTo(0.38 * s, 0.44 * s, 0.82 * s, 0.12 * s, 0.76 * s, -0.24 * s);
      ctx.bezierCurveTo(0.68 * s, -0.68 * s, 0.12 * s, -0.62 * s, 0, -0.28 * s);
      ctx.closePath();
    },
  },

  blob: {
    face: { x: 0, y: 0, scale: 0.95 },
    path(ctx, r, opts = {}) {
      const shapeFn = blobRadius(opts.blobSeed ?? 1);
      polarCurve(ctx, (a) => r * shapeFn(a));
    },
  },

  crescent: {
    face: { x: -0.52, y: 0, scale: 0.6 },
    path(ctx, r) {
      // outer circle body, then the concave bite (precomputed intersections)
      ctx.arc(0, 0, r, 0.925, TAU - 0.925, false);
      ctx.arc(0.55 * r, 0, 0.8 * r, -1.5057, 1.5057, true);
      ctx.closePath();
    },
  },

  flower: {
    face: { x: 0, y: 0, scale: 0.78 },
    path(ctx, r) {
      polarCurve(ctx, (a) => r * (0.82 + 0.22 * Math.cos(6 * a)), 144);
    },
  },

  lightning: {
    face: { x: 0, y: -0.55, scale: 0.5 },
    path(ctx, r) {
      const pts = [
        [-0.22, -1.05], [0.4, -1.05], [0.14, -0.28], [0.52, -0.28],
        [-0.3, 1.05], [-0.02, 0.22], [-0.42, 0.22],
      ].map(([x, y]) => [x * r, y * r]);
      roundedPoly(ctx, pts, r * 0.07);
    },
  },
};

export function traceShape(ctx, shapeId, r, opts) {
  ctx.beginPath();
  (SHAPE_DEFS[shapeId] ?? SHAPE_DEFS.circle).path(ctx, r, opts);
}

export function faceAnchor(shapeId) {
  return (SHAPE_DEFS[shapeId] ?? SHAPE_DEFS.circle).face;
}

export const ALL_SHAPE_IDS = Object.keys(SHAPE_DEFS);
