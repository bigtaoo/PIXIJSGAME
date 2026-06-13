import * as PIXI from 'pixi.js-legacy';
import { WebAssetsManager } from './assetsManager/webAssetsManager';
import { LoadingOverlay } from './ui/loadingOverlay';
import { playSplash } from './ui/splashScreen';

declare const TARGET: string;
import { InputManager } from './inputSystem/inputManager';
import { setupWebInput } from './inputSystem/webAdapter';
import { AppContext } from './game/appContext';
import { SceneCoordinator } from './game/sceneCoordinator';
import { setPlayerPrefsImpl } from './playerPrefs/playerPrefs';
import { WebPlayerPrefs } from './playerPrefs/webPlayerPrefs';
import { MobileAudioManager } from './game/mobileAudioManager';

window.onload = async () => {
  const loadingOverlay = TARGET !== 'mobile' ? new LoadingOverlay() : null;

  const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1099bb,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  const canvas = app.view as HTMLCanvasElement;
  document.body.appendChild(canvas);

  const prefs = new WebPlayerPrefs();
  setPlayerPrefsImpl(prefs);

  const assets = new WebAssetsManager();
  try {
    await assets.loadAssets((loaded, total) => loadingOverlay?.setProgress(loaded / total));
  } catch (err) {
    console.error('[init] loadAssets failed:', err);
    // Textless on-device signal: a solid red full-screen overlay marks an asset
    // load failure (vs a white screen for other init problems). Error detail
    // goes to the console only — keeps the game free of any on-screen text.
    const msg = document.createElement('div');
    msg.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;background:#c00;z-index:9999;';
    document.body.appendChild(msg);
    return;
  }

  // Generate programmatic textures after renderer is ready
  assets.generateProgrammaticTextures(app.renderer as unknown as PIXI.Renderer);
  await loadingOverlay?.dismiss();

  // Branded splash, shown on every launch before the first scene appears.
  await playSplash(app, assets);

  const input = new InputManager();
  setupWebInput(canvas, input);

  const audio = new MobileAudioManager(prefs);

  const ctx: AppContext = {
    assets,
    input,
    renderer: app.renderer as unknown as PIXI.Renderer,
    audio,
  };

  const coordinator = new SceneCoordinator(ctx);
  app.stage.addChild(coordinator);

  // ── Resize helper ──────────────────────────────────────────────────
  const doResize = (): void => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    coordinator.resize(window.innerWidth, window.innerHeight);
  };

  doResize();
  window.addEventListener('resize', doResize);
  // iOS WKWebView does not reliably fire 'resize' on orientation change;
  // listen to 'orientationchange' and delay until dimensions are updated.
  window.addEventListener('orientationchange', () => setTimeout(doResize, 150));

  // Start background music on first user gesture (browser autoplay policy).
  const startMusicOnce = (): void => {
    audio.playBgMusic();
    canvas.removeEventListener('pointerdown', startMusicOnce);
  };
  canvas.addEventListener('pointerdown', startMusicOnce);

  app.ticker.add(() => {
    coordinator.update(app.ticker.elapsedMS);
  });

  // Pause when the tab/app goes to background (web + Capacitor iOS).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) coordinator.pauseIfPlaying();
  });
};
