/* eslint-disable @typescript-eslint/no-explicit-any -- WeChat runtime shims; see inline comments */
import * as PIXI from 'pixi.js-legacy';
import { WechatAssetsManager } from './assetsManager/wechatAssetsManager';
import { InputManager } from './inputSystem/inputManager';
import { setupWeChatInput } from './inputSystem/wechatAdapter';
import { AppContext } from './game/appContext';
import { SceneCoordinator } from './game/sceneCoordinator';
import { setPlayerPrefsImpl } from './playerPrefs/playerPrefs';
import { WechatAudioManager } from './game/wechatAudioManager';
import { WechatPlayerPrefs } from './playerPrefs/wechatPlayerPrefs';

function setupPixiWechatAdapter(mainCanvas: HTMLCanvasElement) {
  // PixiJS's CanvasResource.test() uses `instanceof HTMLCanvasElement` and
  // ImageResource.test() uses `instanceof HTMLImageElement`. Neither class
  // exists in the WeChat mini-game runtime, so we register the WeChat
  // constructors as globals so PixiJS can recognise them.
  // Use the already-created main canvas to get its constructor — avoids
  // consuming the main canvas slot with a throwaway call to wx.createCanvas().
  (globalThis as any).HTMLCanvasElement = (mainCanvas as any).constructor;
  (globalThis as any).HTMLImageElement = wx.createImage().constructor;

  // Override settings.ADAPTER so all internal PixiJS canvas creation
  // (Texture.WHITE, tinting, etc.) uses wx.createCanvas() instead of
  // document.createElement('canvas').
  PIXI.settings.ADAPTER = {
    createCanvas: (width?: number, height?: number) => {
      const c = wx.createCanvas();
      if (width !== undefined) c.width = width;
      if (height !== undefined) c.height = height;
      return c as unknown as HTMLCanvasElement;
    },
    getCanvasRenderingContext2D: () => CanvasRenderingContext2D as any,
    getWebGLRenderingContext: () => WebGLRenderingContext as any,
    getNavigator: () => ({ userAgent: '' }) as Navigator,
    getBaseUrl: () => '',
    getFontFaceSet: () => undefined as any,
    fetch: (url: RequestInfo, init?: RequestInit) => fetch(url as string, init),
    parseXML: () => null as any,
  };
}

async function Init() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const width = info.screenWidth;
  const height = info.screenHeight;

  // Must be the FIRST wx.createCanvas() call — WeChat makes the first canvas
  // the visible screen canvas; all subsequent calls return offscreen canvases.
  const canvas = wx.createCanvas();
  setupPixiWechatAdapter(canvas as unknown as HTMLCanvasElement);
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

  const audio = new WechatAudioManager(prefs);
  const ctx: AppContext = {
    assets,
    input,
    renderer: app.renderer as unknown as PIXI.Renderer,
    audio,
  };

  // WeChat requires a user-gesture before audio can play.
  // Register a one-shot touchstart on the main canvas to unlock music.
  canvas.addEventListener(
    'touchstart',
    () => {
      audio.playBgMusic();
    },
    { once: true }
  );

  const coordinator = new SceneCoordinator(ctx);
  app.stage.addChild(coordinator);
  coordinator.resize(width, height);

  app.ticker.add(() => coordinator.update(app.ticker.elapsedMS));

  // Pause when the mini-game goes to background.
  wx.onHide(() => coordinator.pauseIfPlaying());

  wx.onWindowResize((res) => {
    const { windowWidth: w, windowHeight: h } = res.size;
    app.renderer.resize(w, h);
    coordinator.resize(w, h);
  });
}

Init();
