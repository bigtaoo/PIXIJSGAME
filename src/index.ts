import * as PIXI from 'pixi.js-legacy';
import { WebAssetsManager } from './assetsManager/webAssetsManager';
import { InputManager } from './inputSystem/inputManager';
import { setupWebInput } from './inputSystem/webAdapter';
import { AppContext } from './game/appContext';
import { SceneCoordinator } from './game/sceneCoordinator';
import { setPlayerPrefsImpl } from './playerPrefs/playerPrefs';
import { WebPlayerPrefs } from './playerPrefs/webPlayerPrefs';
import { MobileAudioManager } from './game/mobileAudioManager';

window.onload = async () => {
  const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1099bb,
  });

  const canvas = app.view as HTMLCanvasElement;
  document.body.appendChild(canvas);

  const prefs = new WebPlayerPrefs();
  setPlayerPrefsImpl(prefs);

  const assets = new WebAssetsManager();
  try {
    await assets.loadAssets();
  } catch (err) {
    console.error('[init] loadAssets failed:', err);
    // Show error on screen so we can diagnose on device
    const msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;top:0;left:0;width:100%;padding:20px;background:#c00;color:#fff;font:16px monospace;z-index:9999;word-break:break-all;';
    msg.textContent = '[loadAssets error] ' + String(err);
    document.body.appendChild(msg);
    return;
  }

  // Generate programmatic textures after renderer is ready
  assets.generateProgrammaticTextures(app.renderer as unknown as PIXI.Renderer);

  const input = new InputManager();
  setupWebInput(canvas, input);

  const audio = new MobileAudioManager(prefs);

  const ctx: AppContext = { assets, input, renderer: app.renderer as unknown as PIXI.Renderer, audio };

  const coordinator = new SceneCoordinator(ctx);
  app.stage.addChild(coordinator);

  // ── Resize helper ──────────────────────────────────────────────────
  const doResize = (): void => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    coordinator.resize(window.innerWidth, window.innerHeight);
  };

  doResize();
  window.addEventListener('resize', doResize);

  // Start background music on first user gesture (browser autoplay policy).
  const startMusicOnce = (): void => {
    audio.playBgMusic();
    canvas.removeEventListener('pointerdown', startMusicOnce);
  };
  canvas.addEventListener('pointerdown', startMusicOnce);

  app.ticker.add(() => {
    coordinator.update(app.ticker.elapsedMS);
  });
};
