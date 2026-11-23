// Seeded random numbers for Neon Bay.
// Every run of the game that names a seed (the ?seed= URL flag, the
// deterministic screenshots) uses one of these generators, so the same seed
// always builds the same city, traffic and pedestrians. Normal play seeds
// from the clock. mulberry32 is small, fast and good enough for a game.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick an integer in [min, max] from a generator.
export function intBetween(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Pick one item from a list.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// A value that drifts smoothly (used for the sea shimmer and the neon signs).
export function wobble(time, speed, size) {
  return Math.sin(time * speed) * size;
}
