export class GameState {
  public readonly target: number;
  public readonly initialTimeMs: number;

  public timeRemainingMs: number;
  public isGameEnd = false;
  public isPause = false;

  constructor(target = 10, initialTimeMs = 30_000) {
    this.target = target;
    this.initialTimeMs = initialTimeMs;
    this.timeRemainingMs = initialTimeMs;
  }

  public reset(): void {
    this.timeRemainingMs = this.initialTimeMs;
    this.isGameEnd = false;
    this.isPause = false;
  }

  /** 每帧推进计时（暂停/结束时跳过） */
  public tick(deltaMs: number): void {
    if (!this.isPause && !this.isGameEnd) {
      this.timeRemainingMs -= deltaMs;
    }
  }

  /** 消除成功后奖励时间 */
  public addTimeBonus(ms: number): void {
    this.timeRemainingMs += ms;
  }

  public get remainingSeconds(): number {
    return Math.max(0, Math.ceil(this.timeRemainingMs / 1000));
  }

  public get isTimeUp(): boolean {
    return this.timeRemainingMs <= 0;
  }
}
