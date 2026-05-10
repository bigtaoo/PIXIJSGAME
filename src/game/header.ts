import * as PIXI from 'pixi.js-legacy';
import { AssetsManager } from '../assetsManager/assetsManager';
import { config } from './config';
import { Orientation } from './enums';

export class Header extends PIXI.Container {
  private background: PIXI.NineSlicePlane;
  private time1: PIXI.Sprite;
  private time2: PIXI.Sprite;
  private displayTime: number = 0;

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
      this.x = 350;
      this.y = 10;
      console.log(`header landscape width: ${this.width}, x: ${this.x}`);

      this.background.width = 1350;
      this.background.height = 250;
    }

    this.time1 = AssetsManager().GetSpriteFromNumberAtlas('1.png');
    this.time2 = AssetsManager().GetSpriteFromNumberAtlas('0.png');
    this.drawTip();
    this.drawTime();
  }

  public UpdateTime(): void {
    if (config.isGameEnd) {
      return;
    }
    const remainingTime = Math.floor((config.TimeCount - config.GameTime) / 1000);
    if (remainingTime === this.displayTime) {
      return;
    }
    this.displayTime = remainingTime;
    if (this.displayTime < 10) {
      this.time2.visible = false;
      this.time1.texture = AssetsManager().GetTexture(`${this.displayTime}.png`);
    } else if (this.displayTime >= 10 && this.displayTime < 100) {
      const ten = Math.floor(this.displayTime / 10);
      const digit = this.displayTime - ten * 10;
      this.time2.visible = true;
      this.time1.texture = AssetsManager().GetTexture(`${ten}.png`);
      this.time2.texture = AssetsManager().GetTexture(`${digit}.png`);
    }
  }

  private drawSettings(): void {}

  private drawTime(): void {
    this.time1.width = 100;
    this.time1.height = 120;
    this.time2.width = 100;
    this.time2.height = 120;
    this.addChild(this.time1);
    this.addChild(this.time2);
    this.time1.y = 73;
    this.time2.y = 73;
    this.time1.x = 800;
    this.time2.x = 920;

    const clock = AssetsManager().GetSpriteFromNumberAtlas('clock.png');
    this.addChild(clock);
    clock.width = 170;
    clock.height = 170;
    clock.x = 600;
    clock.y = 50;
  }

  private drawTip(): void {
    const width = 80;
    const height = 100;
    const y = 85;
    const first = Math.floor((Math.random() * 10000) % 9) + 1;
    const second = 10 - first;
    const firstSprite = AssetsManager().GetSpriteFromNumberAtlas(`${first}.png`);
    this.addChild(firstSprite);
    firstSprite.width = width;
    firstSprite.height = height;
    firstSprite.y = y;
    const secondSprite = AssetsManager().GetSpriteFromNumberAtlas(`${second}.png`);
    this.addChild(secondSprite);
    secondSprite.width = width;
    secondSprite.height = height;
    secondSprite.y = y;
    const plus = AssetsManager().GetSpriteFromNumberAtlas('plus.png');
    this.addChild(plus);
    plus.width = width;
    plus.height = height;
    plus.y = y;
    const num1 = AssetsManager().GetSpriteFromNumberAtlas('1.png');
    this.addChild(num1);
    num1.width = width;
    num1.height = height;
    num1.y = y;
    const num2 = AssetsManager().GetSpriteFromNumberAtlas('0.png');
    this.addChild(num2);
    num2.width = width;
    num2.height = height;
    num2.y = y;
    const equal = AssetsManager().GetSpriteFromNumberAtlas('equa.png');
    this.addChild(equal);
    equal.width = width;
    equal.height = height;
    equal.y = y;

    const s = 70;
    const add = 85;
    firstSprite.x = s;
    plus.x = s + add;
    secondSprite.x = s + add * 2;
    equal.x = s + add * 3;
    num1.x = s + add * 4;
    num2.x = s + add * 5;
  }
}
