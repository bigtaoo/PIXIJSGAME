import * as PIXI from 'pixi.js-legacy';
import { AssetsManager } from '../assetsManager/assetsManager';
import { OFFSET_Y } from './consts';
import { offset_x } from './helper';
import { UIElement } from '../inputSystem/uiElement';
import { Input } from '../inputSystem/inputManager';

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
        picture.x = x + offset_x();
        picture.y = y + OFFSET_Y;
        this.Container.addChild(picture);

        // picture.eventMode = 'static';
        // picture.on('pointertap', () => { console.log('onclick: ', num); });
        var uiButton = new UIElement({
            zIndex: 10,
            bounds: () => picture.getBounds(),
            onTap: () => {
                console.log('clicked number: ', num);
            },
        });
        Input.registerUI(uiButton);
    }
}