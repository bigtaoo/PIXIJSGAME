import * as PIXI from 'pixi.js-legacy';
import { IAssetsManager } from './IAssetsManager';

// ── digits.png 参数 ───────────────────────────────────────────────────────────
const DIGIT_W   = 120;
const DIGIT_H   = 160;
const DIGIT_GAP = 10;

export class WechatAssetsManager implements IAssetsManager {
  private textures: Record<string, PIXI.Texture> = {};

  private loadImageWX(src: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const img = wx.createImage();
      img.onload  = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private imageToBaseTexture(img: any): PIXI.BaseTexture {
    const resource = new PIXI.CanvasResource(img);
    return new PIXI.BaseTexture(resource);
  }

  public async loadAssets(): Promise<void> {
    // 数字精灵图
    const digitsImg  = await this.loadImageWX('assets/digits.png');
    const digitsBase = this.imageToBaseTexture(digitsImg);
    for (let i = 0; i <= 9; i++) {
      this.textures[`${i}.png`] = new PIXI.Texture(
        digitsBase,
        new PIXI.Rectangle(i * (DIGIT_W + DIGIT_GAP), 0, DIGIT_W, DIGIT_H),
      );
    }

    // 心形图标
    const heartImg = await this.loadImageWX('assets/heart.png');
    this.textures['heart.png'] = new PIXI.Texture(this.imageToBaseTexture(heartImg));

    const heartEmptyImg = await this.loadImageWX('assets/heart_empty.png');
    this.textures['heart_empty.png'] = new PIXI.Texture(this.imageToBaseTexture(heartEmptyImg));

    // 大厅背景图
    const bgImg = await this.loadImageWX('assets/lobby_bg.png');
    this.textures['lobby_bg.png'] = new PIXI.Texture(this.imageToBaseTexture(bgImg));

    // 每日挑战图标
    const dailyImg = await this.loadImageWX('assets/daily_challenge_icon.png');
    this.textures['daily_challenge_icon.png'] = new PIXI.Texture(this.imageToBaseTexture(dailyImg));

    // 图标：星星 / 奖杯 / 火焰
    const [starImg, trophyImg, fireImg] = await Promise.all([
      this.loadImageWX('assets/star.png'),
      this.loadImageWX('assets/trophy.png'),
      this.loadImageWX('assets/fire.png'),
    ]);
    this.textures['star.png']   = new PIXI.Texture(this.imageToBaseTexture(starImg));
    this.textures['trophy.png'] = new PIXI.Texture(this.imageToBaseTexture(trophyImg));
    this.textures['fire.png']   = new PIXI.Texture(this.imageToBaseTexture(fireImg));

    // 爆炸粒子图集（加载失败不影响游戏）
    await this.loadExplosionAtlasWX().catch(() => {/* 忽略 */});
  }

  private async loadExplosionAtlasWX(): Promise<void> {
    const [img, json] = await Promise.all([
      this.loadImageWX('assets/explosion.png'),
      new Promise<any>((resolve, reject) => {
        wx.request({
          url: 'assets/explosion.json',
          success: (res: any) => resolve(typeof res.data === 'string' ? JSON.parse(res.data) : res.data),
          fail: reject,
        });
      }),
    ]);
    const base = this.imageToBaseTexture(img);
    for (const key in json.frames) {
      const f = json.frames[key].frame;
      this.textures[key] = new PIXI.Texture(base, new PIXI.Rectangle(f.x, f.y, f.w, f.h));
    }
  }

  /**
   * 微信小游戏不支持 renderer.generateTexture()，改用 wx.createCanvas() + 2D context
   * 手动绘制每个程序化纹理，再包装成 PIXI.Texture。
   *
   * 尺寸与 WebAssetsManager.generateProgrammaticTextures() 保持一致。
   */
  public generateProgrammaticTextures(_renderer: PIXI.Renderer): void {
    const CELL_BASE      = 120;
    const CLOCK_RADIUS   = 40;
    const CLOCK_HAND_LEN = 26;
    const CLOCK_HAND_W   = 6;
    const SYMBOL_W       = 80;
    const SYMBOL_H_PLUS  = 80;
    const SYMBOL_H_EQ    = 60;
    const BTN_SIZE       = 200;
    const SETTINGS_SIZE  = 80;
    const S_W = 50, S_H = 70;

    this.textures['cell.png'] = this.wxMakeTexture(CELL_BASE, CELL_BASE, ctx =>
      wxDrawCell(ctx, CELL_BASE));

    this.textures['cell_selected.png'] = this.wxMakeTexture(CELL_BASE, CELL_BASE, ctx =>
      wxDrawCellSelected(ctx, CELL_BASE));

    this.textures['clock_face.png'] = this.wxMakeTexture(CLOCK_RADIUS * 2, CLOCK_RADIUS * 2, ctx =>
      wxDrawClockFace(ctx, CLOCK_RADIUS));

    this.textures['clock_hand.png'] = this.wxMakeTexture(CLOCK_HAND_W, CLOCK_HAND_LEN, ctx =>
      wxDrawClockHand(ctx, CLOCK_HAND_LEN, CLOCK_HAND_W));

    this.textures['plus.png'] = this.wxMakeTexture(SYMBOL_W, SYMBOL_H_PLUS, ctx =>
      wxDrawPlus(ctx, SYMBOL_W, SYMBOL_H_PLUS));

    this.textures['equa.png'] = this.wxMakeTexture(SYMBOL_W, SYMBOL_H_EQ, ctx =>
      wxDrawEquals(ctx, SYMBOL_W, SYMBOL_H_EQ));

    this.textures['retry.png'] = this.wxMakeTexture(BTN_SIZE, BTN_SIZE, ctx =>
      wxDrawRetryIcon(ctx, BTN_SIZE));

    this.textures['next.png'] = this.wxMakeTexture(BTN_SIZE, BTN_SIZE, ctx =>
      wxDrawNextIcon(ctx, BTN_SIZE));

    this.textures['lobby.png'] = this.wxMakeTexture(BTN_SIZE, BTN_SIZE, ctx =>
      wxDrawLobbyIcon(ctx, BTN_SIZE));

    this.textures['settings.png'] = this.wxMakeTexture(SETTINGS_SIZE, SETTINGS_SIZE, ctx =>
      wxDrawSettingsIcon(ctx, SETTINGS_SIZE));

    this.textures['s.png'] = this.wxMakeTexture(S_W, S_H, ctx =>
      wxDrawLetterS(ctx, S_W, S_H));
  }

  /**
   * 创建一个临时的离屏 Canvas，执行绘制函数，然后包装为 PIXI.Texture。
   */
  private wxMakeTexture(
    w: number, h: number,
    drawFn: (ctx: Ctx2D) => void,
  ): PIXI.Texture {
    const canvas = wx.createCanvas();
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    drawFn(ctx);
    const resource = new PIXI.CanvasResource(canvas as unknown as HTMLCanvasElement);
    return new PIXI.Texture(new PIXI.BaseTexture(resource));
  }

  public GetTexture(key: string): PIXI.Texture {
    const tex = this.textures[key];
    if (!tex) throw new Error(`Missing texture: "${key}"`);
    return tex;
  }

  public GetSpriteFromNumberAtlas(key: string): PIXI.Sprite {
    return new PIXI.Sprite(this.GetTexture(key));
  }
}

// ── 颜色常量（与 graphicsFactory.ts 的 C 对象保持一致）────────────────────────
const C_CELL_FILL       = '#FAFAF8';
const C_CELL_BORDER     = '#E0DAD0';
const C_SEL_FILL        = '#FBF8EE';
const C_SEL_BORDER      = '#EAB830';
const C_CLOCK_FACE      = '#FAFAF8';
const C_CLOCK_BORDER    = '#5D4037';
const C_CLOCK_HAND      = '#3E2723';
const C_ICON            = '#5D4037';

// ── 工具：Canvas 2D 圆角矩形（兼容不支持 roundRect 的环境）────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx2D = any; // wx canvas 2D context — structurally identical to CanvasRenderingContext2D

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,          r);
  ctx.closePath();
}

