import * as PIXI from 'pixi.js-legacy';

window.onload = () => {
  const app = new PIXI.Application({
    width: 800,
    height: 600,
    backgroundColor: 0x1099bb,
  });

  console.log(app.view);

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

  container.x = 400;
  container.y = 300;

  container.pivot.set(container.width / 2, container.height / 2);

  app.ticker.add((delta) => {
    container.rotation -= 0.01 * delta;
  });
};
