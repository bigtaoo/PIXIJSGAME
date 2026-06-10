import * as PIXI from 'pixi.js-legacy';

/** Minimal texture-atlas JSON shape (TexturePacker format subset). */
export interface AtlasJson {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
}

export interface IAssetsManager {
  loadAssets(): Promise<void>;
  generateProgrammaticTextures(renderer: PIXI.Renderer): void;
  GetTexture(key: string): PIXI.Texture;
  GetSpriteFromNumberAtlas(key: string): PIXI.Sprite;
}
