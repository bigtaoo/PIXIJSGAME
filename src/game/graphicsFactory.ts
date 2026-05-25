/**
 * graphicsFactory.ts
 *
 * 所有程序化绘制函数的集中模块。
 * 每个函数接受一个 PIXI.Graphics 并就地绘制，不持有任何状态。
 *
 * makeTexture() 工具函数将绘制结果渲染为 RenderTexture，供需要 Sprite 的场合使用。
 */

import * as PIXI from 'pixi.js-legacy';

// ─── 调色板 ───────────────────────────────────────────────────────────────────

export const C = {
  // 背景
  bgFill:        0xEDE8DC,
  bgLine:        0xCCCCCC,
  bgLineAlpha:   0.12,

  // 格子 · 普通
  cellFill:      0xFAFAF8,
  cellBorder:    0xE0DAD0,

  // 格子 · 选中
  cellSelFill:   0xFBF8EE,
  cellSelBorder: 0xEAB830,

  // 面板（Header / 结果浮层 / 设置浮层）
  panelFill:     0xFAFAF8,
  panelBorder:   0xE0DAD0,

  // 闹钟
  clockFace:     0xFAFAF8,
  clockBorder:   0x5D4037,
  clockHand:     0x3E2723,

  // 图标通用色
  icon:          0x5D4037,
};

// ─── 背景 ─────────────────────────────────────────────────────────────────────

/**
 * 方格纸背景：米黄底色 + 浅灰网格线（20px 间距）。
 * 调用前无需 clear()。
 */
export function drawBackground(g: PIXI.Graphics, w: number, h: number): void {
  g.clear();
  g.beginFill(C.bgFill);
  g.drawRect(0, 0, w, h);
  g.endFill();

  g.lineStyle(1, C.bgLine, C.bgLineAlpha);
  const sp = 20;
  for (let x = sp; x < w; x += sp) { g.moveTo(x, 0); g.lineTo(x, h); }
  for (let y = sp; y < h; y += sp) { g.moveTo(0, y); g.lineTo(w, y); }
}

// ─── 格子 ─────────────────────────────────────────────────────────────────────

/**
 * 普通格子：暖白圆角矩形 + 浅色描边。
 * 绘制区域 (0, 0, size, size)。
 */
export function drawCell(g: PIXI.Graphics, size: number): void {
  const r = Math.round(size * 0.11);
  g.lineStyle(1.5, C.cellBorder, 1);
  g.beginFill(C.cellFill);
  g.drawRoundedRect(0, 0, size, size, r);
  g.endFill();
}

/**
 * 选中格子：金色描边 + 略亮底色。
 * 绘制区域 (0, 0, size, size)，描边内缩以保持外轮廓一致。
 */
export function drawCellSelected(g: PIXI.Graphics, size: number): void {
  const r   = Math.round(size * 0.11);
  const bw  = Math.max(5, Math.round(size * 0.042));
  const ins = bw * 0.5; // 内缩量，保证描边不超出边界
  g.lineStyle(bw, C.cellSelBorder, 1);
  g.beginFill(C.cellSelFill);
  g.drawRoundedRect(ins, ins, size - ins * 2, size - ins * 2, r);
  g.endFill();
}

// ─── 关卡大厅圆形节点 ─────────────────────────────────────────────────────────

/**
 * 普通圆形格子：暖白填充 + 浅色描边，内切于 size×size 正方形。
 */
export function drawCircleCell(g: PIXI.Graphics, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 2;
  g.lineStyle(1.5, C.cellBorder, 1);
  g.beginFill(C.cellFill);
  g.drawCircle(cx, cy, r);
  g.endFill();
}

/**
 * 选中圆形格子：金色描边 + 略亮底色，内切于 size×size 正方形。
 */
export function drawCircleCellSelected(g: PIXI.Graphics, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const bw = Math.max(5, Math.round(size * 0.042));
  const r  = size / 2 - bw / 2;
  g.lineStyle(bw, C.cellSelBorder, 1);
  g.beginFill(C.cellSelFill);
  g.drawCircle(cx, cy, r);
  g.endFill();
}

// ─── 闹钟 ─────────────────────────────────────────────────────────────────────

/**
 * 闹钟表盘：圆形 + 中心点 + 4个刻度。
 * 绘制区域 (0, 0, radius*2, radius*2)。
 */
