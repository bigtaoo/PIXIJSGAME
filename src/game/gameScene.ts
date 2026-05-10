import * as PIXI from 'pixi.js-legacy';
import { GAME_HEIGHT, GAME_WIDTH } from './consts';
import { AssetsManager } from '../assetsManager/assetsManager';
import { config } from './config';
import { Orientation } from './enums';
import { display } from './display';
import { logic } from './logic';

export class GameScene extends PIXI.Container {
  constructor() {
    super();

    display.Initialize(this);
  }

  public Resize(windowWidth: number, windowHeight: number): void {
    if (windowWidth > windowHeight) {
      config.Width = GAME_HEIGHT;
      config.Height = GAME_WIDTH;
      config.Orientation = Orientation.Landscape;
    } else {
      config.Width = GAME_WIDTH;
      config.Height = GAME_HEIGHT;
      config.Orientation = Orientation.Portrait;
    }
    const scale = Math.min(windowWidth / config.Width, windowHeight / config.Height);

    config.Scale = scale;
    this.x = (windowWidth - config.Width * scale) / 2;
    this.y = (windowHeight - config.Height * scale) / 2;
    this.width = config.Width;
    this.height = config.Height;
    this.scale.set(scale);

    console.log('window w: ', windowWidth, 'window h: ', windowHeight, 'scale: ', scale);
    // console.log('w: ', this.width, ' h: ', config.Height, 'x: ', this.x, 'y: ', this.y);
  }

  public Draw(): void {
    logic.Initialize(config.Target);
    this.drawBackground();
    display.Draw();
  }

  public Update(delta: number): void {
    config.GameTime += delta;
    display.Update(delta);
  }

  private drawBackground(): void {
    const background = AssetsManager().GetSpriteFromNumberAtlas('background.png');
    background.width = config.Width;
    background.height = config.Height;
    background.x = this.x;
    background.y = this.y;
    this.addChild(background);
    // console.log('background w: ', background.width, ' h: ', background.height, ' x: ', this.x, ' y: ', this.y);
  }
}
