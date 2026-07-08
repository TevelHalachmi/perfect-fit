// Deterministic PRNG (mulberry32). Seeded per game so rounds are
// reproducible in tests, yet feel random in play.

export function createRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  next.range = (min, max) => min + next() * (max - min);
  next.int = (min, max) => Math.floor(next.range(min, max + 1)); // inclusive
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.fork = () => createRng(Math.floor(next() * 4294967296));
  return next;
}
