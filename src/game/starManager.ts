/**
 * starManager.ts
 *
 * Persists and retrieves per-stage star ratings (1-3) via PlayerPrefs.
 *
 * Star criteria (applied at stage win time, thresholds from starThresholds.ts):
 *   1 star:  completed (any time remaining)
 *   2 stars: timeRemaining > star2Secs (default: > 30 s)
 *   3 stars: timeRemaining > star3Secs (default: > 60 s)
 *
 * Note: losing a life during the attempt caps the rating at 1 star regardless
 * of time remaining, since livesEverLost is tracked across retries.
 */
import { PlayerPrefs } from '../playerPrefs/playerPrefs';
import { getStarThresholds } from './starThresholds';

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
   * Thresholds are per-stage and configurable in starThresholds.ts.
   *
   * @param stageIndex       1-based stage number (used to look up thresholds).
   * @param livesLost        True if any life was lost during this attempt.
   * @param timeRemainingMs  Time left in the pool when all targets were cleared.
   */
  static calculateStars(stageIndex: number, livesLost: boolean, timeRemainingMs: number): number {
    if (livesLost) return 1;

    const { star2Secs, star3Secs } = getStarThresholds(stageIndex);
    const secsRemaining = timeRemainingMs / 1000;

    if (secsRemaining > star3Secs) return 3;
    if (secsRemaining > star2Secs) return 2;
    return 1;
  }
}
