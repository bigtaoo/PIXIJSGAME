import { ScreenConfig } from './screenConfig';

export class Logic {
  private numbers: Map<number, number> = new Map();

  /**
   * 初始化棋盘数字。
   * 修复：确保生成的两个数字都在 1-9 范围内（原代码仅靠 target=10 保证，换 target 会出负数）
   */
  public initialize(screen: ScreenConfig, target: number): void {
    this.numbers.clear();
    const { gridCountW: w, gridCountH: h } = screen;
    const pairs: number[] = [];
    const count = (w * h) / 2;

    for (let i = 0; i < count; ++i) {
      // 保证 first 和 second 均落在 1-9 的有效图片范围内
      const maxFirst = Math.min(9, target - 1);
      const minFirst = Math.max(1, target - 9);
      const first = minFirst + Math.floor(Math.random() * (maxFirst - minFirst + 1));
      const second = target - first;
      pairs.push(first, second);
    }

    this.shuffle(pairs);

    for (let col = 0; col < w; ++col) {
      for (let row = 0; row < h; ++row) {
        this.numbers.set(screen.cellIndex(col, row), pairs.pop()!);
      }
    }
  }

  public getNumber(screen: ScreenConfig, col: number, row: number): number {
    return this.numbers.get(screen.cellIndex(col, row)) ?? 0;
  }

  public getNumberByIndex(index: number): number {
    return this.numbers.get(index) ?? 0;
  }

  public removeNumber(index: number): void {
    this.numbers.set(index, 0);
  }

  public isAllRemoved(): boolean {
    for (const v of this.numbers.values()) {
      if (v !== 0) return false;
    }
    return true;
  }

  private shuffle(arr: number[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
