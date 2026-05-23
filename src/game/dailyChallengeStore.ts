/**
 * dailyChallengeStore.ts
 *
 * Persists Daily Challenge data via PlayerPrefs:
 *   - Today's best score   (resets when the date changes)
 *   - Consecutive-day streak
 *
 * All reads/writes go through PlayerPrefs so they work identically
 * on Web (localStorage) and WeChat (wx.storage).
 */
import { PlayerPrefs } from '../playerPrefs/playerPrefs';
import { todayString } from './seededRng';

const KEY_DATE   = 'dc_date';    // "YYYY-MM-DD" of last score submission
const KEY_BEST   = 'dc_best';    // best score for KEY_DATE
const KEY_STREAK = 'dc_streak';  // consecutive days played
const KEY_LAST   = 'dc_last';    // "YYYY-MM-DD" of last play (for streak logic)

// ─── Score ─────────────────────────────────────────────────────────────────────

/** Return today's best score, or 0 if not played today. */
export function getDailyBestScore(): number {
  if (PlayerPrefs.getString(KEY_DATE, '') !== todayString()) return 0;
  return PlayerPrefs.getInt(KEY_BEST, 0);
}

/**
 * Save score if it beats today's record.
 * Returns true when a new personal best was set.
 */
export function saveDailyScore(score: number): boolean {
  const today   = todayString();
  const isToday = PlayerPrefs.getString(KEY_DATE, '') === today;
  const current = isToday ? PlayerPrefs.getInt(KEY_BEST, 0) : 0;

  PlayerPrefs.setString(KEY_DATE, today);

  if (score > current) {
    PlayerPrefs.setInt(KEY_BEST, score);
    return true;
  }
  return false;
}

// ─── Streak ────────────────────────────────────────────────────────────────────

/**
 * Return the current streak (days of consecutive play).
 * The streak is considered alive only if the player played today or yesterday.
 */
export function getStreakDays(): number {
  const last = PlayerPrefs.getString(KEY_LAST, '');
  const today = todayString();
  if (last !== today && last !== yesterday()) return 0;
  return PlayerPrefs.getInt(KEY_STREAK, 0);
}

/**
 * Record that the player completed a Daily Challenge today.
 * Must be called once per session after the first game ends.
 */
export function recordDailyPlay(): void {
  const today = todayString();
  const last  = PlayerPrefs.getString(KEY_LAST, '');

  if (last === today) return; // already recorded today

  const streak = last === yesterday()
    ? PlayerPrefs.getInt(KEY_STREAK, 0) + 1
    : 1;

  PlayerPrefs.setInt(KEY_STREAK, streak);
  PlayerPrefs.setString(KEY_LAST, today);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
