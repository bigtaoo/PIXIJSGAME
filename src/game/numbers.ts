import * as PIXI from 'pixi.js-legacy';
import { AssetsManager } from '../assetsManager/assetsManager';

export class Numbers
{
    private Container: PIXI.Container;

    constructor(container: PIXI.Container)
    {
        this.Container = container;
    }

    public DrawNumbers() : void
    {
        for (let i = 0; i < 10; ++i)
        {
            this.drawNumber(i, i * 150, 100);
        }
    }

    private drawNumber(num: number, x: number, y: number) : void
    {
        const picture = AssetsManager().GetSpriteFromNumberAtlas(num + '.png');
        picture.x = x;
        picture.y = y;
        this.Container.addChild(picture);
    }
}