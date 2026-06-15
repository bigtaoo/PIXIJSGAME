/**
 * GameDistribution platform entry point.
 *
 * Bundled by webpack when TARGET=gamedistribution. The game is the same web
 * build, wrapped by the GameDistribution HTML5 SDK (loaded in
 * public/gamedistribution.html). This file and src/platform/gdService.ts are
 * the ONLY places that reference the GD SDK, so nothing GD-specific leaks into
 * the web / wechat / crazygames / telegram bundles.
 */

import * as PIXI from 'pixi.js-legacy';
import { WebAssetsManager } from './assetsManager/webAssetsManager';
import { LoadingOverlay } from './ui/loadingOverlay';
import { playSplash } from './ui/splashScreen';
import { InputManager } from './inputSystem/inputManager';
import { setupWebInput } from './inputSystem/webAdapter';
import { AppContext } from './game/appContext';
import { SceneCoordinator } from './game/sceneCoordinator';
import { setPlayerPrefsImpl } from './playerPrefs/playerPrefs';
import { AudioManager } from './game/audioManager';
import { WebPlayerPrefs } from './playerPrefs/webPlayerPrefs';
import { gd } from './platform/gdService';

window.onload = async () => {
  const loadingOverlay = new LoadingOverlay();

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

  const audio = new AudioManager(prefs);

  // ── GD lifecycle: mute + pause while a video ad plays, resume after ──
  // (GD forbids background audio during ads.) coordinator is assigned below;
  // the closure reads it lazily so ads firing before init are still safe.
  let coordinator: SceneCoordinator | null = null;
  gd.init({
    onPause: () => {
      coordinator?.pauseIfPlaying();
      audio.stopBgMusic();
    },
    onResume: () => {
      if (audio.isMusicEnabled()) audio.playBgMusic();
    },
  });

  const assets = new WebAssetsManager();
  try {
    await assets.loadAssets((loaded, total) => loadingOverlay.setProgress(loaded / total));
  } catch (err) {
    console.error('[init] loadAssets failed:', err);
    const msg = document.createElement('div');
    msg.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;background:#c00;z-index:9999;';
    document.body.appendChild(msg);
    return;
  }

  assets.generateProgrammaticTextures(app.renderer as unknown as PIXI.Renderer);
  await loadingOverlay.dismiss();

  await playSplash(app, assets);

  const input = new InputManager();
  setupWebInput(canvas, input);

  const ctx: AppContext = {
    assets,
    input,
    renderer: app.renderer as unknown as PIXI.Renderer,
    audio,
    platform: {
      // GD auto-detects gameplay; no explicit start/stop markers needed.
      gameplayStart: () => {},
      gameplayStop: () => {},
      // Both ad calls originate from in-game button taps (user input), as
      // required by GD's ad rules.
      requestInterstitialAd: () => gd.showInterstitial(),
      requestExtraLife: () => gd.showRewarded(),
    },
  };

  coordinator = new SceneCoordinator(ctx);
  app.stage.addChild(coordinator);

  const doResize = (): void => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    coordinator?.resize(window.innerWidth, window.innerHeight);
  };
  doResize();
  window.addEventListener('resize', doResize);

  // Start background music on first user gesture (browser autoplay policy).
  const startMusicOnce = (): void => {
    if (audio.isMusicEnabled()) audio.playBgMusic();
    canvas.removeEventListener('pointerdown', startMusicOnce);
  };
  canvas.addEventListener('pointerdown', startMusicOnce);

  app.ticker.add(() => {
    coordinator?.update(app.ticker.elapsedMS);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) coordinator?.pauseIfPlaying();
  });
};
