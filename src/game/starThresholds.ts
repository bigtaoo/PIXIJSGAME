/**
 * starThresholds.ts
 *
 * Per-stage star thresholds (time remaining in seconds at stage completion).
 *
 * Star rules:
 *   ★     time > star1Secs   (greater than 0 by default — simply completed)
 *   ★★    time > star2Secs   (default: more than 30 s remaining)
 *   ★★★   time > star3Secs   (default: more than 60 s remaining)
 *
 * If a stage index is not listed, DEFAULT_THRESHOLDS applies.
 * To tune a specific stage, add an entry to STAGE_THRESHOLDS below.
 */

export interface StarThresholds {
  /** Minimum seconds remaining for 1 star (cleared at all). */
  star1Secs: number;
  /** Minimum seconds remaining for 2 stars. */
  star2Secs: number;
  /** Minimum seconds remaining for 3 stars. */
  star3Secs: number;
}

/** Fallback thresholds used for any stage not listed in STAGE_THRESHOLDS. */
export const DEFAULT_THRESHOLDS: StarThresholds = {
  star1Secs: 0,
  star2Secs: 30,
  star3Secs: 60,
};

/**
 * Per-stage overrides (1-based stage index).
 * Leave empty — all stages use DEFAULT_THRESHOLDS until manually tuned.
 *
 * Example:
 *   1: { star1Secs: 0, star2Secs: 20, star3Secs: 45 },
 */
export const STAGE_THRESHOLDS: Partial<Record<number, StarThresholds>> = {
  // Stage-specific overrides go here.
};

/** Return the thresholds for a given stage index. */
export function getStarThresholds(stageIndex: number): StarThresholds {
  return STAGE_THRESHOLDS[stageIndex] ?? DEFAULT_THRESHOLDS;
}
