import * as PIXI from 'pixi.js-legacy';
import { AssetsManager } from '../assetsManager/assetsManager';

export class GameResult extends PIXI.Container {
  private isWin: boolean;
  constructor(win: boolean) {
    super();
    this.isWin = win;

    this.draw();
  }

  private draw(): void {
    const bcakground = AssetsManager().GetSpriteFromNumberAtlas('note.png');
    bcakground.width = 600;
    bcakground.height = 700;
    bcakground.x = 720;
    bcakground.y = 270;
    this.addChild(bcakground);
  }
}
