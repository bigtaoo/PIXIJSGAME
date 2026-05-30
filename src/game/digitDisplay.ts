/**
 * digitDisplay.ts
 *
 * Lightweight number display container: renders an integer as a row of digit sprites.
 *
 * Usage example:
 *   const d = new DigitDisplay(ctx, 30, 40);
 *   d.update(42);          // renders "42"
 *   d.x = centerX - d.totalWidth / 2;  // centre horizontally
 *
 * When tint is white the original texture colours are passed through; other values tint the whole display.
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

  /** Total pixel width of all currently visible digits. */
  get totalWidth(): number { return this._totalWidth; }

  /** Set a new tint and apply it to all sprites. */
  set tint(value: number) {
    this._tint = value;
    for (const s of this.sprites) s.tint = value;
  }
  get tint(): number { return this._tint; }

  /**
   * Update the displayed number.
   * @param n Non-negative integer
   */
  update(n: number): void {
    const str = Math.max(0, Math.floor(n)).toString();
    const len = str.length;

    // Expand the sprite pool as needed
    while (this.sprites.length < len) {
      const s = new PIXI.Sprite(this.ctx.assets.GetTexture('0.png'));
      s.tint = this._tint;
      this.addChild(s);
      this.sprites.push(s);
    }

    // Update visible sprites
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