// ── 格子 ──────────────────────────────────────────────────────────────────────

function wxDrawCell(ctx: Ctx2D, size: number): void {
  const r = Math.round(size * 0.11);
  roundRect(ctx, 0, 0, size, size, r);
  ctx.fillStyle   = C_CELL_FILL;
  ctx.fill();
  ctx.lineWidth   = 1.5;
  ctx.strokeStyle = C_CELL_BORDER;
  ctx.stroke();
}

function wxDrawCellSelected(ctx: Ctx2D, size: number): void {
  const r   = Math.round(size * 0.11);
  const bw  = Math.max(5, Math.round(size * 0.042));
  const ins = bw * 0.5;
  roundRect(ctx, ins, ins, size - ins * 2, size - ins * 2, r);
  ctx.fillStyle   = C_SEL_FILL;
  ctx.fill();
  ctx.lineWidth   = bw;
  ctx.strokeStyle = C_SEL_BORDER;
  ctx.stroke();
}

// ── 闹钟 ──────────────────────────────────────────────────────────────────────

function wxDrawClockFace(ctx: Ctx2D, radius: number): void {
  const cx = radius;
  const cy = radius;
  const r  = radius - 3;

  // 表盘
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle   = C_CLOCK_FACE;
  ctx.fill();
  ctx.lineWidth   = 3;
  ctx.strokeStyle = C_CLOCK_BORDER;
  ctx.stroke();

  // 中心点
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = C_CLOCK_BORDER;
  ctx.fill();

  // 4个刻度（12 / 3 / 6 / 9 点）
  ctx.lineWidth   = 3;
  ctx.strokeStyle = C_CLOCK_BORDER;
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 4; i++) {
    const a     = (i * Math.PI) / 2 - Math.PI / 2;
    const inner = r - 9;
    const outer = r - 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function wxDrawClockHand(ctx: Ctx2D, length: number, width: number): void {
  const r = width / 2;
  roundRect(ctx, 0, 0, width, length, r);
  ctx.fillStyle = C_CLOCK_HAND;
  ctx.fill();
}

// ── 符号 ──────────────────────────────────────────────────────────────────────

function wxDrawPlus(ctx: Ctx2D, w: number, h: number): void {
  const t = Math.round(Math.min(w, h) * 0.22);
  const r = t / 2;
  ctx.fillStyle = C_ICON;
  // 竖
  roundRect(ctx, (w - t) / 2, 0, t, h, r);
  ctx.fill();
  // 横
  roundRect(ctx, 0, (h - t) / 2, w, t, r);
  ctx.fill();
}

function wxDrawEquals(ctx: Ctx2D, w: number, h: number): void {
  const barH = Math.round(h * 0.22);
  const gap  = Math.round(h * 0.20);
  const total = barH * 2 + gap;
  const y0   = (h - total) / 2;
  const r    = barH / 2;
  ctx.fillStyle = C_ICON;
  roundRect(ctx, 0, y0,              w, barH, r); ctx.fill();
  roundRect(ctx, 0, y0 + barH + gap, w, barH, r); ctx.fill();
}

// ── 按钮图标 ──────────────────────────────────────────────────────────────────

function wxDrawRetryIcon(ctx: Ctx2D, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.33;
  const sw = Math.max(5, Math.round(size * 0.1));

  ctx.lineWidth   = sw;
  ctx.strokeStyle = C_ICON;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI * 0.75, Math.PI * 0.67);
  ctx.stroke();

  // 弧末端三角形箭头
  const endA  = Math.PI * 0.67;
  const ax    = cx + Math.cos(endA) * r;
  const ay    = cy + Math.sin(endA) * r;
  const tA    = endA + Math.PI / 2;
  const ah    = sw * 2.5;
  const hw    = sw * 1.3;
  const backA = tA + Math.PI;
  const perpA = tA + Math.PI / 2;
  const bx = ax + Math.cos(backA) * ah;
  const by = ay + Math.sin(backA) * ah;
  ctx.fillStyle = C_ICON;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx + Math.cos(perpA) * hw, by + Math.sin(perpA) * hw);
  ctx.lineTo(bx - Math.cos(perpA) * hw, by - Math.sin(perpA) * hw);
  ctx.closePath();
  ctx.fill();
}

