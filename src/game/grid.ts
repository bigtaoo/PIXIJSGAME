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
    onCellClick: (index: number) => void,
  ) {
    super();
    this.buildCells(onCellClick);
  }

  private buildCells(onCellClick: (index: number) => void): void {
    const { gridCountW: w, gridCountH: h, gridSize, offsetX, offsetY } = this.screen;

    for (let col = 0; col < w; ++col) {
      for (let row = 0; row < h; ++row) {
        const idx = this.screen.cellIndex(col, row);
        const sprite = this.ctx.assets.GetSpriteFromNumberAtlas('Blue.png');
        sprite.x = col * gridSize + offsetX;
        sprite.y = row * gridSize + offsetY;
        sprite.width = gridSize;
        sprite.height = gridSize;
        this.addChild(sprite);
        this.cells.set(idx, sprite);

        this.ctx.input.registerUI(
          new UIElement({
            zIndex: 10,
            sprite,
            onTap: () => onCellClick(idx),
          }),
        );
      }
    }
  }

  public showSelection(index: number): void {
    if (!this.selectionHighlight) {
      this.selectionHighlight = this.ctx.assets.GetSpriteFromNumberAtlas('select.png');
      this.selectionHighlight.width = this.screen.gridSize;
      this.selectionHighlight.height = this.screen.gridSize;
      this.addChild(this.selectionHighlight);
    }
    const { x, y } = this.screen.indexToPos(index);
    this.selectionHighlight.x = x;
    this.selectionHighlight.y = y;
    this.selectionHighlight.visible = true;
  }

  public hideSelection(): void {
    if (this.selectionHighlight) this.selectionHighlight.visible = false;
  }

  public hideCell(index: number): void {
    const cell = this.cells.get(index);
    if (cell) cell.visible = false;
  }

  /** 新游戏时恢复所有格子并清除选中状态 */
  public reset(): void {
    for (const cell of this.cells.values()) cell.visible = true;
    this.hideSelection();
  }
}
