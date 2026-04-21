import * as PIXI from 'pixi.js-legacy';
import { GAME_HEIGHT, GAME_WIDTH } from './consts';
import { AssetsManager } from '../assetsManager/assetsManager';
import { config } from './config';

export class GameScene extends PIXI.Container
{
    constructor()
    {
        super();
    }

    public Resize(windowWidth: number, windowHeight: number) : void
    {
        if (windowWidth > windowHeight)
        {
            config.Width = GAME_HEIGHT;
            config.Height = GAME_WIDTH;
        }
        else
        {
            config.Width = GAME_WIDTH;
            config.Height = GAME_HEIGHT;
        }
        const scale = Math.min(
            windowWidth / config.Width,
            windowHeight / config.Height
        );
  
        config.Scale = scale;
        this.x = (windowWidth - config.Width * scale) / 2;
        this.y = (windowHeight - config.Height * scale) / 2;
        this.width = config.Width;
        this.height = config.Height;
        this.scale.set(scale);

        console.log('window w: ', windowWidth, 'window h: ', windowHeight, 'scale: ', scale);
        console.log('w: ', this.width, ' h: ', this.height, 'x: ', this.x, 'y: ', this.y);
    }

    public Draw() : void
    {
        this.drawBackground();
    }

    private drawBackground() : void
    {
        const background = AssetsManager().GetSpriteFromNumberAtlas("background.png");
        background.width = config.Width;
        background.height = config.Height;
        this.addChild(background);
    }
}