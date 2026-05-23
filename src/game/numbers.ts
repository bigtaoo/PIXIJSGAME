import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { Logic } from './logic';

/**
 * Each cell holds up to two Sprite slots (units digit / tens digit).
 * Sprites are created once and reused; surplus slots are hidden rather
 * than destroyed.
 */
interface CellSlots {
  /** slots[0] = units (used alone for single-digit), slots[1] = tens (two-digit only) */
  slots: [PIXI.Sprite] | [PIXI.Sprite, PIXI.Sprite];
}

export class NumberLayer extends PIXI.Container {
  /**
   * High-watermark sprite pool, mirroring Grid's cell pool.
   * Cells outside the current stage grid are hidden but never destroyed.
   */
  private cells: Map<number, CellSlots> = new Map();

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig,
  ) {
    super();
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Called at the start of every stage (including the first).
   *
   * Draws numbers for all active cells in the current grid and hides any
   * Sprites that belong to cells outside the current grid (from a previous
   * larger stage).
   */
  public reconfigure(logic: Logic): void {
    const { gridCountW: w, gridCountH: h } = this.screen;
    const activeIndices = new Set<number>();

    for (let col = 0; col < w; ++col) {
      for (let row = 0; row < h; ++row) {
        const idx = this.screen.cellIndex(col, row);
        activeIndices.add(idx);
        this.updateCell(idx, col, row, logic.getNumber(this.screen, col, row));
      }
    }

    // Hide Sprites for cells outside the current grid.
    for (const [idx, cell] of this.cells) {
      if (!activeIndices.has(idx)) {
        cell.slots.forEach((s) => (s.visible = false));
      }
    }
  }

  public hideNumber(index: number): void {
    const cell = this.cells.get(index);
    if (cell) cell.slots.forEach((s) => (s.visible = false));
  }

  // ── Internal ──────────────────────────────────────────────────────────

  /**
   * Choose single- or two-digit layout based on the value n, then
   * create or reuse Sprites accordingly.
   *
   * Single digit: one Sprite fills the full cell (gridSize x gridSize).
   * Two digits:   two Sprites side by side, scaled to 70% of the cell,
   *               centred both horizontally and vertically.
   */
  private updateCell(idx: number, col: number, row: number, n: number): void {
    const { gridSize, offsetX, offsetY } = this.screen;
    const cellX = col * gridSize + offsetX;
    const cellY = row * gridSize + offsetY;

    const str = n.toString();          // e.g. 15 -> "15", 7 -> "7"
    const isTwoDigit = str.length >= 2;

    if (isTwoDigit) {
      this.layoutTwoDigits(idx, cellX, cellY, gridSize, str[0], str[1]);
    } else {
      this.layoutOneDigit(idx, cellX, cellY, gridSize, str[0]);
    }
  }

  // ── Single-digit layout ───────────────────────────────────────────────

  private layoutOneDigit(
    idx: number,
    cellX: number,
    cellY: number,
    gs: number,
    digit: string,
  ): void {
    const cell = this.getOrCreateCell(idx, false);
    const s = cell.slots[0];

    s.texture = this.ctx.assets.GetTexture(`${digit}.png`);
    s.width   = gs;
    s.height  = gs;
    s.x       = cellX;
    s.y       = cellY;
    s.visible = true;

    // Hide the tens slot if it exists
    if (cell.slots.length > 1) cell.slots[1]!.visible = false;
  }

  // ── Two-digit layout ──────────────────────────────────────────────────

  private layoutTwoDigits(
    idx: number,
    cellX: number,
    cellY: number,
    gs: number,
    tensChar: string,
    unitsChar: string,
  ): void {
    const cell = this.getOrCreateCell(idx, true);

    // Scale the pair to 70% of the cell; each digit gets half the total width
    const scale  = 0.70;
    const totalW = gs * scale;
    const dw     = totalW / 2;              // width per digit
    const dh     = gs * scale;              // height per digit
    const marginX = (gs - totalW) / 2;      // horizontal centering offset
    const marginY = (gs - dh) / 2;          // vertical centering offset

    const digits = [tensChar, unitsChar];
    for (let i = 0; i < 2; i++) {
      const s = cell.slots[i as 0 | 1]!;
      s.texture = this.ctx.assets.GetTexture(`${digits[i]}.png`);
      s.width   = dw;
      s.height  = dh;
      s.x       = cellX + marginX + i * dw;
      s.y       = cellY + marginY;
      s.visible = true;
    }
  }

  // ── Sprite cache management ───────────────────────────────────────────

  /**
   * Return the existing CellSlots for idx, or create one.
   * When needSecond=true, ensure slots[1] also exists.
   */
  private getOrCreateCell(idx: number, needSecond: boolean): CellSlots {
    let cell = this.cells.get(idx);

    if (!cell) {
      // First time: create the units Sprite.
      cell = { slots: [this.makeSprite()] } as CellSlots;
      this.cells.set(idx, cell);
    }

    if (needSecond && cell.slots.length < 2) {
      // Lazily append a second Sprite (tens position).
      (cell.slots as PIXI.Sprite[]).push(this.makeSprite());
    }

    return cell;
  }

  private makeSprite(): PIXI.Sprite {
    const s = new PIXI.Sprite(this.ctx.assets.GetTexture('0.png'));
    this.addChild(s);
    return s;
  }
}
