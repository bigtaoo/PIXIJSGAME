import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { UIElement } from '../inputSystem/uiElement';

const GLOSS_PER_COLOR = 6; // must match webAssetsManager constant

export class Grid extends PIXI.Container {
  private cells:         Map<number, PIXI.Sprite> = new Map();
  private cellGlossIdx:  Map<number, number>       = new Map(); // random 0–5, persistent
  private cellTier:      Map<number, 0|1|2>        = new Map(); // set by GameScene
  private selectionHighlight: PIXI.Sprite | undefined;

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig,
    private readonly onCellClick: (index: number) => void,
  ) {
    super();
  }

  // ── Texture key helpers ────────────────────────────────────────────────────

  private getGlossIdx(idx: number): number {
    if (!this.cellGlossIdx.has(idx)) {
      this.cellGlossIdx.set(idx, Math.floor(Math.random() * GLOSS_PER_COLOR));
    }
    return this.cellGlossIdx.get(idx)!;
  }

  private textureKey(idx: number): string {
    const tier  = this.cellTier.get(idx) ?? 0;
    const gloss = this.getGlossIdx(idx);
    return `cell_t${tier}_g${gloss}.png`;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Assign a tier colour (0 = small / 1 = mid / 2 = large) to a cell.
   * Called by GameScene after numbers are placed so colours reflect values.
   */
  public setCellTier(idx: number, tier: 0|1|2): void {
    this.cellTier.set(idx, tier);
    const sprite = this.cells.get(idx);
    if (sprite) {
      sprite.texture = this.ctx.assets.GetTexture(this.textureKey(idx));
    }
  }

  /** Compute the tier index for a number value given the current target. */
  public static tierForValue(value: number, target: number): 0|1|2 {
    const maxVal = target - 1;
    if (value <= maxVal / 3)       return 0;
    if (value <= (maxVal * 2) / 3) return 1;
    return 2;
  }

  public reconfigure(): void {
    const { gridCountW: w, gridCountH: h, gridSize, offsetX, offsetY } = this.screen;
    const activeIndices = new Set<number>();

    for (let col = 0; col < w; ++col) {
      for (let row = 0; row < h; ++row) {
        const idx = this.screen.cellIndex(col, row);
        activeIndices.add(idx);

        let sprite = this.cells.get(idx);

        if (!sprite) {
          sprite = new PIXI.Sprite(this.ctx.assets.GetTexture(this.textureKey(idx)));
          this.addChild(sprite);
          this.cells.set(idx, sprite);

          const capturedIdx = idx;
          this.ctx.input.registerUI(
            new UIElement({
              zIndex: 10,
              sprite,
              onTap: () => this.onCellClick(capturedIdx),
            }),
          );
        }

        const GAP = 5;
        sprite.x       = col * gridSize + offsetX;
        sprite.y       = row * gridSize + offsetY;
        sprite.width   = gridSize - GAP;
        sprite.height  = gridSize - GAP;
        sprite.visible = true;
      }
    }

    for (const [idx, sprite] of this.cells) {
      if (!activeIndices.has(idx)) sprite.visible = false;
    }

    if (this.selectionHighlight) {
      this.selectionHighlight.width  = gridSize;
      this.selectionHighlight.height = gridSize;
    }

    this.hideSelection();
  }

  public showSelection(index: number): void {
    const { gridSize } = this.screen;

    if (!this.selectionHighlight) {
      this.selectionHighlight = new PIXI.Sprite(this.ctx.assets.GetTexture('cell_selected.png'));
      this.selectionHighlight.width  = gridSize;
      this.selectionHighlight.height = gridSize;
      this.addChild(this.selectionHighlight);
    } else {
      this.setChildIndex(this.selectionHighlight, this.children.length - 1);
    }

    const { x, y } = this.screen.indexToPos(index);
    this.selectionHighlight.x       = x;
    this.selectionHighlight.y       = y;
    this.selectionHighlight.visible = true;
  }

  public hideSelection(): void {
    if (this.selectionHighlight) this.selectionHighlight.visible = false;
  }

  public hideCell(index: number): void {
    const cell = this.cells.get(index);
    if (cell) cell.visible = false;
  }
}
