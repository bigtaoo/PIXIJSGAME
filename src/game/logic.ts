import { ScreenConfig } from './screenConfig';

export class Logic {
  protected numbers: Map<number, number> = new Map();

  /**
   * Populate the board with numbers.
   * Fix: clamp both numbers to the valid sprite range 1-9 so that
   * larger targets (e.g. target=20) never produce out-of-range values.
   */
  public initialize(screen: ScreenConfig, target: number): void {
    this.numbers.clear();
    const { gridCountW: w, gridCountH: h } = screen;
    const pairs: number[] = [];
    const count = (w * h) / 2;

    for (let i = 0; i < count; ++i) {
      // Ensure both first and second stay within the 1-9 sprite range
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

  protected shuffle(arr: number[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
