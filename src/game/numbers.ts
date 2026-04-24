import * as PIXI from 'pixi.js-legacy';
import { AssetsManager } from '../assetsManager/assetsManager';
import { OFFSET_X, OFFSET_Y } from './consts';

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
            this.drawNumber(i, i * 100, 100);
        }
    }

    private drawNumber(num: number, x: number, y: number) : void
    {
        const picture = AssetsManager().GetSpriteFromNumberAtlas(num + '.png');
        picture.width = 100;
        picture.height = 100;
        picture.x = x + OFFSET_X;
        picture.y = y + OFFSET_Y;
        this.Container.addChild(picture);

        picture.eventMode = 'static';
        picture.on('pointertap', () => { console.log('onclick: ', num); });
    }
}