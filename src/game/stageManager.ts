import { PlayerPrefs } from '../playerPrefs/playerPrefs';
import { STAGES, StageData } from './stageConfig';

/**
 * 关卡进度的持久化管理（依赖 PlayerPrefs）。
 *
 * 仅维护一个整数：maxCompleted（已完整通关的最高关卡号）。
 *   0 = 新玩家，从未通关任何关卡
 *   n = 已通关前 n 关
 *
 * 解锁规则：stageIndex <= maxCompleted + 1（比当前进度多开放一关）。
 * 大厅显示条件：maxCompleted >= 1（第一关通关后才出现大厅）。
 */
export class StageManager {
  private static readonly KEY = 'maxCompleted';

  /** 已完整通关的最高关卡号（0 = 新玩家） */
  static getMaxCompleted(): number {
    return PlayerPrefs.getInt(this.KEY, 0);
  }

  /** 通关某关后调用，自动保存最高进度 */
  static recordComplete(stageIndex: number): void {
    if (stageIndex > this.getMaxCompleted()) {
      PlayerPrefs.setInt(this.KEY, stageIndex);
    }
  }

  /** 该关卡是否已解锁（可进入） */
  static isUnlocked(stageIndex: number): boolean {
    return stageIndex <= this.getMaxCompleted() + 1;
  }

  /** 该关卡是否已完整通关 */
  static isCompleted(stageIndex: number): boolean {
    return stageIndex <= this.getMaxCompleted();
  }

  /**
   * 是否已通过第 1 关（决定下次启动时是否进入大厅）。
   * 新玩家首次打开游戏直接进入第 1 关，跳过大厅。
   */
  static hasCompletedAnyStage(): boolean {
    return this.getMaxCompleted() >= 1;
  }

  /** 默认要进入的关卡（玩家最近未完成的那关） */
  static getDefaultStage(): StageData {
    const idx = Math.min(this.getMaxCompleted() + 1, STAGES.length);
    return STAGES[idx - 1];
  }
}
