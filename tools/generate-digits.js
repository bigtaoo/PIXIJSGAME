/**
 * generate-digits.js
 * 生成数字 0-9 精灵图（横向排列，透明背景）
 *
 * 用法：
 *   1. npm install canvas
 *   2. 将 NotoSans-Bold.ttf 放在本文件同目录（可选，缺失时自动回退到系统字体）
 *      下载地址：https://fonts.google.com/noto/specimen/Noto+Sans
 *   3. node generate-digits.js
 *   4. 输出文件：digits.png（默认与脚本同目录）
 */

const { createCanvas, registerFont } = require('canvas');
const fs   = require('fs');
const path = require('path');

// ─── 配置区（按需修改）────────────────────────────────────────────────────────

const CONFIG = {
  digitWidth:  120,          // 每个数字格子的宽度（px）
  digitHeight: 160,          // 每个数字格子的高度（px）
  spacing:      10,          // 数字之间的间距（px）

  fillColor:   '#FFFFFF',    // 数字填充色
  strokeColor: '#3E2723',    // 描边颜色（深棕）
  strokeRatio:  0.09,        // 描边宽度 / 字号比例（9%，约 10–12px）

  fontSizeInit: 130,         // 字号搜索起点，脚本会自动向下微调到合适值
  fontFamily:  'NotoSans',   // registerFont 时指定的 family 名
  fontFile:    'NotoSans-Bold.ttf',  // 字体文件名（与脚本同目录）
  fallbackFont:'Arial',      // 找不到字体文件时的备用字体

  outputFile:  'digits.png', // 输出文件名（与脚本同目录）
};

// ─── 初始化 ───────────────────────────────────────────────────────────────────

const DIGITS      = '0123456789';
const TOTAL_WIDTH = CONFIG.digitWidth * 10 + CONFIG.spacing * 9;
const TOTAL_HEIGHT = CONFIG.digitHeight;

// 注册字体
const fontPath = path.join(__dirname, CONFIG.fontFile);
let activeFont = CONFIG.fallbackFont;

if (fs.existsSync(fontPath)) {
  registerFont(fontPath, { family: CONFIG.fontFamily, weight: 'bold' });
  activeFont = CONFIG.fontFamily;
  console.log(`✓ 字体已加载：${CONFIG.fontFile}`);
} else {
  console.warn(`⚠ 未找到 ${CONFIG.fontFile}，使用系统字体 "${CONFIG.fallbackFont}" 代替`);
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * 从 fontSizeInit 向下搜索，找到能在 (maxW × maxH) 内
 * 以 80% 宽度、85% 高度舒适容纳文字的最大字号。
 */
function findFontSize(ctx, text, maxW, maxH) {
  for (let size = CONFIG.fontSizeInit; size >= 40; size -= 1) {
    ctx.font = `bold ${size}px "${activeFont}"`;
    const m = ctx.measureText(text);
    const w = m.width;
    const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    if (w <= maxW * 0.80 && h <= maxH * 0.85) return size;
  }
  return 40; // 兜底
}

// ─── 绘制 ─────────────────────────────────────────────────────────────────────

const canvas = createCanvas(TOTAL_WIDTH, TOTAL_HEIGHT);
const ctx    = canvas.getContext('2d');

// 透明背景
ctx.clearRect(0, 0, TOTAL_WIDTH, TOTAL_HEIGHT);

DIGITS.split('').forEach((digit, index) => {
  const cellX = index * (CONFIG.digitWidth + CONFIG.spacing);
  const cellCX = cellX + CONFIG.digitWidth  / 2;
  const cellCY =         CONFIG.digitHeight / 2;

  // 确定字号与描边宽度
  const fontSize    = findFontSize(ctx, digit, CONFIG.digitWidth, CONFIG.digitHeight);
  const strokeWidth = Math.round(fontSize * CONFIG.strokeRatio);

  ctx.font      = `bold ${fontSize}px "${activeFont}"`;
  ctx.lineJoin  = 'round';
  ctx.lineWidth = strokeWidth;

  // 计算视觉居中位置
  const m       = ctx.measureText(digit);
  const textW   = m.width;
  const ascent  = m.actualBoundingBoxAscent;
  const descent = m.actualBoundingBoxDescent;
  const textH   = ascent + descent;

  const drawX = cellCX - textW  / 2;
  const drawY = cellCY + ascent - textH / 2;

  // 先画描边（在填色下方，避免描边压住填色边缘）
  ctx.strokeStyle = CONFIG.strokeColor;
  ctx.strokeText(digit, drawX, drawY);

  // 再画填色
  ctx.fillStyle = CONFIG.fillColor;
  ctx.fillText(digit, drawX, drawY);
});

// ─── 输出 ─────────────────────────────────────────────────────────────────────

const outputPath = path.join(__dirname, CONFIG.outputFile);
fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));

console.log(`✓ 精灵图已生成：${outputPath}`);
console.log(`  尺寸：${TOTAL_WIDTH} × ${TOTAL_HEIGHT} px`);
console.log(`  格子：${CONFIG.digitWidth} × ${CONFIG.digitHeight} px，间距 ${CONFIG.spacing} px`);
