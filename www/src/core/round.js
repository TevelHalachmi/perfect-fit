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
  bossPopThreshold,
  invertPopThreshold,
  driftRadius,
  rotateSpeed,
  pulseAmp,
  modifiersFor,
} from './difficulty.js';
import { createRng } from './rng.js';

const TAU = Math.PI * 2;

export function createRound({ level, shapeId, seed, upgrades = {}, boss = false }) {
  const rng = createRng(seed);
  const modifiers = modifiersFor(level, rng, boss ? T.boss.extraModifiers : 0);
  const invert = modifiers.includes('invert');

  // per-round randomized phases so no two rounds shake alike.
  // NOTE: v2 draws (gust, windAngle) come strictly AFTER every v1 draw so
  // old seeds keep their exact layouts — scripted tests depend on it.
  const phases = {
    wx1: rng() * TAU, wy1: rng() * TAU,
    wx2: rng() * TAU, wy2: rng() * TAU,
    dx: rng() * TAU, dy: rng() * TAU,
    pulse: rng() * TAU,
  };
  const blobSeed = rng.int(1, 1 << 30); // irregular shapes: target & player must match
  phases.gust = rng() * TAU;
  const windAngle = rng() * TAU;

  return {
    level,
    shapeId,
    seed,
    upgrades,
    boss,
    modifiers,
    state: 'idle', // 'idle' | 'holding'
    time: 0, // since round start (drives target pulse/drift)
    holdTime: 0, // since hold start (drives growth/wobble/ghost)
    startSize: invert ? T.invert.startSize : T.startSize,
    size: invert ? T.invert.startSize : T.startSize,
    targetScale: 1,
    wobbleX: 0,
    wobbleY: 0,
    windX: 0,
    windY: 0,
    driftX: 0,
    driftY: 0,
    angle: 0, // radians, shared by target and player
    ghostAlpha: 1,
    phases,
    blobSeed,
    windAngle,
  };
}

export function startHold(round) {
  round.state = 'holding';
  round.holdTime = 0;
}

export function resetHold(round) {
  round.state = 'idle';
  round.holdTime = 0;
  round.size = round.startSize;
  round.wobbleX = 0;
  round.wobbleY = 0;
  round.windX = 0;
  round.windY = 0;
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

  // Growth. Under INVERT it runs backwards (start big, shrink to fit);
  // OSCILLATE's surge factor stays positive, so it never flips direction.
  let g = growthRate(level, upgrades.zen ?? 0);
  if (modifiers.includes('invert')) g = -g * T.invert.growthMult;
  if (modifiers.includes('oscillate')) {
    g *= 1 + T.oscillate.depth * Math.sin(TAU * T.oscillate.freq * round.holdTime);
  }
  round.size += g * dt;

  // Wind: a seeded lateral push that builds while you hold, plus gusts.
  // Pure perception attack — judgment never reads position.
  if (modifiers.includes('wind')) {
    const mag =
      T.wind.pushPerSec * Math.min(round.holdTime, T.wind.pushCapSeconds) +
      T.wind.gustAmp * Math.sin(TAU * T.wind.gustFreq * round.holdTime + round.phases.gust);
    round.windX = Math.cos(round.windAngle) * mag;
    round.windY = Math.sin(round.windAngle) * mag;
  }

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

  // Pop check. Inverted rounds start above the normal threshold, so the
  // high-side check is replaced by a mirrored deflation limit.
  const ratio = currentRatio(round);
  if (round.modifiers.includes('invert')) {
    if (ratio < invertPopThreshold(level, round.boss)) return 'pop';
  } else if (ratio > (round.boss ? bossPopThreshold(level) : popThreshold(level))) {
    return 'pop';
  }
  return null;
}

export const currentRatio = (round) => round.size / round.targetScale;

// Everything the renderer and HUD need to draw a frame.
export function roundView(round) {
  const bands = toleranceBands(round.level, round.upgrades.forgive ?? 0);
  const ratio = currentRatio(round);
  const err = Math.abs(ratio - 1);
  const invert = round.modifiers.includes('invert');
  return {
    level: round.level,
    shapeId: round.shapeId,
    modifiers: round.modifiers,
    boss: round.boss,
    holding: round.state === 'holding',
    size: round.size,
    startSize: round.startSize,
    targetScale: round.targetScale,
    ratio,
    // wind folds into the wobble offsets so every consumer (renderer,
    // burst positions, hum) follows the pushed shape for free
    wobbleX: round.wobbleX + round.windX,
    wobbleY: round.wobbleY + round.windY,
    wind: { x: round.windX, y: round.windY },
    driftX: round.driftX,
    driftY: round.driftY,
    angle: round.angle,
    ghostAlpha: round.ghostAlpha,
    blobSeed: round.blobSeed,
    bands: {
      perfect: bands.perfect,
      good: bands.good,
      pop: round.boss ? bossPopThreshold(round.level) : popThreshold(round.level),
      invertPop: invert ? invertPopThreshold(round.level, round.boss) : null,
    },
    inBand: err <= bands.perfect ? 'perfect' : err <= bands.good ? 'good' : null,
    holdTime: round.holdTime,
  };
}
