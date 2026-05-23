/**
 * Pure runtime state (no stage configuration).
 *
 * The time pool starts at 0. GameScene calls addTime(30_000) at the
 * beginning of each target. There is no fixed initialTimeMs; reset()
 * simply zeroes the pool.
 */
export class GameState {
  public timeRemainingMs = 0;
  public isGameEnd = false;
  public isPause = false;

  /** Reset state (called on stage retry or when starting a new stage). */
  public reset(): void {
    this.timeRemainingMs = 0;
    this.isGameEnd = false;
    this.isPause = false;
  }

  /** Advance the timer by one frame (skipped when paused or game is over). */
  public tick(deltaMs: number): void {
    if (!this.isPause && !this.isGameEnd) {
      this.timeRemainingMs -= deltaMs;
    }
  }

  /** Add time to the pool (target start +30 s, successful elimination +bonus s). */
  public addTime(ms: number): void {
    this.timeRemainingMs += ms;
  }

  public get remainingSeconds(): number {
    return Math.max(0, Math.ceil(this.timeRemainingMs / 1000));
  }

  public get isTimeUp(): boolean {
    return this.timeRemainingMs <= 0;
  }
}
