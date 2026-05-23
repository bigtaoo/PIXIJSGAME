import * as PIXI from 'pixi.js-legacy';
import { IAssetsManager } from './IAssetsManager';

// ── digits.png 参数 ───────────────────────────────────────────────────────────
const DIGIT_W   = 120;
const DIGIT_H   = 160;
const DIGIT_GAP = 10;

export class WechatAssetsManager implements IAssetsManager {
  private textures: Record<string, PIXI.Texture> = {};

  private loadImageWX(src: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const img = wx.createImage();
      img.onload  = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private imageToBaseTexture(img: any): PIXI.BaseTexture {
    const resource = new PIXI.CanvasResource(img);
    return new PIXI.BaseTexture(resource);
  }

  public async loadAssets(): Promise<void> {
    // 数字精灵图
    const digitsImg  = await this.loadImageWX('assets/digits.png');
    const digitsBase = this.imageToBaseTexture(digitsImg);
    for (let i = 0; i <= 9; i++) {
      this.textures[`${i}.png`] = new PIXI.Texture(
        digitsBase,
        new PIXI.Rectangle(i * (DIGIT_W + DIGIT_GAP), 0, DIGIT_W, DIGIT_H),
      );
    }

    // 心形图标
    const heartImg = await this.loadImageWX('assets/heart.png');
    this.textures['heart.png'] = new PIXI.Texture(this.imageToBaseTexture(heartImg));

    const heartEmptyImg = await this.loadImageWX('assets/heart_empty.png');
    this.textures['heart_empty.png'] = new PIXI.Texture(this.imageToBaseTexture(heartEmptyImg));
  }

  /**
   * 微信小游戏环境暂不支持 renderer.generateTexture()，为空实现。
   * 场景中的程序化元素（格子、闹钟等）会直接使用 Graphics 对象渲染。
   */
  public generateProgrammaticTextures(_renderer: PIXI.Renderer): void {
    // TODO: 微信环境程序化纹理生成
  }

  public GetTexture(key: string): PIXI.Texture {
    const tex = this.textures[key];
    if (!tex) throw new Error(`Missing texture: "${key}"`);
    return tex;
  }

  public GetSpriteFromNumberAtlas(key: string): PIXI.Sprite {
    return new PIXI.Sprite(this.GetTexture(key));
  }
}
