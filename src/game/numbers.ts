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

interface HintAnimation {
  indices: number[];
  elapsed: number;
}

/** Total duration of one hint pulse (fade-out + fade-in), in ms. */
const HINT_DURATION_MS = 600;
/** Lowest alpha reached at the mid-point of the pulse. */
const HINT_MIN_ALPHA = 0.25;

export class NumberLayer extends PIXI.Container {
  /**
   * High-watermark sprite pool, mirroring Grid's cell pool.
   * Cells outside the current stage grid are hidden but never destroyed.
   */
  private cells: Map<number, CellSlots> = new Map();

  /** Active hint pulse animations (at most one at a time in practice). */
  private hintAnimations: HintAnimation[] = [];

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig
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
    // Cancel any in-flight hint animations and reset all sprite alphas so
    // sprites reused from a previous target never carry over a reduced alpha.
    this.hintAnimations = [];
    for (const [, cell] of this.cells) {
      cell.slots.forEach((s) => (s.alpha = 1));
    }

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

  /**
   * Trigger a single gentle alpha pulse on the given cells.
   * Intentionally subtle so the player still feels they "found" the answer.
   * Safe to call multiple times — each call queues an independent animation.
   */
  public flashHint(indices: number[]): void {
    this.hintAnimations.push({ indices, elapsed: 0 });
  }

  /**
   * Advance all running hint animations.  Call once per frame from GameScene.
   */
  public update(deltaMs: number): void {
    if (this.hintAnimations.length === 0) return;

    const half = HINT_DURATION_MS / 2;

    for (let i = this.hintAnimations.length - 1; i >= 0; i--) {
      const anim = this.hintAnimations[i]!;
      anim.elapsed += deltaMs;

      // Compute alpha: ease out to min, then ease back to 1
      let alpha: number;
      if (anim.elapsed < half) {
        // fade out: 1 → HINT_MIN_ALPHA
        const t = anim.elapsed / half;
        alpha = 1 - (1 - HINT_MIN_ALPHA) * t;
      } else if (anim.elapsed < HINT_DURATION_MS) {
        // fade in: HINT_MIN_ALPHA → 1
        const t = (anim.elapsed - half) / half;
        alpha = HINT_MIN_ALPHA + (1 - HINT_MIN_ALPHA) * t;
      } else {
        alpha = 1;
      }

      for (const idx of anim.indices) {
        const cell = this.cells.get(idx);
        if (cell)
          cell.slots.forEach((s) => {
            if (s.visible) s.alpha = alpha;
          });
      }

      if (anim.elapsed >= HINT_DURATION_MS) {
        this.hintAnimations.splice(i, 1);
      }
    }
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
    const cellX = col * gridSize + offsetX + gridSize * 0.05;
    const cellY = row * gridSize + offsetY + gridSize * 0.05;

    const str = n.toString(); // e.g. 15 -> "15", 7 -> "7"
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
    digit: string
  ): void {
    const cell = this.getOrCreateCell(idx, false);
    const s = cell.slots[0];

    s.texture = this.ctx.assets.GetTexture(`${digit}.png`);
    s.width = gs * 0.8;
    s.height = gs * 1.0;
    s.x = cellX + 5;
    s.y = cellY - 8;
    s.alpha = 1;
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
    unitsChar: string
  ): void {
    const cell = this.getOrCreateCell(idx, true);

    // Scale the pair to 80% of the cell; each digit gets half the total width
    const scale = 1.0;
    const totalW = gs * scale;
    const dw = totalW / 2; // width per digit
    const dh = gs * scale; // height per digit
    const marginX = (gs - totalW) / 2; // horizontal centering offset
    const marginY = (gs - dh) / 2 - 8; // vertical centering offset

    const digits = [tensChar, unitsChar];

    const s0 = cell.slots[0]!;
    s0.texture = this.ctx.assets.GetTexture(`${digits[0]}.png`);
    s0.width = dw;
    s0.height = dh;
    s0.x = cellX + marginX + 0 * dw;
    s0.y = cellY + marginY;
    s0.alpha = 1;
    s0.visible = true;

    const s1 = cell.slots[1]!;
    s1.texture = this.ctx.assets.GetTexture(`${digits[1]}.png`);
    s1.width = dw;
    s1.height = dh;
    s1.x = cellX + marginX + 1 * dw - 15;
    s1.y = cellY + marginY;
    s1.alpha = 1;
    s1.visible = true;
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
