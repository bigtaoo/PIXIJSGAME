import * as PIXI from 'pixi.js-legacy';
import numberJsonUrl from '../assets/numbers.json';
import numberPngUrl from '../assets/numbers.png';
import backgroundPng from '../assets/background.png';
import { IAssetsManager } from './IAssetsManager';

export class WebAssetsManager implements IAssetsManager
{
    private textures: Record<string, PIXI.Texture> = {};

    public async loadAssets(): Promise<void>
    {
        const res = await fetch(numberJsonUrl);
        const atlas = await res.json();
        const baseTexture = PIXI.BaseTexture.from(numberPngUrl);
        const frames = atlas.frames;
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

        const background = PIXI.BaseTexture.from(backgroundPng);
        this.textures['background.png'] = new PIXI.Texture(background);
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

// export const webAssetsManager = new WebAssetsManager();
