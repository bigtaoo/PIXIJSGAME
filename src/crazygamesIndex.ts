/**
 * CrazyGames platform entry point.
 *
 * Bundled by webpack when TARGET=crazygames.
 * This file (and src/platform/crazygamesService.ts) are the ONLY places
 * that reference the CrazyGames SDK — they are never imported by the
 * web or wechat builds, so nothing CrazyGames-specific leaks into them.
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
import { crazyGames } from './platform/crazygamesService';

window.onload = async () => {
  // ── 0. Show loading overlay immediately ───────────────────────────
  const loadingOverlay = new LoadingOverlay();

  // ── 1. Init SDK (must happen before loadingStart) ─────────────────
  await crazyGames.init();

  // ── 2. Signal loading start to CrazyGames ─────────────────────────
  crazyGames.loadingStart();

  // ── 3. Bootstrap PIXI ─────────────────────────────────────────────
  const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1099bb,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  const canvas = app.view as HTMLCanvasElement;
  document.body.appendChild(canvas);

  // ── 4. Platform services (reuse web implementations) ──────────────
  const prefs = new WebPlayerPrefs();
  setPlayerPrefsImpl(prefs);

  const assets = new WebAssetsManager();
  await assets.loadAssets((loaded, total) => loadingOverlay.setProgress(loaded / total));
  assets.generateProgrammaticTextures(app.renderer as unknown as PIXI.Renderer);

  const input = new InputManager();
  setupWebInput(canvas, input);

  // ── 5. Signal loading complete and dismiss overlay ────────────────
  crazyGames.loadingStop();
  await loadingOverlay.dismiss();

  // Branded splash, shown on every launch before the first scene appears.
  await playSplash(app, assets);

  // ── 5a. Request banner ad ─────────────────────────────────────────
  // 'cg-banner' is the DOM container id (must exist in the HTML).
  void crazyGames.requestBanner('cg-banner', [728, 90]);

  // ── 6. Build scene graph ──────────────────────────────────────────
  const audio = new AudioManager(prefs);
  const ctx: AppContext = {
    assets,
    input,
    renderer: app.renderer as unknown as PIXI.Renderer,
    audio,
    platform: {
      gameplayStart: () => crazyGames.gameplayStart(),
      gameplayStop: () => crazyGames.gameplayStop(),
      requestInterstitialAd: () => crazyGames.showInterstitialAdThrottled(10 * 60 * 1000),
      requestExtraLife: () => crazyGames.showRewardedAd(),
      submitDailyScore: async (score: number) => {
        if (!crazyGames.isUserAccountAvailable) return;
        let user = await crazyGames.getUser();
        if (!user) {
          user = await crazyGames.showAuthPrompt();
        }
        if (user) {
          await crazyGames.saveScore('daily-challenge', score);
        }
      },
    },
  };
  const coordinator = new SceneCoordinator(ctx);
  app.stage.addChild(coordinator);

  // ── 7. Resize ─────────────────────────────────────────────────────
  const doResize = (): void => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    coordinator.resize(window.innerWidth, window.innerHeight);
  };
  doResize();
  window.addEventListener('resize', doResize);

  // ── 8. Game loop ──────────────────────────────────────────────────
  app.ticker.add(() => {
    coordinator.update(app.ticker.elapsedMS);
  });

  // ── 9. Page lifecycle ─────────────────────────────────────────────
  // Notify CrazyGames before the page reloads or navigates away so it
  // doesn't count the session as a crash.
  window.addEventListener('beforeunload', () => {
    crazyGames.clearBanner('cg-banner');
    crazyGames.sdkGameLoadingStart();
  });

  // Pause when the tab/app goes to background.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) coordinator.pauseIfPlaying();
  });

  // -- 10. Auth state listener --
  // Kept for debugging; submitDailyScore handles auth on-demand.
  if (crazyGames.isUserAccountAvailable) {
    crazyGames.onAuthChange((user) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CrazyGames] Auth state changed:', user?.username ?? 'logged out');
      }
    });
  }
};

