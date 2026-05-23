import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { UIElement } from '../inputSystem/uiElement';
import { Orientation } from './enums';
import { drawHeaderBar } from './graphicsFactory';

/** 时间警告阈值（秒）：低于此值时闹钟容器变红。 */
const WARN_THRESHOLD = 10;

/** 计算指针角度的参考时长（秒）：超过此值时指针停在 12 点。 */
const CLOCK_REF_SECS = 30;

export class Header extends PIXI.Container {
  // ── 时间显示 ──────────────────────────────────────────────────────
  private timeSprites: PIXI.Sprite[]  = [];
  private lastDisplayedSeconds        = -1;

  // ── 提示公式 ──────────────────────────────────────────────────────
  private tipSprites: PIXI.Sprite[]   = [];

  // ── 命数心形 ──────────────────────────────────────────────────────
  private livesSprites: PIXI.Sprite[] = [];

  // ── 闹钟 ──────────────────────────────────────────────────────────
  /** 闹钟整体容器（表盘 + 指针），弹跳 / 变色在此容器上操作。 */
  private clockContainer!: PIXI.Container;
  private clockFaceSprite!: PIXI.Sprite;
  private clockHandSprite!: PIXI.Sprite;

  /** 弹跳动画进度，-1 = 空闲。 */
  private bounceElapsed                  = -1;
  private static readonly BOUNCE_DURATION = 200; // ms

