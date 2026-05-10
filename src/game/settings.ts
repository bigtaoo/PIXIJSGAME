import * as PIXI from 'pixi.js-legacy';
import { AssetsManager } from '../assetsManager/assetsManager';

export class Settings extends PIXI.Container {
  constructor() {
    super();

    this.drawBackground();
  }

  private drawBackground(): void {
    const background = AssetsManager().GetSpriteFromNumberAtlas('note.png');
    background.width = 1000;
    background.height = 500;
    background.x = 300;
    background.y = 200;
    this.addChild(background);
  }
}
