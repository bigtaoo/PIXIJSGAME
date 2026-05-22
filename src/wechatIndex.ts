import * as PIXI from 'pixi.js-legacy';
import { WechatAssetsManager } from './assetsManager/wechatAssetsManager';
import { InputManager } from './inputSystem/inputManager';
import { setupWeChatInput } from './inputSystem/wechatAdapter';
import { AppContext } from './game/appContext';
import { GameScene } from './game/gameScene';

async function Init() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const width = info.screenWidth;
  const height = info.screenHeight;

  const canvas = wx.createCanvas();
  const globalObj: any = typeof GameGlobal !== 'undefined' ? GameGlobal : null;
  if (globalObj) globalObj.canvas = canvas;

  const app = new PIXI.Application({
    view: canvas,
    width,
    height,
    backgroundColor: 0x1099bb,
    forceCanvas: true,
  });

  const assets = new WechatAssetsManager();
  await assets.loadAssets();

  const input = new InputManager();
  setupWeChatInput(input);

  const ctx: AppContext = { assets, input };

  const scene = new GameScene(ctx);
  app.stage.addChild(scene);
  scene.resize(width, height);

  app.ticker.add(() => scene.update(app.ticker.elapsedMS));
}

Init();
