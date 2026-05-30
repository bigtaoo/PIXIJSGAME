import * as PIXI from 'pixi.js-legacy';
import { WebAssetsManager } from './assetsManager/webAssetsManager';
import { InputManager } from './inputSystem/inputManager';
import { setupWebInput } from './inputSystem/webAdapter';
import { AppContext } from './game/appContext';
import { SceneCoordinator } from './game/sceneCoordinator';
import { setPlayerPrefsImpl } from './playerPrefs/playerPrefs';
import { WebPlayerPrefs } from './playerPrefs/webPlayerPrefs';
import { AudioManager } from './game/audioManager';

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
  await assets.loadAssets();

  // Generate programmatic textures after renderer is ready
  assets.generateProgrammaticTextures(app.renderer as unknown as PIXI.Renderer);

  const input = new InputManager();
  setupWebInput(canvas, input);

  const audio = new AudioManager(prefs);

  const ctx: AppContext = { assets, input, renderer: app.renderer as unknown as PIXI.Renderer, audio };

  const coordinator = new SceneCoordinator(ctx);
  app.stage.addChild(coordinator);

  // ── Resize helper ──────────────────────────────────────────────────
  // In debug mode the orientation may be force-swapped via localStorage;
  // read it once at startup so the entire session uses consistent dimensions.
  const DEBUG_KEY = 'debugOrientationSwapped';
  const orientationSwapped =
    process.env.NODE_ENV !== 'production' &&
    localStorage.getItem(DEBUG_KEY) === '1';

  const getSize = (): [number, number] =>
    orientationSwapped
      ? [window.innerHeight, window.innerWidth]
      : [window.innerWidth,  window.innerHeight];

  const doResize = (): void => {
    const [w, h] = getSize();
    app.renderer.resize(w, h);
    coordinator.resize(w, h);
  };

  doResize();
  window.addEventListener('resize', doResize);

  // Start background music on first user gesture (browser autoplay policy).
  const startMusicOnce = (): void => {
    audio.playBgMusic();
    canvas.removeEventListener('pointerdown', startMusicOnce);
  };
  canvas.addEventListener('pointerdown', startMusicOnce);

  // ── Debug: orientation-toggle button (development build only) ───────
  // Clicking toggles the stored preference and reloads — the freshly
  // initialised game then picks up the correct dimensions from scratch.
  if (process.env.NODE_ENV !== 'production') {
    const isSwapped = localStorage.getItem(DEBUG_KEY) === '1';
    const btn = document.createElement('button');
    btn.textContent = isSwapped ? 'Portrait →Landscape' : 'Landscape →Portrait';
    btn.title = 'Debug: reload after toggling landscape/portrait';
    btn.style.cssText = [
      'position:fixed', 'top:10px', 'right:10px', 'z-index:9999',
      'padding:6px 12px', 'font-size:13px', 'cursor:pointer',
      'background:rgba(0,0,0,0.55)', 'color:#fff',
      'border:1px solid rgba(255,255,255,0.6)', 'border-radius:6px',
      'font-family:sans-serif', 'user-select:none',
    ].join(';');
    btn.addEventListener('click', () => {
      localStorage.setItem(DEBUG_KEY, isSwapped ? '0' : '1');
      location.reload();
    });
    document.body.appendChild(btn);
  }

  app.ticker.add(() => {
    coordinator.update(app.ticker.elapsedMS);
  });
};
