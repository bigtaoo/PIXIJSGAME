import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';

/**
 * A "+Xs" animation that flies from the tapped cell to the clock icon.
 *
 * Three phases:
 *   Phase 1 (0-100 ms)  : pop in at click position, scale 0 → 2
 *   Phase 2 (100-200 ms): hold at click position at scale 2
 *   Phase 3 (200-300 ms): fly to clock, shrink and fade
 *
 * Visual: [plus.png] [digit sprite(s)] [s.png]，全部 tint 为金色（普通）或绿色（combo）。
 */
export class FlyingBonus extends PIXI.Container {
  private elapsed = 0;
  private _isDone = false;

  private callbackFired = false;
  private static readonly CALLBACK_TIME = 250;

  private static readonly PHASE_GROW = 100;
  private static readonly PHASE_HOLD = 100;
  private static readonly PHASE_FLY  = 100;
  public  static readonly DURATION   = 300;

  // 各精灵的尺寸（在 scale=1 时）
  private static readonly SPRITE_H    = 80;
  private static readonly SPRITE_W    = Math.round(80 * 120 / 160); // 60，digits 等比
  private static readonly PLUS_W      = 40;
  private static readonly PLUS_H      = 40;
  private static readonly S_W         = 20;
  private static readonly S_H         = 30;
  private static readonly GAP         = -8;

  constructor(
    private readonly sx: number,
    private readonly sy: number,
    private readonly ex: number,
    private readonly ey: number,
    bonusSeconds: number,
    isCombo: boolean,
    private readonly onReached: () => void,
    ctx: AppContext,
  ) {
    super();

    const color = isCombo ? 0x76FF03 : 0xFFD700;
    const H     = FlyingBonus.SPRITE_H;
    const DW    = FlyingBonus.SPRITE_W;
    const PW    = FlyingBonus.PLUS_W;
    const PH    = FlyingBonus.PLUS_H;
    const SW    = FlyingBonus.S_W;
    const SH    = FlyingBonus.S_H;
    const GAP   = FlyingBonus.GAP;

    const digits = bonusSeconds.toString().split('');
    const totalW  = PW + GAP + digits.length * DW + GAP + SW;
    const startX  = -totalW / 2;  // 居中于 (0, 0)

    let curX = startX;

    // 加号
    const plus = new PIXI.Sprite(ctx.assets.GetTexture('plus.png'));
    plus.width  = PW;
    plus.height = PH;
    plus.x      = curX;
    plus.y      = -(PH / 2);
    plus.tint   = color;
    this.addChild(plus);
    curX += PW + GAP;

    // 数字（可能为 1 位或 2 位）
    for (const ch of digits) {
      const d = new PIXI.Sprite(ctx.assets.GetTexture(`${ch}.png`));
      d.width  = DW;
      d.height = H;
      d.x      = curX;
      d.y      = -(H / 2);
      d.tint   = color;
      this.addChild(d);
      curX += DW;
    }
    curX += GAP;

    // 字母 s
    const s = new PIXI.Sprite(ctx.assets.GetTexture('s.png'));
    s.width  = SW;
    s.height = SH;
    s.x      = curX;
    s.y      = -(SH / 2) + 7;
    s.tint   = color;
    this.addChild(s);

    this.x = sx;
    this.y = sy;
    this.scale.set(0);
    this.alpha = 1;
  }

  public get isDone(): boolean { return this._isDone; }

  public update(deltaMs: number): void {
    if (this._isDone) return;

    this.elapsed += deltaMs;

    if (!this.callbackFired && this.elapsed >= FlyingBonus.CALLBACK_TIME) {
      this.callbackFired = true;
      this.onReached();
    }

    const GROW = FlyingBonus.PHASE_GROW;
    const HOLD = FlyingBonus.PHASE_HOLD;
    const FLY  = FlyingBonus.PHASE_FLY;

    if (this.elapsed < GROW) {
      const t = this.elapsed / GROW;
      const s = (t < 0.75) ? (t / 0.75 * 2.2) : (2.2 - (t - 0.75) / 0.25 * 0.2);
      this.scale.set(Math.max(0, s));
      this.x = this.sx;
      this.y = this.sy;
      this.alpha = 1;
    } else if (this.elapsed < GROW + HOLD) {
      this.scale.set(2);
      this.x = this.sx;
      this.y = this.sy;
      this.alpha = 1;
    } else if (this.elapsed < GROW + HOLD + FLY) {
      const raw = (this.elapsed - GROW - HOLD) / FLY;
      // Quadratic Bézier arc: control point is above the start point so the
      // label rises before curving down to the clock.
      const t  = raw * raw;           // ease-in along the arc
      const mt = 1 - t;
      // Control point: midpoint between start and end, shifted upward by 200px
      const cx = (this.sx + this.ex) / 2;
      const cy = Math.min(this.sy, this.ey) - 200;
      this.x = mt * mt * this.sx + 2 * mt * t * cx + t * t * this.ex;
      this.y = mt * mt * this.sy + 2 * mt * t * cy + t * t * this.ey;
      this.scale.set(2 * (1 - raw * 0.9));
      this.alpha = (raw < 0.4) ? 1 : (1 - raw) / 0.6;
    } else {
      this._isDone = true;
      this.visible = false;
    }
  }
}