  private _target: number;

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig,
    initialTarget: number,
    onSettings: () => void,
  ) {
    super();
    this._target = initialTarget;
    this.buildBackground();
    this.buildTip();
    this.buildTime();
    this.buildLives();
    this.buildSettingsButton(onSettings);
  }

  // ── Public API ────────────────────────────────────────────────────

  /** 目标数变化时调用：销毁旧提示精灵，重建新的。 */
  public updateTarget(target: number): void {
    this._target = target;
    for (const s of this.tipSprites) { this.removeChild(s); s.destroy(); }
    this.tipSprites = [];
    this.buildTip();
  }

  /** 每帧由 GameScene 调用，驱动弹跳动画。 */
  public update(deltaMs: number): void {
    this.updateBounce(deltaMs);
  }

  /** 更新时间显示 + 闹钟指针 + 预警变色。秒数未变时为空操作。 */
  public updateTime(seconds: number): void {
    if (seconds === this.lastDisplayedSeconds) return;
    this.lastDisplayedSeconds = seconds;

    // 数字显示（右对齐，最多 3 位）
    const s = Math.max(0, seconds).toString();
    for (const d of this.timeSprites) d.visible = false;
    for (let i = 0; i < s.length && i < this.timeSprites.length; i++) {
      const sprite   = this.timeSprites[this.timeSprites.length - 1 - i];
      sprite.texture = this.ctx.assets.GetTexture(`${s[s.length - 1 - i]}.png`);
      sprite.visible = true;
    }

    // 指针旋转：ratio=1 → 12点（满时间），sweeps clockwise as time decreases
    const ratio = Math.min(Math.max(seconds, 0) / CLOCK_REF_SECS, 1);
    this.clockHandSprite.rotation = Math.PI + (1 - ratio) * Math.PI * 2;

    // 时间预警变色
    const warnColor = (seconds > 0 && seconds < WARN_THRESHOLD) ? 0xFF5252 : 0xFFFFFF;
    this.clockFaceSprite.tint  = warnColor;
    this.clockHandSprite.tint  = warnColor;
  }

  /** 更新命数显示：满心 / 空心贴图切换。 */
  public updateLives(lives: number): void {
    for (let i = 0; i < this.livesSprites.length; i++) {
      this.livesSprites[i].texture = i < lives
        ? this.ctx.assets.GetTexture('heart.png')
        : this.ctx.assets.GetTexture('heart_empty.png');
    }
  }

  /** 加时到达时触发弹跳动画。 */
  public triggerClockBounce(): void {
    this.bounceElapsed = 0;
  }

  /**
   * 返回闹钟圆心在 Header 父容器（GameScene 本地坐标）中的位置，
   * 供飞行加时动画定位终点。
   */
  public getClockCenter(): { x: number; y: number } {
    const CLOCK_RADIUS = 40; // 表盘 80px / 2
    return {
      x: this.x + this.clockContainer.x + CLOCK_RADIUS,
      y: this.y + this.clockContainer.y + CLOCK_RADIUS,
    };
  }

  // ── 私有构建方法 ──────────────────────────────────────────────────

  private buildBackground(): void {
    const bg = new PIXI.Graphics();
    const h  = 250;

    if (this.screen.orientation === Orientation.Landscape) {
      this.x = 350;
      this.y = 10;
      drawHeaderBar(bg, 1350, h);
    } else {
      const pad = 30;
      this.x = pad;
      this.y = 10;
      drawHeaderBar(bg, this.screen.width - pad * 2, h);
    }
    this.addChild(bg);
  }

  /**
   * 提示区：展示当前 Target 的一组示例配对，如 "3 + 7 = 10"。
   * 每次 updateTarget() 调用时销毁旧精灵并重建。
   */
  private buildTip(): void {
    const w = 80, h = 100, y = 85;

    const maxFirst = Math.min(9, this._target - 1);
    const minFirst = Math.max(1, this._target - 9);
    const first    = minFirst + Math.floor(Math.random() * (maxFirst - minFirst + 1));
    const second   = this._target - first;

    const items: [string, number][] = [
      [`${first}.png`,  50],
      ['plus.png',     140],
      [`${second}.png`, 225],
      ['equa.png',     315],
    ];
    this._target.toString().split('').forEach((ch, i) => {
      items.push([`${ch}.png`, 405 + i * 85]);
    });

    for (const [key, x] of items) {
      const s  = new PIXI.Sprite(this.ctx.assets.GetTexture(key));
      s.width  = w; s.height = h;
      s.x      = x; s.y      = y;
      this.addChild(s);
      this.tipSprites.push(s);
    }
  }

  private buildTime(): void {
    // 闹钟容器
    this.clockContainer   = new PIXI.Container();
    this.clockContainer.x = 580;
    this.clockContainer.y = 85;

    // 表盘（静态，generateTexture 后的 Sprite）
    this.clockFaceSprite = new PIXI.Sprite(this.ctx.assets.GetTexture('clock_face.png'));
    const face = this.clockFaceSprite;
    face.width    = 80;
    face.height   = 80;
    this.clockContainer.addChild(face);

    // 指针：pivot 在顶部中心，放置于表盘圆心 (40, 40)
    this.clockHandSprite           = new PIXI.Sprite(this.ctx.assets.GetTexture('clock_hand.png'));
    this.clockHandSprite.width     = 6;
    this.clockHandSprite.height    = 26;
    this.clockHandSprite.pivot.set(3, 0);
    this.clockHandSprite.x        = 40;
    this.clockHandSprite.y        = 40;
    this.clockHandSprite.rotation = Math.PI; // 12 点位置
    this.clockContainer.addChild(this.clockHandSprite);

    this.addChild(this.clockContainer);

    // 时间数字（最多 3 位，右对齐，以 680 为最右）
    const digitW = 50, digitH = 65;
    for (let i = 0; i < 3; i++) {
      const s  = new PIXI.Sprite(this.ctx.assets.GetTexture('0.png'));
      s.width  = digitW;
      s.height = digitH;
      s.x      = 680 - (2 - i) * (digitW + 5);
      s.y      = 98;
      s.visible = false;
      this.addChild(s);
      this.timeSprites.push(s);
    }
  }

  private buildLives(): void {
    const heartSize = 60;
    const gap       = 10;
    const startX    = 760;
    const y         = 95;

    for (let i = 0; i < 3; i++) {
      const s  = new PIXI.Sprite(this.ctx.assets.GetTexture('heart.png'));
      s.width  = heartSize;
      s.height = heartSize;
      s.x      = startX + i * (heartSize + gap);
      s.y      = y;
      this.addChild(s);
      this.livesSprites.push(s);
    }
  }

  private buildSettingsButton(onSettings: () => void): void {
    const s  = new PIXI.Sprite(this.ctx.assets.GetTexture('settings.png'));
    s.width  = 60;
    s.height = 60;
    s.x      = 1010;
    s.y      = 20;
    this.addChild(s);
    this.ctx.input.registerUI(new UIElement({ zIndex: 15, sprite: s, onTap: onSettings }));
  }

  // ── 弹跳动画 ─────────────────────────────────────────────────────

  private updateBounce(deltaMs: number): void {
    if (this.bounceElapsed < 0) return;

    this.bounceElapsed += deltaMs;
    const t = this.bounceElapsed / Header.BOUNCE_DURATION;

    if (t >= 1) {
      this.clockContainer.scale.set(1);
      this.bounceElapsed = -1;
      return;
    }

    // 简单正弦弹跳：0 → 1 → 0，峰值缩放 1.25
    const scale = 1 + 0.25 * Math.sin(t * Math.PI);
    this.clockContainer.scale.set(scale);
  }
}
