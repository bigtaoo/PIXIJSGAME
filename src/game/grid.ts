import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { UIElement } from '../inputSystem/uiElement';

export class Grid extends PIXI.Container {
  private cells: Map<number, PIXI.Sprite> = new Map();
  private selectionHighlight: PIXI.Sprite | undefined;

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig,
    private readonly onCellClick: (index: number) => void,
  ) {
    super();
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
          sprite = new PIXI.Sprite(this.ctx.assets.GetTexture('cell.png'));
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

        sprite.x      = col * gridSize + offsetX;
        sprite.y      = row * gridSize + offsetY;
        sprite.width  = gridSize;
        sprite.height = gridSize;
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
    const { gridSize, offsetX, offsetY } = this.screen;

    if (!this.selectionHighlight) {
      this.selectionHighlight = new PIXI.Sprite(this.ctx.assets.GetTexture('cell_selected.png'));
      this.selectionHighlight.width  = gridSize;
      this.selectionHighlight.height = gridSize;
      this.addChild(this.selectionHighlight);
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
