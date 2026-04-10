// import 'wechat-adapter';

const info = wx.getWindowInfo
    ? wx.getWindowInfo()
    : wx.getSystemInfoSync();

const canvas = wx.createCanvas();

// 🔥 REQUIRED for WeChat rendering
const globalObj: any = typeof GameGlobal !== 'undefined' ? GameGlobal : null;
console.log('global obj: ', globalObj);
if (globalObj) {
    globalObj.canvas = canvas;
}

canvas.width = info.screenWidth;
canvas.height = info.screenHeight;

const ctx = canvas.getContext('2d');

// draw background
ctx.fillStyle = '#87CEEB';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// draw rect
ctx.fillStyle = 'red';
ctx.fillRect(50, 50, 200, 100);

console.log('draw done');
