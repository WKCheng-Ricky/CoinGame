// Test helpers for the pile placement, settle and move tests.

// mulberry32: small seeded PRNG returning values in [0, 1).
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Yields `values` in order, then `rest` forever.
export function seq(values, rest = 0.5) {
  let i = 0;
  return () => (i < values.length ? values[i++] : rest);
}

// Builds a pile of entries from coin ids, all at the centre with rot 0.
export function pileOf(...coinIds) {
  return coinIds.map((coinId, i) => ({ uid: i + 1, coinId, x: 0, y: 0, rot: 0 }));
}
