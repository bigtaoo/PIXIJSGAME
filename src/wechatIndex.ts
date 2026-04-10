// const canvas = wx.createCanvas();

// // Force GameGlobal.canvas early
// const globalObj: any = typeof GameGlobal !== 'undefined' ? GameGlobal : window;
// globalObj.canvas = canvas;



// import 'wechat-adapter';
import * as PIXI from 'pixi.js-legacy';

// 1️⃣ System info
const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
const width = info.screenWidth;
const height = info.screenHeight;

const canvas = wx.createCanvas();
const globalObj: any = typeof GameGlobal !== 'undefined' ? GameGlobal : null;
console.log('global obj: ', globalObj);
if (globalObj) {
    globalObj.canvas = canvas;
}

// 2️⃣ Create canvas
// const canvas = wx.createCanvas();

// 3️⃣ Make a "safe" GameGlobal object for Pixi
// const fakeGlobal: any = { canvas };

// 4️⃣ Initialize Pixi using our canvas
const app = new PIXI.Application({
    view: canvas,
    width,
    height,
    backgroundColor: 0x1099bb,
    forceCanvas: true, // 🔥 required for devtools
});

const container = new PIXI.Container();

app.stage.addChild(container);

const image = wx.createImage();
image.src = 'assets/bunny.png';

image.onload = () => {
    // console.log('Image on load: ', image);
    const baseTexture = new PIXI.BaseTexture(
        new PIXI.ImageResource(image)
    );
    const texture = PIXI.Texture.from(baseTexture);
    // const sprite = new PIXI.Sprite(texture);
    // app.stage.addChild(sprite);

// const texture = PIXI.Texture.from('assets/bunny.png');


    for (let i = 0; i < 25; i++) {
        const bunny = new PIXI.Sprite(texture);

        bunny.x = (i % 5) * 40;
        bunny.y = Math.floor(i / 5) * 40;
        container.addChild(bunny);
    }
  };

  // Move the container to the center
  container.x = app.screen.width / 2;
  container.y = app.screen.height / 2;

  // Center the bunny sprites in local container coordinates
  container.pivot.x = container.width / 2;
  container.pivot.y = container.height / 2;

// // 5️⃣ Add graphics
// const g = new PIXI.Graphics();
// g.beginFill(0xff0000);
// g.drawRect(100, 100, 200, 200);
// g.endFill();
// app.stage.addChild(g);

// // 6️⃣ Animate
// app.ticker.add(() => {
//     g.rotation += 0.01;
// });

console.log('Pixi running with fake GameGlobal');
