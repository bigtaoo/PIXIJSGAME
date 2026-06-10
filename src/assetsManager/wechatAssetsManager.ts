import * as PIXI from 'pixi.js-legacy';
import { IAssetsManager } from './IAssetsManager';

// ── digits.png parameters ─────────────────────────────────────────────────────
const DIGIT_W = 100;
const DIGIT_H = 160;
const DIGIT_GAP = 0;

export class WechatAssetsManager implements IAssetsManager {
  private textures: Record<string, PIXI.Texture> = {};

  private loadImageWX(src: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const img = wx.createImage();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private imageToBaseTexture(img: any): PIXI.BaseTexture {
    const resource = new PIXI.CanvasResource(img);
    return new PIXI.BaseTexture(resource);
  }

  public async loadAssets(): Promise<void> {
    // Digit sprite sheet
    const digitsImg = await this.loadImageWX('assets/digits.png');
    const digitsBase = this.imageToBaseTexture(digitsImg);
    for (let i = 0; i <= 9; i++) {
      this.textures[`${i}.png`] = new PIXI.Texture(
        digitsBase,
        new PIXI.Rectangle(i * (DIGIT_W + DIGIT_GAP), 0, DIGIT_W, DIGIT_H)
      );
    }

    // Heart icon
    const heartImg = await this.loadImageWX('assets/heart.png');
    this.textures['heart.png'] = new PIXI.Texture(this.imageToBaseTexture(heartImg));

    const heartEmptyImg = await this.loadImageWX('assets/heart_empty.png');
    this.textures['heart_empty.png'] = new PIXI.Texture(this.imageToBaseTexture(heartEmptyImg));

    // Lobby background image
    const bgImg = await this.loadImageWX('assets/lobby_bg.png');
    this.textures['lobby_bg.png'] = new PIXI.Texture(this.imageToBaseTexture(bgImg));

    // Daily challenge icon
    const dailyImg = await this.loadImageWX('assets/daily_challenge_icon.png');
    this.textures['daily_challenge_icon.png'] = new PIXI.Texture(this.imageToBaseTexture(dailyImg));

    // Icons: star / trophy / fire / music
    const [starImg, trophyImg, fireImg, musicImg] = await Promise.all([
      this.loadImageWX('assets/star.png'),
      this.loadImageWX('assets/trophy.png'),
      this.loadImageWX('assets/fire.png'),
      this.loadImageWX('assets/music.png'),
    ]);
    this.textures['star.png'] = new PIXI.Texture(this.imageToBaseTexture(starImg));
    this.textures['trophy.png'] = new PIXI.Texture(this.imageToBaseTexture(trophyImg));
    this.textures['fire.png'] = new PIXI.Texture(this.imageToBaseTexture(fireImg));
    this.textures['music.png'] = new PIXI.Texture(this.imageToBaseTexture(musicImg));

    // Explosion particle atlas (load failure does not affect the game)
    await this.loadExplosionAtlasWX().catch(() => {
      /* ignore */
    });
  }

  private async loadExplosionAtlasWX(): Promise<void> {
    const [img, json] = await Promise.all([
      this.loadImageWX('assets/explosion.png'),
      new Promise<any>((resolve, reject) => {
        wx.request({
          url: 'assets/explosion.json',
          success: (res: any) =>
            resolve(typeof res.data === 'string' ? JSON.parse(res.data) : res.data),
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
   * WeChat mini-games do not support renderer.generateTexture(); instead use
   * wx.createCanvas() + a 2D context to manually draw each programmatic texture
   * and then wrap it as a PIXI.Texture.
   *
   * Sizes match those used in WebAssetsManager.generateProgrammaticTextures().
   */
  public generateProgrammaticTextures(_renderer: PIXI.Renderer): void {
    const CELL_BASE = 120;
    const CLOCK_RADIUS = 40;
    const CLOCK_HAND_LEN = 26;
    const CLOCK_HAND_W = 6;
    const SYMBOL_W = 80;
    const SYMBOL_H_PLUS = 80;
    const SYMBOL_H_EQ = 60;
    const BTN_SIZE = 200;
    const SETTINGS_SIZE = 80;
    const S_W = 50,
      S_H = 70;

    this.textures['cell.png'] = this.wxMakeTexture(CELL_BASE, CELL_BASE, (ctx) =>
      wxDrawCell(ctx, CELL_BASE)
    );

    this.textures['cell_selected.png'] = this.wxMakeTexture(CELL_BASE, CELL_BASE, (ctx) =>
      wxDrawCellSelected(ctx, CELL_BASE)
    );

    this.textures['clock_face.png'] = this.wxMakeTexture(
      CLOCK_RADIUS * 2,
      CLOCK_RADIUS * 2,
      (ctx) => wxDrawClockFace(ctx, CLOCK_RADIUS)
    );

    this.textures['clock_hand.png'] = this.wxMakeTexture(CLOCK_HAND_W, CLOCK_HAND_LEN, (ctx) =>
      wxDrawClockHand(ctx, CLOCK_HAND_LEN, CLOCK_HAND_W)
    );

    this.textures['plus.png'] = this.wxMakeTexture(SYMBOL_W, SYMBOL_H_PLUS, (ctx) =>
      wxDrawPlus(ctx, SYMBOL_W, SYMBOL_H_PLUS)
    );

    this.textures['equa.png'] = this.wxMakeTexture(SYMBOL_W, SYMBOL_H_EQ, (ctx) =>
      wxDrawEquals(ctx, SYMBOL_W, SYMBOL_H_EQ)
    );

    this.textures['retry.png'] = this.wxMakeTexture(BTN_SIZE, BTN_SIZE, (ctx) =>
      wxDrawRetryIcon(ctx, BTN_SIZE)
    );

    this.textures['next.png'] = this.wxMakeTexture(BTN_SIZE, BTN_SIZE, (ctx) =>
      wxDrawNextIcon(ctx, BTN_SIZE)
    );

    this.textures['lobby.png'] = this.wxMakeTexture(BTN_SIZE, BTN_SIZE, (ctx) =>
      wxDrawLobbyIcon(ctx, BTN_SIZE)
    );

    this.textures['settings.png'] = this.wxMakeTexture(SETTINGS_SIZE, SETTINGS_SIZE, (ctx) =>
      wxDrawSettingsIcon(ctx, SETTINGS_SIZE)
    );

    this.textures['s.png'] = this.wxMakeTexture(S_W, S_H, (ctx) => wxDrawLetterS(ctx, S_W, S_H));
  }

  /**
   * Create a temporary off-screen Canvas, execute the draw function, then wrap it as a PIXI.Texture.
   */
  private wxMakeTexture(w: number, h: number, drawFn: (ctx: Ctx2D) => void): PIXI.Texture {
    const canvas = wx.createCanvas();
    canvas.width = w;
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

// ── Color constants (must stay in sync with the C object in graphicsFactory.ts) ─
const C_CELL_FILL = '#FAFAF8';
const C_CELL_BORDER = '#E0DAD0';
const C_SEL_FILL = '#FBF8EE';
const C_SEL_BORDER = '#EAB830';
const C_CLOCK_FACE = '#FAFAF8';
const C_CLOCK_BORDER = '#5D4037';
const C_CLOCK_HAND = '#3E2723';
const C_ICON = '#5D4037';

// ── Utility: Canvas 2D rounded rectangle (compatible with environments that lack roundRect) ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx2D = any; // wx canvas 2D context — structurally identical to CanvasRenderingContext2D

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Cell ──────────────────────────────────────────────────────────────────────

function wxDrawCell(ctx: Ctx2D, size: number): void {
  const r = Math.round(size * 0.11);
  roundRect(ctx, 0, 0, size, size, r);
  ctx.fillStyle = C_CELL_FILL;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = C_CELL_BORDER;
  ctx.stroke();
}

function wxDrawCellSelected(ctx: Ctx2D, size: number): void {
  const r = Math.round(size * 0.11);
  const bw = Math.max(5, Math.round(size * 0.042));
  const ins = bw * 0.5;
  roundRect(ctx, ins, ins, size - ins * 2, size - ins * 2, r);
  ctx.fillStyle = C_SEL_FILL;
  ctx.fill();
  ctx.lineWidth = bw;
  ctx.strokeStyle = C_SEL_BORDER;
  ctx.stroke();
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function wxDrawClockFace(ctx: Ctx2D, radius: number): void {
  const cx = radius;
  const cy = radius;
  const r = radius - 3;

  // Clock face
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = C_CLOCK_FACE;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C_CLOCK_BORDER;
  ctx.stroke();

  // Centre dot
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = C_CLOCK_BORDER;
  ctx.fill();

  // 4 tick marks (12 / 3 / 6 / 9 o'clock positions)
  ctx.lineWidth = 3;
  ctx.strokeStyle = C_CLOCK_BORDER;
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 - Math.PI / 2;
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

// ── Symbols ───────────────────────────────────────────────────────────────────

function wxDrawPlus(ctx: Ctx2D, w: number, h: number): void {
  const t = Math.round(Math.min(w, h) * 0.22);
  const r = t / 2;
  ctx.fillStyle = C_ICON;
  // Vertical bar
  roundRect(ctx, (w - t) / 2, 0, t, h, r);
  ctx.fill();
  // Horizontal bar
  roundRect(ctx, 0, (h - t) / 2, w, t, r);
  ctx.fill();
}

function wxDrawEquals(ctx: Ctx2D, w: number, h: number): void {
  const barH = Math.round(h * 0.22);
  const gap = Math.round(h * 0.2);
  const total = barH * 2 + gap;
  const y0 = (h - total) / 2;
  const r = barH / 2;
  ctx.fillStyle = C_ICON;
  roundRect(ctx, 0, y0, w, barH, r);
  ctx.fill();
  roundRect(ctx, 0, y0 + barH + gap, w, barH, r);
  ctx.fill();
}

// ── Button icons ──────────────────────────────────────────────────────────────

function wxDrawRetryIcon(ctx: Ctx2D, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.33;
  const sw = Math.max(5, Math.round(size * 0.1));

  ctx.lineWidth = sw;
  ctx.strokeStyle = C_ICON;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI * 0.75, Math.PI * 0.67);
  ctx.stroke();

  // Triangular arrowhead at the arc end
  const endA = Math.PI * 0.67;
  const ax = cx + Math.cos(endA) * r;
  const ay = cy + Math.sin(endA) * r;
  const tA = endA + Math.PI / 2;
  const ah = sw * 2.5;
  const hw = sw * 1.3;
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
  ctx.moveTo(pad, pad);
  ctx.lineTo(size - pad, size / 2);
  ctx.lineTo(pad, size - pad);
  ctx.closePath();
  ctx.fill();
}

function wxDrawLobbyIcon(ctx: Ctx2D, size: number): void {
  const pad = size * 0.18;
  const gap = size * 0.1;
  const sq = (size - pad * 2 - gap) / 2;
  ctx.fillStyle = C_ICON;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      roundRect(ctx, pad + col * (sq + gap), pad + row * (sq + gap), sq, sq, 4);
      ctx.fill();
    }
  }
}

function wxDrawSettingsIcon(ctx: Ctx2D, size: number): void {
  const pad = size * 0.2;
  const barH = Math.round(size * 0.13);
  const barW = size - pad * 2;
  const gap = (size - pad * 2 - barH * 3) / 2;
  ctx.fillStyle = C_ICON;
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, pad, pad + i * (barH + gap), barW, barH, barH / 2);
    ctx.fill();
  }
}

function wxDrawLetterS(ctx: Ctx2D, w: number, h: number): void {
  const sw = Math.round(Math.min(w, h) * 0.37);
  ctx.lineWidth = sw;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h * 0.18);
  ctx.bezierCurveTo(w * 0.78, h * 0.01, w * 0.08, h * 0.01, w * 0.08, h * 0.3);
  ctx.bezierCurveTo(w * 0.08, h * 0.48, w * 0.92, h * 0.52, w * 0.92, h * 0.7);
  ctx.bezierCurveTo(w * 0.92, h * 0.99, w * 0.22, h * 0.99, w * 0.22, h * 0.82);
  ctx.stroke();
}
