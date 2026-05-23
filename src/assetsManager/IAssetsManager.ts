import * as PIXI from 'pixi.js-legacy';

export interface IAssetsManager {
  loadAssets(): Promise<void>;
  generateProgrammaticTextures(renderer: PIXI.Renderer): void;
  GetTexture(key: string): PIXI.Texture;
  GetSpriteFromNumberAtlas(key: string): PIXI.Sprite;
}