export function drawClockFace(g: PIXI.Graphics, radius: number): void {
  const cx = radius;
  const cy = radius;
  const r  = radius - 3;

  // 表盘
  g.lineStyle(3, C.clockBorder, 1);
  g.beginFill(C.clockFace);
  g.drawCircle(cx, cy, r);
  g.endFill();

  // 中心点
  g.lineStyle(0);
  g.beginFill(C.clockBorder);
  g.drawCircle(cx, cy, 3);
  g.endFill();

  // 4个刻度（12 / 3 / 6 / 9 点）
  g.lineStyle(3, C.clockBorder, 0.7);
  for (let i = 0; i < 4; i++) {
    const a     = (i * Math.PI) / 2 - Math.PI / 2;
    const inner = r - 9;
    const outer = r - 2;
    g.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    g.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
  }
}

/**
 * 闹钟指针：向下的圆角矩形，从 (0,0) 延伸到 (width, length)。
 *
 * 使用方式（Header 内）：
 *   sprite.pivot.set(width/2, 0)   // 旋转轴在顶部中心（连接表盘圆心处）
 *   sprite.position.set(cx, cy)    // 放置在表盘圆心
 *   sprite.rotation = Math.PI + (1 - ratio) * Math.PI * 2  // 12点钟=满时间
 */
export function drawClockHand(g: PIXI.Graphics, length: number, width = 6): void {
  g.lineStyle(0);
  g.beginFill(C.clockHand);
  g.drawRoundedRect(0, 0, width, length, width / 2);
  g.endFill();
}

// ─── 符号 ─────────────────────────────────────────────────────────────────────

/** 加号，绘制区域 (0, 0, w, h)。 */
export function drawPlus(g: PIXI.Graphics, w: number, h: number): void {
  const t = Math.round(Math.min(w, h) * 0.22);
  g.lineStyle(0);
  g.beginFill(C.icon);
  g.drawRoundedRect((w - t) / 2, 0,       t, h, t / 2); // 竖
  g.drawRoundedRect(0,           (h - t) / 2, w, t, t / 2); // 横
  g.endFill();
}

/** 等号，绘制区域 (0, 0, w, h)。 */
export function drawEquals(g: PIXI.Graphics, w: number, h: number): void {
  const barH = Math.round(h * 0.22);
  const gap  = Math.round(h * 0.20);
  const total = barH * 2 + gap;
  const y0   = (h - total) / 2;
  g.lineStyle(0);
  g.beginFill(C.icon);
  g.drawRoundedRect(0, y0,              w, barH, barH / 2);
  g.drawRoundedRect(0, y0 + barH + gap, w, barH, barH / 2);
  g.endFill();
}

// ─── 按钮图标 ─────────────────────────────────────────────────────────────────

/** 重试图标（圆弧箭头），绘制区域 (0, 0, size, size)。 */
export function drawRetryIcon(g: PIXI.Graphics, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.33;
  const sw = Math.max(5, Math.round(size * 0.1));

  // 圆弧：从约 -135° 顺时针到约 120°
  g.lineStyle(sw, C.icon, 1);
  g.arc(cx, cy, r, -Math.PI * 0.75, Math.PI * 0.67);

  // 弧末端三角形箭头
  const endA = Math.PI * 0.67;
  const ax   = cx + Math.cos(endA) * r;
  const ay   = cy + Math.sin(endA) * r;
  const ah   = sw * 2.2;
  const tA   = endA + Math.PI / 2; // 切线方向
  g.lineStyle(0);
  g.beginFill(C.icon);
  g.drawPolygon([
    ax, ay,
    ax + Math.cos(tA - 2.4) * ah, ay + Math.sin(tA - 2.4) * ah,
    ax + Math.cos(tA + 0.5) * ah, ay + Math.sin(tA + 0.5) * ah,
  ]);
  g.endFill();
}

/** 向右实心三角（下一关），绘制区域 (0, 0, size, size)。 */
export function drawNextIcon(g: PIXI.Graphics, size: number): void {
  const pad = size * 0.22;
  g.lineStyle(0);
  g.beginFill(C.icon);
  g.drawPolygon([
    pad,          pad,
    size - pad,   size / 2,
    pad,          size - pad,
  ]);
  g.endFill();
}

/** 汉堡菜单（设置），绘制区域 (0, 0, size, size)。 */
export function drawSettingsIcon(g: PIXI.Graphics, size: number): void {
  const pad  = size * 0.2;
  const barH = Math.round(size * 0.13);
  const barW = size - pad * 2;
  const gap  = (size - pad * 2 - barH * 3) / 2;
  g.lineStyle(0);
  g.beginFill(C.icon);
  for (let i = 0; i < 3; i++) {
    g.drawRoundedRect(pad, pad + i * (barH + gap), barW, barH, barH / 2);
  }
  g.endFill();
}

