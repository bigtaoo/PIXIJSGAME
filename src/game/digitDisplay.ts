/**
 * digitDisplay.ts
 *
 * 轻量级数字显示容器：将整数渲染为一排 digit sprite。
 *
 * 用法示例：
 *   const d = new DigitDisplay(ctx, 30, 40);
 *   d.update(42);          // 渲染 "42"
 *   d.x = centerX - d.totalWidth / 2;  // 水平居中
 *
 * tint 属性为白色时透传原图颜色；设为其他值可整体着色。
 */
import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';

export class DigitDisplay extends PIXI.Container {
  private readonly sprites: PIXI.Sprite[] = [];
  private _tint: number = 0xFFFFFF;
  private _totalWidth = 0;

  constructor(
    private readonly ctx: AppContext,
    public digitW: number,
    public digitH: number,
    tint: number = 0xFFFFFF,
  ) {
    super();
    this._tint = tint;
  }

  /** 当前所有可见数字的总像素宽度。 */
  get totalWidth(): number { return this._totalWidth; }

  /** 重新设置 tint 并应用到所有精灵。 */
  set tint(value: number) {
    this._tint = value;
    for (const s of this.sprites) s.tint = value;
  }
  get tint(): number { return this._tint; }

  /**
   * 更新显示数字。
   * @param n 非负整数
   */
  update(n: number): void {
    const str = Math.max(0, Math.floor(n)).toString();
    const len = str.length;

    // 按需扩展精灵池
    while (this.sprites.length < len) {
      const s = new PIXI.Sprite(this.ctx.assets.GetTexture('0.png'));
      s.tint = this._tint;
      this.addChild(s);
      this.sprites.push(s);
    }

    // 更新可见精灵
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i];
      if (i < len) {
        s.texture  = this.ctx.assets.GetTexture(`${str[i]}.png`);
        s.width    = this.digitW;
        s.height   = this.digitH;
        s.x        = i * this.digitW;
        s.y        = 0;
        s.tint     = this._tint;
        s.visible  = true;
      } else {
        s.visible = false;
      }
    }

    this._totalWidth = len * this.digitW;
  }
}
