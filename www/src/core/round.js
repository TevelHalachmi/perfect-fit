// One round's simulation: growth, wobble, drift, pulse, rotation, ghosting.
// All motion is computed here (deterministically, from the round seed) so
// gameplay is identical under test and on screen — the renderer only draws.

import { TUNING as T } from './constants.js';
import {
  growthRate,
  wobbleAmp,
  wobbleFreq,
  toleranceBands,
  popThreshold,
  driftRadius,
  rotateSpeed,
  pulseAmp,
  modifiersFor,
} from './difficulty.js';
import { createRng } from './rng.js';

const TAU = Math.PI * 2;

export function createRound({ level, shapeId, seed, upgrades = {} }) {
  const rng = createRng(seed);
  return {
    level,
    shapeId,
    seed,
    upgrades,
    modifiers: modifiersFor(level, rng),
    state: 'idle', // 'idle' | 'holding'
    time: 0, // since round start (drives target pulse/drift)
    holdTime: 0, // since hold start (drives growth/wobble/ghost)
    size: T.startSize,
    targetScale: 1,
    wobbleX: 0,
    wobbleY: 0,
    driftX: 0,
    driftY: 0,
    angle: 0, // radians, shared by target and player
    ghostAlpha: 1,
    // per-round randomized phases so no two rounds shake alike
    phases: {
      wx1: rng() * TAU, wy1: rng() * TAU,
      wx2: rng() * TAU, wy2: rng() * TAU,
      dx: rng() * TAU, dy: rng() * TAU,
      pulse: rng() * TAU,
    },
    blobSeed: rng.int(1, 1 << 30), // irregular shapes: target & player must match
  };
}

export function startHold(round) {
  round.state = 'holding';
  round.holdTime = 0;
}

export function resetHold(round) {
  round.state = 'idle';
  round.holdTime = 0;
  round.size = T.startSize;
  round.wobbleX = 0;
  round.wobbleY = 0;
  round.ghostAlpha = 1;
}

// Advance the sim. Returns 'pop' if the shape burst past the limit.
export function tickRound(round, dt) {
  const { level, upgrades, modifiers, phases } = round;
  round.time += dt;

  // Target-side motion runs whether or not you're holding.
  if (modifiers.includes('pulse')) {
    round.targetScale = 1 + pulseAmp(level) * Math.sin(TAU * T.pulse.freq * round.time + phases.pulse);
  }
  if (modifiers.includes('drift')) {
    const r = driftRadius(level) || T.drift.radius;
    round.driftX = r * Math.sin(TAU * T.drift.freq * round.time + phases.dx);
    round.driftY = r * Math.sin(TAU * T.drift.freq * 0.777 * round.time + phases.dy);
  }
  if (modifiers.includes('rotate')) {
    round.angle += ((rotateSpeed(level) * Math.PI) / 180) * dt;
  }

  if (round.state !== 'holding') return null;

  round.holdTime += dt;

  // Growth (optionally surging under OSCILLATE — always positive).
  let g = growthRate(level, upgrades.zen ?? 0);
  if (modifiers.includes('oscillate')) {
    g *= 1 + T.oscillate.depth * Math.sin(TAU * T.oscillate.freq * round.holdTime);
  }
  round.size += g * dt;

  // Wobble: two detuned sines per axis, amplitude swells with size².
  const A = wobbleAmp(level, upgrades.steady ?? 0) * round.size * round.size;
  const f1 = wobbleFreq(level);
  const f2 = f1 * 1.7;
  const t = round.holdTime;
  round.wobbleX = A * (0.6 * Math.sin(TAU * f1 * t + phases.wx1) + 0.4 * Math.sin(TAU * f2 * t + phases.wx2));
  round.wobbleY = A * (0.6 * Math.sin(TAU * f1 * t + phases.wy1) + 0.4 * Math.sin(TAU * f2 * t + phases.wy2));

  // Ghost: outline fades while you hold, with a merciful flash.
  if (modifiers.includes('ghost')) {
    const fade = Math.max(0, 1 - round.holdTime / T.ghost.fadeSeconds);
    const inFlash = round.holdTime % T.ghost.flashEvery < T.ghost.flashSeconds;
    round.ghostAlpha = inFlash ? Math.max(fade, T.ghost.flashAlpha) : fade;
  }

  if (currentRatio(round) > popThreshold(level)) return 'pop';
  return null;
}

export const currentRatio = (round) => round.size / round.targetScale;

// Everything the renderer and HUD need to draw a frame.
export function roundView(round) {
  const bands = toleranceBands(round.level, round.upgrades.forgive ?? 0);
  const ratio = currentRatio(round);
  const err = Math.abs(ratio - 1);
  return {
    level: round.level,
    shapeId: round.shapeId,
    modifiers: round.modifiers,
    holding: round.state === 'holding',
    size: round.size,
    targetScale: round.targetScale,
    ratio,
    wobbleX: round.wobbleX,
    wobbleY: round.wobbleY,
    driftX: round.driftX,
    driftY: round.driftY,
    angle: round.angle,
    ghostAlpha: round.ghostAlpha,
    blobSeed: round.blobSeed,
    bands: { perfect: bands.perfect, good: bands.good, pop: popThreshold(round.level) },
    inBand: err <= bands.perfect ? 'perfect' : err <= bands.good ? 'good' : null,
    holdTime: round.holdTime,
  };
}
