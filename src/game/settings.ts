import * as PIXI from 'pixi.js-legacy';
import { AssetsManager } from '../assetsManager/assetsManager';
import { UIElement } from '../inputSystem/uiElement';
import { Input } from '../inputSystem/inputManager';
import { config } from './config';

export class Settings extends PIXI.Container {
  constructor() {
    super();

    this.drawBackground();
  }

  private drawBackground(): void {
    const background = AssetsManager().GetSpriteFromNumberAtlas('note.png');
    background.width = 1500;
    background.height = 800;
    background.x = 300;
    background.y = 200;
    this.addChild(background);

    const close = AssetsManager().GetSpriteFromNumberAtlas('clock.png');
    close.width = 300;
    close.height = 200;
    close.x = 600;
    close.y = 500;
    this.addChild(close);
    const uiButton = new UIElement({
      zIndex: 10,
      sprite: close,
      onTap: () => {
        this.visible = false;
        config.isPause = false;
      },
    });
    Input.registerUI(uiButton);
  }
}
