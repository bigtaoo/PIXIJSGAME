import * as PIXI from 'pixi.js-legacy';
import { AssetsManager } from '../assetsManager/assetsManager';
import { OFFSET_Y } from './consts';
import { grid_count_h, grid_count_w, grid_size, offset_x } from './helper';
import { UIElement } from '../inputSystem/uiElement';
import { Input } from '../inputSystem/inputManager';
import { logic } from './logic';

export class Numbers
{
    private Container: PIXI.Container;

    constructor(container: PIXI.Container)
    {
        this.Container = container;
    }

    public DrawNumbers() : void
    {
        logic.Initialize(10);

        const w = grid_count_w();
        const h = grid_count_h();
        console.log('number w: ', w, 'h:',h);
        for (let i = 0; i < w; ++i){
            for (let j = 0; j < h; ++j){
                const n = logic.getNumber(i, j);
                const x = i * grid_size();
                const y = j * grid_size();
                this.drawNumber(n, x, y);
            }
        }
    }

    private drawNumber(num: number, x: number, y: number) : void
    {
        const picture = AssetsManager().GetSpriteFromNumberAtlas(num + '.png');
        picture.width = 80;
        picture.height = 80;
        picture.x = x + offset_x() + 20;
        picture.y = y + OFFSET_Y + 20;
        this.Container.addChild(picture);

        // picture.eventMode = 'static';
        // picture.on('pointertap', () => { console.log('onclick: ', num); });
        var uiButton = new UIElement({
            zIndex: 10,
            sprite: picture,
            onTap: () => {
                console.log('clicked number: ', num);
            },
        });
        Input.registerUI(uiButton);
    }
}