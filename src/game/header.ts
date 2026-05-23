import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { UIElement } from '../inputSystem/uiElement';
import { Orientation } from './enums';

export class Header extends PIXI.Container {
  /** 最多 3 位数字 Sprite，支持 0–999 秒显示 */
  private timeSprites: PIXI.Sprite[] = [];
  private lastDisplayedSeconds = -1;

  /** 当前目标提示的 Sprite 列表（updateTarget 时整体替换） */
  private tipSprites: PIXI.Sprite[] = [];

  /** 命数图标（最多 3 个，减少时逐一隐藏） */
  private livesSprites: PIXI.Sprite[] = [];

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

  // ── 公开接口 ─────────────────────────────────────────────────────────

  /**
   * 切换到新目标数字时调用（每关 5 次）。
   * 清除旧提示 Sprite 并重建。
   */
  public updateTarget(target: number): void {
    this._target = target;
    // 清除旧提示
    for (const s of this.tipSprites) {
      this.removeChild(s);
      s.destroy();
    }
    this.tipSprites = [];
    this.buildTip();
  }

  /**
   * 每帧由 GameScene 调用，传入剩余秒数。
   * 支持 3 位数（修复原代码仅支持 <100 秒的 bug）。
   */
  public updateTime(seconds: number): void {
    if (seconds === this.lastDisplayedSeconds) return;
    this.lastDisplayedSeconds = seconds;

    const s = Math.max(0, seconds).toString();
    for (const d of this.timeSprites) d.visible = false;
    for (let i = 0; i < s.length && i < this.timeSprites.length; i++) {
      const sprite = this.timeSprites[this.timeSprites.length - 1 - i];
      sprite.texture = this.ctx.assets.GetTexture(`${s[s.length - 1 - i]}.png`);
      sprite.visible = true;
    }
  }

  /**
   * 剩余命数变化时调用（0–3）。
   * 命数图标从右到左依次隐藏。
   */
  public updateLives(lives: number): void {
    for (let i = 0; i < this.livesSprites.length; i++) {
      this.livesSprites[i].visible = i < lives;
    }
  }

  // ── 私有构建方法 ─────────────────────────────────────────────────────

  private buildBackground(): void {
    const tex = this.ctx.assets.GetTexture('note.png');
    const bg = new PIXI.NineSlicePlane(tex, 220, 200, 220, 200);
    bg.height = 250;

    if (this.screen.orientation === Orientation.Landscape) {
      this.x = 350;
      this.y = 10;
      bg.width = 1350;
    } else {
      bg.width = this.screen.width - 200;
    }
    this.addChild(bg);
  }

  /**
   * 顶部提示区：显示本局目标公式，例如 "3 + 7 = 10"
   * 动态生成，updateTarget() 会重建。
   */
  private buildTip(): void {
    const w = 80, h = 100, y = 85;
    const maxFirst = Math.min(9, this._target - 1);
    const minFirst = Math.max(1, this._target - 9);
    const first = minFirst + Math.floor(Math.random() * (maxFirst - minFirst + 1));
    const second = this._target - first;

    const targetStr = this._target.toString();
    const items: [string, number][] = [
      [`${first}.png`, 70],
      ['plus.png', 155],
      [`${second}.png`, 240],
      ['equa.png', 325],
    ];
    targetStr.split('').forEach((ch, i) => items.push([`${ch}.png`, 410 + i * 85]));

    for (const [key, x] of items) {
      const s = this.ctx.assets.GetSpriteFromNumberAtlas(key);
      s.width = w;
      s.height = h;
      s.x = x;
      s.y = y;
      this.addChild(s);
      this.tipSprites.push(s);
    }
  }

  private buildTime(): void {
    const clock = this.ctx.assets.GetSpriteFromNumberAtlas('clock.png');
    clock.width = 80;
    clock.height = 80;
    clock.x = 620;
    clock.y = 90;
    this.addChild(clock);

    for (let i = 0; i < 3; i++) {
      const d = this.ctx.assets.GetSpriteFromNumberAtlas('0.png');
      d.width = 80;
      d.height = 100;
      d.x = 720 + i * 90;
      d.y = 75;
      d.visible = false;
      this.addChild(d);
      this.timeSprites.push(d);
    }
  }

  /**
   * 命数显示：3 个小图标，从左到右排列，命数减少时从右往左隐藏。
   * 使用 retry.png 作为命数图标（实际项目可替换为心形素材）。
   */
  private buildLives(): void {
    for (let i = 0; i < 3; i++) {
      const s = this.ctx.assets.GetSpriteFromNumberAtlas('retry.png');
      s.width = 60;
      s.height = 60;
      s.x = 1000 + i * 70;
      s.y = 100;
      this.addChild(s);
      this.livesSprites.push(s);
    }
  }

  private buildSettingsButton(onSettings: () => void): void {
    const btn = this.ctx.assets.GetSpriteFromNumberAtlas('clock.png');
    btn.width = 100;
    btn.height = 100;
    btn.x = 980;
    btn.y = 30;
    this.addChild(btn);
    this.ctx.input.registerUI(
      new UIElement({ zIndex: 10, sprite: btn, onTap: onSettings }),
    );
  }
}
