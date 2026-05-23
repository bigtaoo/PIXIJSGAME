import { PlayerPrefs } from '../playerPrefs/playerPrefs';
import { STAGES, StageData } from './stageConfig';

/**
 * Persistent stage progress management (backed by PlayerPrefs).
 *
 * A single integer — maxCompleted — tracks the highest fully cleared stage.
 *   0 = new player; no stage has been completed yet
 *   n = the first n stages have been completed
 *
 * Unlock rule: stageIndex <= maxCompleted + 1 (one stage ahead of current progress).
 * Lobby visibility: maxCompleted >= 1 (lobby appears after Stage 1 is cleared).
 */
export class StageManager {
  private static readonly KEY = 'maxCompleted';

  /** Highest stage index that has been fully cleared (0 = new player). */
  static getMaxCompleted(): number {
    return PlayerPrefs.getInt(this.KEY, 0);
  }

  /** Call after clearing a stage; automatically saves the new high-water mark. */
  static recordComplete(stageIndex: number): void {
    if (stageIndex > this.getMaxCompleted()) {
      PlayerPrefs.setInt(this.KEY, stageIndex);
    }
  }

  /** Whether the given stage is unlocked (can be entered). */
  static isUnlocked(stageIndex: number): boolean {
    return stageIndex <= this.getMaxCompleted() + 1;
  }

  /** Whether the given stage has been fully cleared. */
  static isCompleted(stageIndex: number): boolean {
    return stageIndex <= this.getMaxCompleted();
  }

  /**
   * Whether the player has cleared at least Stage 1.
   * New players bypass the lobby and go straight into Stage 1 on first launch.
   */
  static hasCompletedAnyStage(): boolean {
    return this.getMaxCompleted() >= 1;
  }

  /** The stage the player should enter by default (their furthest unfinished stage). */
  static getDefaultStage(): StageData {
    const idx = Math.min(this.getMaxCompleted() + 1, STAGES.length);
    return STAGES[idx - 1];
  }
}
