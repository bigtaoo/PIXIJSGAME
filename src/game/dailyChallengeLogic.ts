/**
 * dailyChallengeLogic.ts
 *
 * Extends Logic with two Daily Challenge–specific capabilities:
 *
 *   1. Seeded initialisation — the entire starting board is generated from a
 *      deterministic RNG so every player sees the same initial layout.
 *
 *   2. Row-collapse mechanic — after each elimination the caller should invoke
 *      checkAndCollapse().  If any full row (all 6 cells == 0) is found, the
 *      rows above it fall down by one position and a fresh self-paired row is
 *      inserted at the top.
 *
 * The class inherits getNumber / getNumberByIndex / removeNumber /
 * isAllRemoved from Logic so it works transparently with Grid and NumberLayer.
 */
import { Logic } from './logic';
import { ScreenConfig } from './screenConfig';
import { RngFn } from './seededRng';
import { DAILY_GRID_W, DAILY_GRID_H } from './dailyChallengeConfig';

export class DailyChallengeLogic extends Logic {
  private target = 20;
  /** Actual grid dims for the current orientation (set by initializeSeeded). */
  private gridW = DAILY_GRID_W;
  private gridH = DAILY_GRID_H;

  // ── Seeded initialisation ──────────────────────────────────────────────────

  /**
   * Fill the board using the provided seeded RNG so the layout is identical
   * for all players on the same day.  Pass the actual gridCountW/H so that
   * portrait (6×10) and landscape (10×6) both produce correctly-keyed cells.
   */
  public initializeSeeded(target: number, rng: RngFn, w = DAILY_GRID_W, h = DAILY_GRID_H): void {
    this.target = target;
    this.gridW = w;
    this.gridH = h;
    this.numbers.clear();

    const pairs: number[] = [];
    const count = (w * h) / 2;

    for (let i = 0; i < count; i++) {
      // first ∈ [1, target-1], second = target - first
      const first = 1 + Math.floor(rng() * (target - 1));
      const second = target - first;
      pairs.push(first, second);
    }

    // Shuffle with the same seeded RNG for full reproducibility
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = pairs[i];
      pairs[i] = pairs[j];
      pairs[j] = tmp;
    }

    let k = 0;
    for (let col = 0; col < w; col++) {
      for (let row = 0; row < h; row++) {
        this.numbers.set(DailyChallengeLogic.idx(col, row), pairs[k++]);
      }
    }
  }

  // ── Row-collapse mechanic ──────────────────────────────────────────────────

  /**
   * Scan for any fully-empty row (all 6 cells == 0).
   * When found, shift everything above it one row down and insert a fresh
   * self-paired row at the top (row 0).
   *
   * Returns the index of the collapsed row (≥ 0) so callers can animate the
   * falling cells (rows 0..emptyRow all shifted down by one gridSize).
   * Returns -1 if no collapse occurred.
   * Only collapses one row per call — invoke in a loop if needed.
   */
  public checkAndCollapse(): number {
    const w = this.gridW;
    const h = this.gridH;

    // Search from the bottom up; collapse the lowest empty row first.
    let emptyRow = -1;
    for (let row = h - 1; row >= 0; row--) {
      if (this.isRowEmpty(row)) {
        emptyRow = row;
        break;
      }
    }
    if (emptyRow === -1) return -1;

    // Shift rows above emptyRow downward by one position.
    for (let row = emptyRow; row > 0; row--) {
      for (let col = 0; col < w; col++) {
        const val = this.numbers.get(DailyChallengeLogic.idx(col, row - 1)) ?? 0;
        this.numbers.set(DailyChallengeLogic.idx(col, row), val);
      }
    }

    // Insert a new self-paired row at the top.
    this.fillRow(0);
    return emptyRow;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** True when every cell in the given row is 0 (eliminated). */
  private isRowEmpty(row: number): boolean {
    for (let col = 0; col < this.gridW; col++) {
      if ((this.numbers.get(DailyChallengeLogic.idx(col, row)) ?? 0) !== 0) return false;
    }
    return true;
  }

  /**
   * Fill the given row with 3 randomly-ordered pairs that sum to target.
   * Uses plain Math.random() — these "earned" rows don't need to be seeded
   * because they are the result of player skill, not the starting state.
   */
  private fillRow(row: number): void {
    const w = this.gridW;
    const pairs: number[] = [];

    for (let i = 0; i < w / 2; i++) {
      const first = 1 + Math.floor(Math.random() * (this.target - 1));
      const second = this.target - first;
      pairs.push(first, second);
    }

    this.shuffle(pairs); // inherited from Logic

    for (let col = 0; col < w; col++) {
      this.numbers.set(DailyChallengeLogic.idx(col, row), pairs[col]);
    }
  }

  /** Mirror of ScreenConfig.cellIndex so we don't need a ScreenConfig instance. */
  private static idx(col: number, row: number): number {
    return col * 1000 + row;
  }

  // ── Override initialize to keep target in sync ─────────────────────────────

  public initialize(screen: ScreenConfig, target: number): void {
    this.target = target;
    super.initialize(screen, target);
  }
}
