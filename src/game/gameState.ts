/**
 * 纯运行时状态（不含关卡配置）。
 *
 * 时间池从 0 开始，每个目标数字开始时由 GameScene 调用 addTime(30_000) 注入。
 * 不再持有固定的 initialTimeMs，重置时清零即可。
 */
export class GameState {
  public timeRemainingMs = 0;
  public isGameEnd = false;
  public isPause = false;

  /** 重置状态（关卡重试 / 开始新关卡时调用） */
  public reset(): void {
    this.timeRemainingMs = 0;
    this.isGameEnd = false;
    this.isPause = false;
  }

  /** 每帧推进计时（暂停或已结束时跳过） */
  public tick(deltaMs: number): void {
    if (!this.isPause && !this.isGameEnd) {
      this.timeRemainingMs -= deltaMs;
    }
  }

  /** 向时间池添加时间（目标开始 +30s、消除成功 +1s） */
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
