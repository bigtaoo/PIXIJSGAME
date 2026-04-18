import * as PIXI from 'pixi.js-legacy';
import numberJsonUrl from './assets/numbers.json';
import numberPngUrl from './assets/numbers.png';

class AssetsManager
{
    private textures: Record<string, PIXI.Texture> = {};

    public async loadAssets(): Promise<void>
    {
        // 1. Load JSON manually
        const res = await fetch(numberJsonUrl);
        const atlas = await res.json();

        // 2. Load image manually (IMPORTANT: use real URL)
        const baseTexture = PIXI.BaseTexture.from(numberPngUrl);

        const frames = atlas.frames;

        // 3. Build textures
        for (const key in frames)
        {
            const frame = frames[key].frame;

            const texture = new PIXI.Texture(
                baseTexture,
                new PIXI.Rectangle(
                    frame.x,
                    frame.y,
                    frame.w,
                    frame.h
                )
            );

            this.textures[key] = texture;
        }
    }

    public GetSpriteFromNumberAtlas(key: string): PIXI.Sprite
    {
        const texture = this.textures[key];

        if (!texture)
        {
            throw new Error(`Missing texture: ${key}`);
        }

        return new PIXI.Sprite(texture);
    }
}

export const assetsManager = new AssetsManager();
