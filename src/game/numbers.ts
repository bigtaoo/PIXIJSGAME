import * as PIXI from 'pixi.js-legacy';
import { AssetsManager } from '../assetsManager/assetsManager';
import { OFFSET_Y } from './consts';
import { grid_count_h, grid_count_w, grid_size, index, offset_x } from './helper';
import { logic } from './logic';

export class Numbers extends PIXI.Container {
  private numberSprites: Map<number, PIXI.Sprite> = new Map();

  constructor() {
    super();
  }

  public DrawNumbers(): void {
    const w = grid_count_w();
    const h = grid_count_h();
    // console.log('number w: ', w, 'h:',h);
    for (let i = 0; i < w; ++i) {
      for (let j = 0; j < h; ++j) {
        const n = logic.getNumber(i, j);
        const s = index(i, j);
        let sprite = this.numberSprites.get(s);
        if (!sprite) {
          const x = i * grid_size();
          const y = j * grid_size();
          sprite = this.drawNumber(n, x, y);
          this.numberSprites.set(s, sprite);
        } else {
          sprite.texture = AssetsManager().GetTexture(`${n}.png`);
        }
      }
    }
  }

  public HideNumber(index: number): void {
    const sprite = this.numberSprites.get(index);
    if (sprite) {
      sprite.visible = false;
    }
  }

  public NewGame(): void {
    for (const v of this.numberSprites.values()) {
      v.visible = true;
    }
    this.DrawNumbers();
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
