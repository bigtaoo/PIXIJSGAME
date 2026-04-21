import * as PIXI from 'pixi.js-legacy';
import numbersJson from '../assets/numbers.json'
import { IAssetsManager } from './IAssetsManager';

export class WechatAssetsManager implements IAssetsManager
{
    private textures: Record<string, PIXI.Texture> = {};

    private loadImageWX(src: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const img = wx.createImage();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    private loadJSONWX(): Promise<any> {
        return Promise.resolve(numbersJson);
    }

    public async loadAssets(): Promise<void>
    {
        const [image, atlasData] = await Promise.all([
            this.loadImageWX('assets/numbers.png'),
            this.loadJSONWX()
        ]);
        // console.log('image: w-', image.width);
        // console.log('json', atlasData);

        const resource = new PIXI.CanvasResource(image); 
        const baseTexture = new PIXI.BaseTexture(resource);

        for (const frameName in atlasData.frames) {
            const frame = atlasData.frames[frameName].frame;

            const rect = new PIXI.Rectangle(
                frame.x,
                frame.y,
                frame.w,
                frame.h
            );

            this.textures[frameName] = new PIXI.Texture(baseTexture, rect);
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

// export const wechatAssetsManager = new WechatAssetsManager();
