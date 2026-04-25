import * as PIXI from 'pixi.js-legacy';
import { grid_count_h, grid_count_w, grid_size, index, offset_x } from './helper';
import { AssetsManager } from '../assetsManager/assetsManager';
import { OFFSET_Y } from './consts';

export class Grid
{
    private Container: PIXI.Container;
    private Grids: Map<number, PIXI.Sprite> = new Map();

    constructor(container: PIXI.Container){
        this.Container = container;
    }

    public DrawGrids(): void{
        const w = grid_count_w();
        const h = grid_count_h();
        console.log('grid w: ', w, ' h: ', h);
        for (let i = 0; i < w; ++i){
            for (let j = 0; j < h; ++j){
                const c = index(i, j);
                const s = AssetsManager().GetSpriteFromNumberAtlas('Blue.png');
                s.x = i * grid_size() + offset_x();
                s.y = j * grid_size() + OFFSET_Y;
                s.width = grid_size();
                s.height = grid_size();
                this.Container.addChild(s);
                this.Grids.set(c, s);
            }
        }
    }
}