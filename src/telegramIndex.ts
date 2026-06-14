/**
 * Telegram Mini App platform entry point.
 *
 * Bundled by webpack when TARGET=telegram. The game is the same web build,
 * wrapped by Telegram's WebApp SDK (loaded in public/telegram.html).
 * This file is the ONLY place that references window.Telegram.WebApp, so
 * nothing Telegram-specific leaks into the web/wechat/crazygames builds.
 *
 * No platform ad hooks are wired: Telegram has no native rewarded/interstitial
 * ads, so AppContext.platform is left absent (same as the plain web build).
 * Third-party ad networks (e.g. Adsgram) can be added later behind a platform
 * callbacks object if monetization is desired.
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
import { WebPlayerPrefs } from './playerPrefs/webPlayerPrefs';
import { MobileAudioManager } from './game/mobileAudioManager';

/** Minimal typing for the subset of the Telegram WebApp API we use. */
interface TelegramWebApp {
  ready(): void;
  expand(): void;
  requestFullscreen?(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(event: string, cb: () => void): void;
  viewportStableHeight?: number;
}

function getTelegram(): TelegramWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

window.onload = async () => {
  // ── Telegram bootstrap (before anything renders) ──────────────────
  const tg = getTelegram();
  if (tg) {
    tg.ready();
    tg.expand(); // fill Telegram's viewport (header stays visible)
    // requestFullscreen would hide Telegram's header but pushes content under
    // the status bar / controls — enable only after adding safe-area handling.
    // tg.requestFullscreen?.();
    tg.disableVerticalSwipes?.(); // stop swipe-to-close from stealing taps
    tg.setHeaderColor?.('#000000');
    tg.setBackgroundColor?.('#000000');
  }

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

  const audio = new MobileAudioManager(prefs);

  const ctx: AppContext = {
    assets,
    input,
    renderer: app.renderer as unknown as PIXI.Renderer,
    audio,
  };

  const coordinator = new SceneCoordinator(ctx);
  app.stage.addChild(coordinator);

  // ── Resize ────────────────────────────────────────────────────────
  // Prefer Telegram's stable viewport height (excludes the collapsible
  // toolbar) so the layout doesn't jump when the toolbar shows/hides.
  const doResize = (): void => {
    const w = window.innerWidth;
    const h = tg?.viewportStableHeight ?? window.innerHeight;
    app.renderer.resize(w, h);
    coordinator.resize(w, h);
  };

  doResize();
  window.addEventListener('resize', doResize);
  window.addEventListener('orientationchange', () => setTimeout(doResize, 150));
  tg?.onEvent?.('viewportChanged', doResize);

  // Start background music on first user gesture (autoplay policy).
  const startMusicOnce = (): void => {
    audio.playBgMusic();
    canvas.removeEventListener('pointerdown', startMusicOnce);
  };
  canvas.addEventListener('pointerdown', startMusicOnce);

  app.ticker.add(() => {
    coordinator.update(app.ticker.elapsedMS);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) coordinator.pauseIfPlaying();
  });
};
