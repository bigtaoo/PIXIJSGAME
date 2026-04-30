import * as PIXI from 'pixi.js-legacy';
import { AssetsManager } from '../assetsManager/assetsManager';
import { config } from './config';
import { Orientation } from './enums';

export class Header extends PIXI.Container {
  private background: PIXI.NineSlicePlane;

  constructor() {
    super();

    this.width = config.Width;
    this.height = 500;

    const backgroundTexture = AssetsManager().GetTexture('note.png');
    this.background = new PIXI.NineSlicePlane(backgroundTexture, 220, 200, 220, 200);
    this.addChild(this.background);
    this.background.texture = backgroundTexture;

    const testt = AssetsManager().GetTexture('note.png');
    const test = new PIXI.Sprite(testt);
    this.addChild(test);
    test.width = 3;
    test.height = 3;

    if (config.Orientation === Orientation.Landscape) {
      // this.width = Math.floor(config.Width * 2 / 3);
      // this.height = 500;
      this.x = 350;
      this.y = 10;
      console.log(`header landscape width: ${this.width}, x: ${this.x}`);

      this.background.width = 1350;
      this.background.height = 250;
    }
  }

  private drawTip(): void {
    const first = Math.floor((Math.random() * 10000) % 9) + 1;
    const second = 10 - first;
  }
}
