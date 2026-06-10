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
      // Full range: first ∈ [1, target-1], second = target - first.
      // Both values are valid (≥1) and may be single- or two-digit;
      // NumberLayer handles two-digit rendering via the 70%-scaled pair layout.
      const first = 1 + Math.floor(Math.random() * (target - 1));
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

  /**
   * Return the indices of all cells whose value equals (target − selectedValue).
   * Used by the hint system to identify which cells should flash.
   */
  public findPairIndices(selectedValue: number, target: number): number[] {
    const needed = target - selectedValue;
    const result: number[] = [];
    for (const [idx, val] of this.numbers) {
      if (val === needed) result.push(idx);
    }
    return result;
  }

  protected shuffle(arr: number[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }
}