/** 2×2 方格（返回大厅），绘制区域 (0, 0, size, size)。 */
export function drawLobbyIcon(g: PIXI.Graphics, size: number): void {
  const pad = size * 0.18;
  const gap = size * 0.1;
  const sq  = (size - pad * 2 - gap) / 2;
  g.lineStyle(0);
  g.beginFill(C.icon);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      g.drawRoundedRect(
        pad + col * (sq + gap),
        pad + row * (sq + gap),
        sq, sq, 4,
      );
    }
  }
  g.endFill();
}

// ─── 面板 ─────────────────────────────────────────────────────────────────────

/**
 * 弹出面板（结果 / 设置浮层）：暖白圆角矩形 + 轻微阴影。
 * 绘制区域 (0, 0, w+4, h+4)（阴影向右下偏移 4px）。
 */
export function drawPanel(g: PIXI.Graphics, w: number, h: number): void {
  const r = 20;
  // 阴影层
  g.lineStyle(0);
  g.beginFill(0x000000, 0.15);
  g.drawRoundedRect(4, 4, w, h, r);
  g.endFill();
  // 主面板
  g.lineStyle(1.5, C.panelBorder, 0.7);
  g.beginFill(C.panelFill);
  g.drawRoundedRect(0, 0, w, h, r);
  g.endFill();
}

/**
 * Header 背景条：暖白圆角矩形，无阴影。
 * 绘制区域 (0, 0, w, h)。
 */
export function drawHeaderBar(g: PIXI.Graphics, w: number, h: number): void {
  g.lineStyle(1, C.panelBorder, 0.6);
  g.beginFill(C.panelFill);
  g.drawRoundedRect(0, 0, w, h, 16);
  g.endFill();
}

// ─── 文字替代符号 ──────────────────────────────────────────────────────────────

/**
 * 问号，用于 tip 槽未填入数值时。
 * 绘制于以 (cx, cy) 为中心、高度约为 h 的区域内。
 * 颜色固定为浅灰 0xBBBBBB，与原文本样式一致。
 */
export function drawQuestionMark(g: PIXI.Graphics, cx: number, cy: number, h: number): void {
  const sw = Math.round(h * 0.13);
  const r  = h * 0.19;

  g.lineStyle(sw, 0xBBBBBB, 1);
  // 上弧：半圆（从左到右）
  g.arc(cx, cy - h * 0.14, r, Math.PI, 0, false);
  // 向下弯折到茎
  g.bezierCurveTo(
    cx + r,  cy - h * 0.14 + r,
    cx,      cy + h * 0.02,
    cx,      cy + h * 0.10,
  );

  // 下方圆点
  g.lineStyle(0);
  g.beginFill(0xBBBBBB);
  g.drawCircle(cx, cy + h * 0.30, sw * 0.75);
  g.endFill();
}

/**
 * 字母 "s"，绘制区域 (0, 0, w, h)。
 * 用白色（0xFFFFFF）描边，调用方通过 sprite.tint 着色为金色或绿色。
 */
export function drawLetterS(g: PIXI.Graphics, w: number, h: number): void {
  const sw = Math.round(Math.min(w, h) * 0.17);
  g.lineStyle(sw, 0xFFFFFF, 1);

  // 上半 C 弧（向左开口）
  g.moveTo(w * 0.78, h * 0.18);
  g.bezierCurveTo(w * 0.78, h * 0.01, w * 0.08, h * 0.01, w * 0.08, h * 0.30);
  g.bezierCurveTo(w * 0.08, h * 0.48, w * 0.92, h * 0.52, w * 0.92, h * 0.70);
  // 下半 C 弧（向右开口）
  g.bezierCurveTo(w * 0.92, h * 0.99, w * 0.22, h * 0.99, w * 0.22, h * 0.82);
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * 将绘制函数渲染为固定尺寸的 RenderTexture，并销毁临时 Graphics。
 *
 * @param renderer  PIXI.Renderer 实例（来自 AppContext）
 * @param drawFn    在 Graphics 上执行绘制的函数
 * @param w         纹理宽度（逻辑像素）
 * @param h         纹理高度（逻辑像素，默认等于 w）
 */
export function makeTexture(
  renderer: PIXI.Renderer,
  drawFn: (g: PIXI.Graphics) => void,
  w: number,
  h: number = w,
): PIXI.RenderTexture {
  const g = new PIXI.Graphics();
  drawFn(g);
  const tex = renderer.generateTexture(g, { region: new PIXI.Rectangle(0, 0, w, h) });
  g.destroy();
  return tex;
}
