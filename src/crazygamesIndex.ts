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
import { InputManager } from './inputSystem/inputManager';
import { setupWebInput } from './inputSystem/webAdapter';
import { AppContext } from './game/appContext';
import { SceneCoordinator } from './game/sceneCoordinator';
import { setPlayerPrefsImpl } from './playerPrefs/playerPrefs';
import { AudioManager } from './game/audioManager';
import { WebPlayerPrefs } from './playerPrefs/webPlayerPrefs';
import { crazyGames } from './platform/crazygamesService';

window.onload = async () => {
  // ── 1. Init SDK (must happen before loadingStart) ─────────────────
  await crazyGames.init();

  // ── 2. Signal loading start to CrazyGames ─────────────────────────
  crazyGames.loadingStart();

  // ── 3. Bootstrap PIXI ─────────────────────────────────────────────
  const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1099bb,
  });

  const canvas = app.view as HTMLCanvasElement;
  document.body.appendChild(canvas);

  // ── 4. Platform services (reuse web implementations) ──────────────
  const prefs = new WebPlayerPrefs();
  setPlayerPrefsImpl(prefs);

  const assets = new WebAssetsManager();
  await assets.loadAssets();
  assets.generateProgrammaticTextures(app.renderer as unknown as PIXI.Renderer);

  const input = new InputManager();
  setupWebInput(canvas, input);

  // ── 5. Signal loading complete ────────────────────────────────────
  crazyGames.loadingStop();

  // ── 6. Build scene graph ──────────────────────────────────────────
  const audio = new AudioManager(prefs);
  const ctx: AppContext = {
    assets,
    input,
    renderer: app.renderer as unknown as PIXI.Renderer,
    audio,
    platform: {
      gameplayStart:        () => crazyGames.gameplayStart(),
      gameplayStop:         () => crazyGames.gameplayStop(),
      requestInterstitialAd: () => crazyGames.showInterstitialAdThrottled(10 * 60 * 1000),
      requestExtraLife:     () => crazyGames.showRewardedAd(),
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

  // ── 8. Page lifecycle ─────────────────────────────────────────────
  // Notify CrazyGames before the page reloads or navigates away so it
  // doesn't count the session as a crash.
  window.addEventListener('beforeunload', () => crazyGames.sdkGameLoadingStart());

  // ── 9. Auth state listener (optional) ────────────────────────────
  if (crazyGames.isUserAccountAvailable) {
    crazyGames.onAuthChange((user) => {
      console.log('[CrazyGames] Auth state changed:', user?.username ?? 'logged out');
    });
  }
};
