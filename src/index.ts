import * as PIXI from 'pixi.js-legacy';
import { assetsManager } from './assetsManager';

window.onload = async () => {
  const app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1099bb,
  });

  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  });


  // console.log(app.view);

  document.body.appendChild(app.view as HTMLCanvasElement);

  const container = new PIXI.Container();
  app.stage.addChild(container);

  const texture = PIXI.Texture.from('assets/bunny.png');

  for (let i = 0; i < 25; i++) {
    const bunny = new PIXI.Sprite(texture);
    bunny.x = (i % 5) * 40;
    bunny.y = Math.floor(i / 5) * 40;
    container.addChild(bunny);
  }

  await assetsManager.loadAssets();
  const number1 = assetsManager.GetSpriteFromNumberAtlas("3.png");
  container.addChild(number1);

  container.x = 400;
  container.y = 300;

  container.pivot.set(container.width / 2, container.height / 2);

  app.ticker.add((delta) => {
    container.rotation -= 0.01 * delta;
  });
};