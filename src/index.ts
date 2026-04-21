import * as PIXI from 'pixi.js-legacy';
import { WebAssetsManager } from './assetsManager/webAssetsManager';
import { setAssetsManager } from './assetsManager/assetsManager';
import { GameScene } from './game/gameScene';

window.onload = async () => {
  const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1099bb,
  });

  document.body.appendChild(app.view as HTMLCanvasElement);

  const webAssetsManager = new WebAssetsManager();
  await webAssetsManager.loadAssets();
  setAssetsManager(webAssetsManager);

  const container = new GameScene();
  app.stage.addChild(container);

  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    container.Resize(window.innerWidth, window.innerHeight);
  });
  
  container.Resize(window.innerWidth, window.innerHeight);
  container.Draw();
  // container.pivot.set(container.width / 2, container.height / 2);

  // app.ticker.add((delta) => {
  //   container.rotation -= 0.01 * delta;
  // });
};