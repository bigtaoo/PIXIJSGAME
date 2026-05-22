import * as PIXI from 'pixi.js-legacy';
import { IAssetsManager } from '../assetsManager/IAssetsManager';

export class Effect {
  private atlasSprites: PIXI.Texture[] = [];
  private sprite: PIXI.Sprite;
  private time = 0;
  private nextTime = 0;
  private readonly frameTime = 70;
  private spriteIndex = 0;

  constructor(sprite: PIXI.Sprite, assets: IAssetsManager) {
    this.sprite = sprite;
    for (let i = 0; i < 7; ++i) {
      this.atlasSprites.push(assets.GetTexture(`boom-${i}.png`));
    }
  }

  public Play(x: number, y: number): void {
    this.time = 0;
    this.nextTime = this.frameTime;
    this.spriteIndex = 0;
    this.sprite.texture = this.atlasSprites[0];
    this.sprite.visible = true;
    this.sprite.x = x;
    this.sprite.y = y;
  }

  public Update(delta: number): void {
    this.time += delta;
    if (this.time < this.nextTime) return;
    this.nextTime += this.frameTime;
    this.spriteIndex++;
    if (this.spriteIndex >= this.atlasSprites.length) {
      this.sprite.visible = false;
      return;
    }
    this.sprite.texture = this.atlasSprites[this.spriteIndex];
  }

  public IsVisible(): boolean {
    return this.sprite.visible;
  }
}
