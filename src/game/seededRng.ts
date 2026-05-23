/**
 * seededRng.ts
 *
 * Mulberry32 — a fast, seedable 32-bit PRNG.
 * Returns a function that produces floats in [0, 1), identical to Math.random().
 *
 * Usage:
 *   const rng = makeRng(12345);
 *   const x = rng();  // 0 <= x < 1
 */
export type RngFn = () => number;

export function makeRng(seed: number): RngFn {
  let s = seed >>> 0; // ensure unsigned 32-bit
  return function (): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convert a date string like "2026-05-23" into a stable 32-bit seed.
 * Uses DJB2 hash for simplicity and good distribution.
 */
export function dateStringToSeed(dateStr: string): number {
  let hash = 5381;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (((hash << 5) + hash) ^ dateStr.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Return today's date as "YYYY-MM-DD". */
export function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
