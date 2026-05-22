import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { Logic } from './logic';

export class NumberLayer extends PIXI.Container {
  private sprites: Map<number, PIXI.Sprite> = new Map();

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig,
  ) {
    super();
  }

  public draw(logic: Logic): void {
    const { gridCountW: w, gridCountH: h, gridSize, offsetX, offsetY } = this.screen;

    for (let col = 0; col < w; ++col) {
      for (let row = 0; row < h; ++row) {
        const n = logic.getNumber(this.screen, col, row);
        const idx = this.screen.cellIndex(col, row);
        let sprite = this.sprites.get(idx);

        if (!sprite) {
          sprite = this.ctx.assets.GetSpriteFromNumberAtlas(`${n}.png`);
          sprite.x = col * gridSize + offsetX;
          sprite.y = row * gridSize + offsetY;
          sprite.width = gridSize;
          sprite.height = gridSize;
          this.addChild(sprite);
          this.sprites.set(idx, sprite);
        } else {
          sprite.texture = this.ctx.assets.GetTexture(`${n}.png`);
          sprite.visible = true;
        }
      }
    }
  }

  public hideNumber(index: number): void {
    const sprite = this.sprites.get(index);
    if (sprite) sprite.visible = false;
  }

  /** 新游戏时重新设置所有数字贴图并显示 */
  public reset(logic: Logic): void {
    this.draw(logic);
  }
}
