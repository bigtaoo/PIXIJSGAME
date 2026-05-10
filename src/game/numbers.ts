import * as PIXI from 'pixi.js-legacy';
import { AssetsManager } from '../assetsManager/assetsManager';
import { OFFSET_Y } from './consts';
import { grid_count_h, grid_count_w, grid_size, index, offset_x } from './helper';
import { logic } from './logic';
import { GameResult } from './gameResult';

export class Numbers extends PIXI.Container {
  private numberSprites: Map<number, PIXI.Sprite> = new Map();

  private gameResult: GameResult | undefined;

  constructor() {
    super();
  }

  public DrawNumbers(): void {
    logic.Initialize(10);

    const w = grid_count_w();
    const h = grid_count_h();
    // console.log('number w: ', w, 'h:',h);
    for (let i = 0; i < w; ++i) {
      for (let j = 0; j < h; ++j) {
        const n = logic.getNumber(i, j);
        const x = i * grid_size();
        const y = j * grid_size();
        const sprite = this.drawNumber(n, x, y);

        const s = index(i, j);
        this.numberSprites.set(s, sprite);
      }
    }

    this.AddGameResult(true);
  }

  public HideNumber(index: number): void {
    const sprite = this.numberSprites.get(index);
    if (sprite !== undefined) {
      sprite.visible = false;
    }
  }

  public AddGameResult(win: boolean): void {
    if (this.gameResult === undefined) {
      this.gameResult = new GameResult(win);
    }
    this.addChild(this.gameResult);
  }

  public RemoveGameResult(): void {
    if (this.gameResult !== undefined) {
      this.removeChild(this.gameResult);
      this.gameResult.destroy({ children: true });
      this.gameResult = undefined;
    }
  }

  private drawNumber(num: number, x: number, y: number): PIXI.Sprite {
    const picture = AssetsManager().GetSpriteFromNumberAtlas(num + '.png');
    picture.width = 80;
    picture.height = 80;
    picture.x = x + offset_x() + 20;
    picture.y = y + OFFSET_Y + 20;
    this.addChild(picture);

    return picture;
  }
}