function wxDrawNextIcon(ctx: Ctx2D, size: number): void {
  const pad = size * 0.22;
  ctx.fillStyle = C_ICON;
  ctx.beginPath();
  ctx.moveTo(pad,          pad);
  ctx.lineTo(size - pad,   size / 2);
  ctx.lineTo(pad,          size - pad);
  ctx.closePath();
  ctx.fill();
}

function wxDrawLobbyIcon(ctx: Ctx2D, size: number): void {
  const pad = size * 0.18;
  const gap = size * 0.1;
  const sq  = (size - pad * 2 - gap) / 2;
  ctx.fillStyle = C_ICON;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      roundRect(
        ctx,
        pad + col * (sq + gap),
        pad + row * (sq + gap),
        sq, sq, 4,
      );
      ctx.fill();
    }
  }
}

function wxDrawSettingsIcon(ctx: Ctx2D, size: number): void {
  const pad  = size * 0.2;
  const barH = Math.round(size * 0.13);
  const barW = size - pad * 2;
  const gap  = (size - pad * 2 - barH * 3) / 2;
  ctx.fillStyle = C_ICON;
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, pad, pad + i * (barH + gap), barW, barH, barH / 2);
    ctx.fill();
  }
}

function wxDrawLetterS(ctx: Ctx2D, w: number, h: number): void {
  const sw = Math.round(Math.min(w, h) * 0.37);
  ctx.lineWidth   = sw;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h * 0.18);
  ctx.bezierCurveTo(w * 0.78, h * 0.01, w * 0.08, h * 0.01, w * 0.08, h * 0.30);
  ctx.bezierCurveTo(w * 0.08, h * 0.48, w * 0.92, h * 0.52, w * 0.92, h * 0.70);
  ctx.bezierCurveTo(w * 0.92, h * 0.99, w * 0.22, h * 0.99, w * 0.22, h * 0.82);
  ctx.stroke();
}
