import * as PIXI from 'pixi.js-legacy';
import { WechatAssetsManager } from './assetsManager/wechatAssetsManager';
import { AssetsManager, setAssetsManager } from './assetsManager/assetsManager';

async function Init() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const width = info.screenWidth;
    const height = info.screenHeight;

    const canvas = wx.createCanvas();
    const globalObj: any = typeof GameGlobal !== 'undefined' ? GameGlobal : null;
    console.log('global obj: ', globalObj);
    if (globalObj) {
        globalObj.canvas = canvas;
    }

    const app = new PIXI.Application({
        view: canvas,
        width,
        height,
        backgroundColor: 0x1099bb,
        forceCanvas: true,
    });

    const container = new PIXI.Container();

    app.stage.addChild(container);

    const image = wx.createImage();
    image.src = 'assets/bunny.png';

    image.onload = () => {
        // console.log('Image on load: ', image);
        const baseTexture = new PIXI.BaseTexture(
            new PIXI.ImageResource(image)
        );
        const texture = PIXI.Texture.from(baseTexture);
        for (let i = 0; i < 25; i++) {
            const bunny = new PIXI.Sprite(texture);

            bunny.x = (i % 5) * 40;
            bunny.y = Math.floor(i / 5) * 40;
            container.addChild(bunny);
        }
    };

    // Move the container to the center
    container.x = app.screen.width / 2;
    container.y = app.screen.height / 2;

    // Center the bunny sprites in local container coordinates
    container.pivot.x = container.width / 2;
    container.pivot.y = container.height / 2;

    app.ticker.add(() => {
        container.rotation += 0.01;
    });

    const wechatAssetsManager = new WechatAssetsManager();
    await wechatAssetsManager.loadAssets();
    setAssetsManager(wechatAssetsManager);
    const number1 = AssetsManager().GetSpriteFromNumberAtlas("3.png");
    container.addChild(number1);

    console.log('Pixi running with fake GameGlobal');
}

Init();
