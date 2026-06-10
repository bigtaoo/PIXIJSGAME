import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeRng, dateStringToSeed, todayString } from './seededRng';

describe('makeRng', () => {
  it('returns a number in [0, 1)', () => {
    const rng = makeRng(12345);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('produces a deterministic sequence for the same seed', () => {
    const a = makeRng(99);
    const b = makeRng(99);
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    const results = Array.from({ length: 10 }, () => [a(), b()] as const);
    const allSame = results.every(([x, y]) => x === y);
    expect(allSame).toBe(false);
  });
});

describe('dateStringToSeed', () => {
  it('returns a 32-bit unsigned integer', () => {
    const seed = dateStringToSeed('2024-06-15');
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(seed)).toBe(true);
  });

  it('returns the same seed for the same date string', () => {
    expect(dateStringToSeed('2024-01-01')).toBe(dateStringToSeed('2024-01-01'));
  });

  it('returns different seeds for different date strings', () => {
    expect(dateStringToSeed('2024-01-01')).not.toBe(dateStringToSeed('2024-01-02'));
  });
});

describe('todayString', () => {
  beforeEach(() => {
    // Fix "now" to 2024-03-15 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a string in YYYY-MM-DD format', () => {
    expect(todayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns the UTC date, not the local date', () => {
    // The fixed time is 2024-03-15 UTC — should return this regardless of local TZ
    expect(todayString()).toBe('2024-03-15');
  });

  it('zero-pads month and day', () => {
    vi.setSystemTime(new Date('2024-01-05T00:30:00Z'));
    expect(todayString()).toBe('2024-01-05');
  });
});
