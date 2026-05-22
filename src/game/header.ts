import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { UIElement } from '../inputSystem/uiElement';
import { Orientation } from './enums';

export class Header extends PIXI.Container {
  /** 最多 3 位数字 Sprite，支持 0–999 秒显示，修复原来只支持两位数的 bug */
  private timeSprites: PIXI.Sprite[] = [];
  private lastDisplayedSeconds = -1;

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig,
    private readonly target: number,
    onSettings: () => void,
  ) {
    super();
    this.buildBackground();
    this.buildTip();
    this.buildTime();
    this.buildSettingsButton(onSettings);
  }

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
   * 修复：通过 target 参数动态生成，而非写死 10
   */
  private buildTip(): void {
    const w = 80, h = 100, y = 85;
    const maxFirst = Math.min(9, this.target - 1);
    const minFirst = Math.max(1, this.target - 9);
    const first = minFirst + Math.floor(Math.random() * (maxFirst - minFirst + 1));
    const second = this.target - first;

    const targetStr = this.target.toString();
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
    }
  }

  private buildTime(): void {
    const clock = this.ctx.assets.GetSpriteFromNumberAtlas('clock.png');
    clock.width = 170;
    clock.height = 170;
    clock.x = 600;
    clock.y = 50;
    this.addChild(clock);

    // 3 位数字 Sprite，右对齐排列
    for (let i = 0; i < 3; i++) {
      const d = this.ctx.assets.GetSpriteFromNumberAtlas('0.png');
      d.width = 100;
      d.height = 120;
      d.x = 800 + i * 110;
      d.y = 73;
      d.visible = false;
      this.addChild(d);
      this.timeSprites.push(d);
    }
  }

  private buildSettingsButton(onSettings: () => void): void {
    const btn = this.ctx.assets.GetSpriteFromNumberAtlas('clock.png');
    btn.width = 120;
    btn.height = 120;
    btn.x = 1050;
    btn.y = 70;
    this.addChild(btn);
    this.ctx.input.registerUI(
      new UIElement({
        zIndex: 10,
        sprite: btn,
        onTap: onSettings,
      }),
    );
  }

  /**
   * 每帧由 GameScene 调用，传入剩余秒数。
   * 修复：支持 3 位数（原代码仅支持 <100 秒）
   */
  public updateTime(seconds: number): void {
    if (seconds === this.lastDisplayedSeconds) return;
    this.lastDisplayedSeconds = seconds;

    const s = Math.max(0, seconds).toString();
    // 先全部隐藏
    for (const d of this.timeSprites) d.visible = false;
    // 从右往左填入各位数字
    for (let i = 0; i < s.length && i < this.timeSprites.length; i++) {
      const sprite = this.timeSprites[this.timeSprites.length - 1 - i];
      sprite.texture = this.ctx.assets.GetTexture(`${s[s.length - 1 - i]}.png`);
      sprite.visible = true;
    }
  }
}
