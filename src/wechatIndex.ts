import * as PIXI from 'pixi.js-legacy';
import { WechatAssetsManager } from './assetsManager/wechatAssetsManager';
import { InputManager } from './inputSystem/inputManager';
import { setupWeChatInput } from './inputSystem/wechatAdapter';
import { AppContext } from './game/appContext';
import { SceneCoordinator } from './game/sceneCoordinator';
import { setPlayerPrefsImpl } from './playerPrefs/playerPrefs';
import { AudioManager } from './game/audioManager';
import { WechatPlayerPrefs } from './playerPrefs/wechatPlayerPrefs';

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

  // Initialise storage first
  const prefs = new WechatPlayerPrefs();
  setPlayerPrefsImpl(prefs);

  const assets = new WechatAssetsManager();
  await assets.loadAssets();

  const input = new InputManager();
  setupWeChatInput(input);

  assets.generateProgrammaticTextures(app.renderer as unknown as PIXI.Renderer);

  const audio = new AudioManager(prefs);
  const ctx: AppContext = { assets, input, renderer: app.renderer as unknown as PIXI.Renderer, audio };

  const coordinator = new SceneCoordinator(ctx);
  app.stage.addChild(coordinator);
  coordinator.resize(width, height);

  app.ticker.add(() => coordinator.update(app.ticker.elapsedMS));
}

Init();
