import * as PIXI from 'pixi.js-legacy';
import { AssetsManager } from '../assetsManager/assetsManager';

export class GameResult extends PIXI.Container {
  private background: PIXI.Sprite | undefined;
  private retry: PIXI.Sprite | undefined;
  private next: PIXI.Sprite | undefined;
  constructor() {
    super();
  }

  public Draw(win: boolean): void {
    this.ensureResource();

    this.retry!.visible = !win;
    this.next!.visible = win;
  }

  private ensureResource(): void {
    if (!this.background) {
      this.background = AssetsManager().GetSpriteFromNumberAtlas('note.png');
      this.background.width = 600;
      this.background.height = 700;
      this.background.x = 720;
      this.background.y = 270;
      this.addChild(this.background);
    }

    const x = 830;
    const y = 410;
    if (!this.retry) {
      this.retry = AssetsManager().GetSpriteFromNumberAtlas('retry.png');
      this.retry.width = 400;
      this.retry.height = 400;
      this.retry.x = x;
      this.retry.y = y;
      this.addChild(this.retry);
    }

    if (!this.next) {
      this.next = AssetsManager().GetSpriteFromNumberAtlas('next.png');
      this.next.width = 400;
      this.next.height = 400;
      this.next.x = x;
      this.next.y = y;
      this.addChild(this.next);
    }
  }
}
