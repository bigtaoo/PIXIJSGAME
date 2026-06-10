import { describe, it, expect, beforeEach } from 'vitest';
import { Logic } from './logic';

// Minimal ScreenConfig stub — only the fields Logic uses
function makeScreen(w: number, h: number) {
  return {
    gridCountW: w,
    gridCountH: h,
    cellIndex: (col: number, row: number) => col * h + row,
  } as unknown as import('./screenConfig').ScreenConfig;
}

describe('Logic', () => {
  let logic: Logic;

  beforeEach(() => {
    logic = new Logic();
  });

  describe('initialize', () => {
    it('fills every cell with a non-zero value', () => {
      const screen = makeScreen(4, 4);
      logic.initialize(screen, 10);
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
          expect(logic.getNumber(screen, col, row)).toBeGreaterThan(0);
        }
      }
    });

    it('each cell pair on the board sums to target (verified via all values)', () => {
      const screen = makeScreen(4, 4);
      const target = 15;
      logic.initialize(screen, target);

      // Collect all values
      const values: number[] = [];
      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
          values.push(logic.getNumber(screen, col, row));
        }
      }

      // Sort and pair: smallest + largest should equal target
      values.sort((a, b) => a - b);
      for (let i = 0; i < values.length / 2; i++) {
        expect(values[i] + values[values.length - 1 - i]).toBe(target);
      }
    });

    it('clears previous state on re-initialize', () => {
      const screen = makeScreen(2, 2);
      logic.initialize(screen, 5);
      logic.removeNumber(screen.cellIndex(0, 0));
      logic.initialize(screen, 8);
      expect(logic.getNumber(screen, 0, 0)).toBeGreaterThan(0);
    });
  });

  describe('removeNumber', () => {
    it('sets a cell to 0', () => {
      const screen = makeScreen(2, 2);
      logic.initialize(screen, 6);
      const idx = screen.cellIndex(0, 0);
      logic.removeNumber(idx);
      expect(logic.getNumberByIndex(idx)).toBe(0);
    });
  });

  describe('isAllRemoved', () => {
    it('returns false when cells are populated', () => {
      const screen = makeScreen(2, 2);
      logic.initialize(screen, 6);
      expect(logic.isAllRemoved()).toBe(false);
    });

    it('returns true when all cells are removed', () => {
      const screen = makeScreen(2, 2);
      logic.initialize(screen, 6);
      for (let col = 0; col < 2; col++) {
        for (let row = 0; row < 2; row++) {
          logic.removeNumber(screen.cellIndex(col, row));
        }
      }
      expect(logic.isAllRemoved()).toBe(true);
    });
  });

  describe('findPairIndices', () => {
    it('returns indices of all cells whose value = target - selected', () => {
      const _screen = makeScreen(2, 2);
      // Use a custom setup: manually inject known values
      const logicAny = logic as unknown as { numbers: Map<number, number> };
      logicAny.numbers.set(0, 3);
      logicAny.numbers.set(1, 7);
      logicAny.numbers.set(2, 3);
      logicAny.numbers.set(3, 5);

      // Selected=7, target=10 → looking for 3 → indices 0 and 2
      const result = logic.findPairIndices(7, 10);
      expect(result.sort()).toEqual([0, 2]);
    });

    it('returns empty array when no pair exists', () => {
      const logicAny = logic as unknown as { numbers: Map<number, number> };
      logicAny.numbers.set(0, 4);
      logicAny.numbers.set(1, 4);

      expect(logic.findPairIndices(9, 10)).toEqual([]);
    });

    it('ignores removed (0) cells', () => {
      const logicAny = logic as unknown as { numbers: Map<number, number> };
      logicAny.numbers.set(0, 0); // removed
      logicAny.numbers.set(1, 3);

      // selected=7, target=10 → need 3. Cell 0 is 0 (removed), cell 1 is 3.
      const result = logic.findPairIndices(7, 10);
      expect(result).toEqual([1]);
    });
  });
});
