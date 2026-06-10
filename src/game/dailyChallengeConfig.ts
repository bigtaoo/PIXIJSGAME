/**
 * dailyChallengeConfig.ts
 *
 * Static configuration and date-derived values for Daily Challenge mode.
 *
 * Target formula: (dayOfYear % 31) + 20  →  range [20, 50]
 * Board:          6 cols × 10 rows = 60 cells
 * Duration:       90 seconds
 */
import { dateStringToSeed, todayString } from './seededRng';

export const DAILY_GRID_W     = 6;
export const DAILY_GRID_H     = 10;
export const DAILY_DURATION_MS = 90_000;

/** Compute today's target number (20–50, repeats every 31 days). */
export function getDailyTarget(): number {
  const now   = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start) / 86_400_000);
  return (dayOfYear % 31) + 20;
}

/** Return a stable 32-bit seed derived from today's date string. */
export function getDailySeed(): number {
  return dateStringToSeed(todayString());
}
