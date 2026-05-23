import * as PIXI from 'pixi.js-legacy';
import { WebAssetsManager } from './assetsManager/webAssetsManager';
import { InputManager } from './inputSystem/inputManager';
import { setupWebInput } from './inputSystem/webAdapter';
import { AppContext } from './game/appContext';
import { SceneCoordinator } from './game/sceneCoordinator';
import { setPlayerPrefsImpl } from './playerPrefs/playerPrefs';
import { WebPlayerPrefs } from './playerPrefs/webPlayerPrefs';

window.onload = async () => {
  const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1099bb,
  });

  const canvas = app.view as HTMLCanvasElement;
  document.body.appendChild(canvas);

  // 最先初始化存储，其他系统可能在启动时读取存档
  setPlayerPrefsImpl(new WebPlayerPrefs());

  const assets = new WebAssetsManager();
  await assets.loadAssets();

  const input = new InputManager();
  setupWebInput(canvas, input);

  const ctx: AppContext = { assets, input };

  const coordinator = new SceneCoordinator(ctx);
  app.stage.addChild(coordinator);

  coordinator.resize(window.innerWidth, window.innerHeight);

  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    coordinator.resize(window.innerWidth, window.innerHeight);
  });

  app.ticker.add(() => {
    coordinator.update(app.ticker.elapsedMS);
  });
};
