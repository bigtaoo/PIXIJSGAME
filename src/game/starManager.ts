/**
 * starManager.ts
 *
 * Persists and retrieves per-stage star ratings (1–3) via PlayerPrefs.
 *
 * Star criteria (applied at stage win time):
 *   ⭐     Completed (any conditions)
 *   ⭐⭐   Completed + no lives ever lost this stage attempt
 *   ⭐⭐⭐ Completed + no lives lost + time remaining ≥ STAR3_THRESHOLD_MS
 */
import { PlayerPrefs } from '../playerPrefs/playerPrefs';

export const STAR3_THRESHOLD_MS = 15_000; // 15 seconds

export class StarManager {
  private static key(stageIndex: number): string {
    return `stars_${stageIndex}`;
  }

  /** Return the best star count for a stage (0 = never completed). */
  static getStars(stageIndex: number): number {
    return PlayerPrefs.getInt(this.key(stageIndex), 0);
  }

  /**
   * Save a new star count if it is better than the stored value.
   * Returns true if the new record was set.
   */
  static saveStars(stageIndex: number, stars: number): boolean {
    if (stars > this.getStars(stageIndex)) {
      PlayerPrefs.setInt(this.key(stageIndex), stars);
      return true;
    }
    return false;
  }

  /**
   * Calculate the star rating given the end-of-stage conditions.
   *
   * @param livesLost    True if any life was lost during this stage attempt
   *                     (including after retryStageAfterGameOver resets lives).
   * @param timeRemainingMs  Time left in the pool when all targets were cleared.
   */
  static calculateStars(livesLost: boolean, timeRemainingMs: number): number {
    if (livesLost) return 1;
    if (timeRemainingMs >= STAR3_THRESHOLD_MS) return 3;
    return 2;
  }
}
