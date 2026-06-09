import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';

/**
 * A "+Xs" animation that flies from the tapped cell to the clock icon.
 *
 * Phases:
 *   Phase 1 (0–160 ms)  : pop in at click position, scale 0 → 1 with overshoot
 *   Phase 2 (160–360 ms): hold at click position
 *   Phase 3 (360–700 ms): fly along Bézier arc to clock, shrink + fade + slight rotation
 *
 * Visual: amber pill background + white [+] [digit(s)] [s].
 */
export class FlyingBonus extends PIXI.Container {
  private elapsed = 0;
  private _isDone = false;

  private callbackFired = false;
  private static readonly CALLBACK_TIME = 500;

  private static readonly PHASE_GROW = 100;
  private static readonly PHASE_HOLD = 200;
  private static readonly PHASE_FLY  = 300;

  // Native sprite sizes — no scale multiplier needed
  private static readonly SPRITE_H = 80;
  private static readonly SPRITE_W = Math.round(80 * 120 / 160); // 60
  private static readonly PLUS_W   = 44;
  private static readonly PLUS_H   = 44;
  private static readonly S_W      = 24;
  private static readonly S_H      = 34;
  private static readonly GAP      = -2;
  private static readonly PAD_X    = 20;
  private static readonly PAD_Y    = 14;

  // Pill colours
  private static readonly PILL_FILL   = 0xD4840A; // warm amber
  private static readonly PILL_BORDER = 0xFFB830; // bright gold rim
  private static readonly PILL_COMBO  = 0x2E8A00; // deep green for combo

  constructor(
    private readonly sx: number,
    private readonly sy: number,
    private readonly ex: number,
    private readonly ey: number,
    bonusSeconds: number,
    isCombo: boolean,
    private readonly onReached: () => void,
    ctx: AppContext,
    showUnit = true,
  ) {
    super();

    const pillFill   = isCombo ? FlyingBonus.PILL_COMBO  : FlyingBonus.PILL_FILL;
    const pillBorder = isCombo ? 0x76FF03               : FlyingBonus.PILL_BORDER;

    const H     = FlyingBonus.SPRITE_H;
    const DW    = FlyingBonus.SPRITE_W;
    const PW    = FlyingBonus.PLUS_W;
    const PH    = FlyingBonus.PLUS_H;
    const SW    = FlyingBonus.S_W;
    const SH    = FlyingBonus.S_H;
    const GAP   = FlyingBonus.GAP;
    const PAD_X = FlyingBonus.PAD_X;
    const PAD_Y = FlyingBonus.PAD_Y;

    const digits  = bonusSeconds.toString().split('');
    const unitW   = showUnit ? SW + GAP : 0;
    const innerW  = PW + GAP + digits.length * DW + unitW;
    const pillW   = innerW + PAD_X * 2;
    const pillH   = H + PAD_Y * 2;
    const r       = pillH / 2;

    // ── Pill ────────────────────────────────────────────────────────────────
    const pill = new PIXI.Graphics();
    // Drop shadow
    pill.lineStyle(0);
    pill.beginFill(0x000000, 0.22);
    pill.drawRoundedRect(-pillW / 2 + 3, -pillH / 2 + 4, pillW, pillH, r);
    pill.endFill();
    // Main fill
    pill.lineStyle(3, pillBorder, 1);
    pill.beginFill(pillFill);
    pill.drawRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, r);
    pill.endFill();
    // Top highlight
    pill.lineStyle(0);
    pill.beginFill(0xFFFFFF, 0.18);
    pill.drawRoundedRect(-pillW / 2 + 4, -pillH / 2 + 4, pillW - 8, pillH * 0.40, r - 2);
    pill.endFill();
    this.addChild(pill);

    // ── Sprites (white tint for max contrast on coloured pill) ────────────
    let curX = -innerW / 2;

    const plus   = new PIXI.Sprite(ctx.assets.GetTexture('plus.png'));
    plus.width   = PW;
    plus.height  = PH;
    plus.x       = curX;
    plus.y       = -(PH / 2);
    plus.tint    = 0xFFFFFF;
    this.addChild(plus);
    curX += PW + GAP;

    for (const ch of digits) {
      const d   = new PIXI.Sprite(ctx.assets.GetTexture(`${ch}.png`));
      d.width   = DW;
      d.height  = H;
      d.x       = curX;
      d.y       = -(H / 2);
      d.tint    = 0xFFFFFF;
      this.addChild(d);
      curX += DW;
    }
    curX += GAP;

    if (showUnit) {
      const s   = new PIXI.Sprite(ctx.assets.GetTexture('s.png'));
      s.width   = SW;
      s.height  = SH;
      s.x       = curX;
      s.y       = -(SH / 2) + 6;
      s.tint    = 0xFFFFFF;
      this.addChild(s);
    }

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
      // Overshoot pop-in: 0 → 1.12 → 1.0
      const t = this.elapsed / GROW;
      const s = t < 0.75
        ? (t / 0.75) * 1.12
        : 1.12 - (t - 0.75) / 0.25 * 0.12;
      this.scale.set(Math.max(0, s));
      this.x        = this.sx;
      this.y        = this.sy;
      this.alpha    = 1;
      this.rotation = 0;

    } else if (this.elapsed < GROW + HOLD) {
      this.scale.set(1);
      this.x        = this.sx;
      this.y        = this.sy;
      this.alpha    = 1;
      this.rotation = 0;

    } else if (this.elapsed < GROW + HOLD + FLY) {
      const raw = (this.elapsed - GROW - HOLD) / FLY;
      const t   = raw * raw;
      const mt  = 1 - t;
      const cx  = (this.sx + this.ex) / 2;
      const cy  = Math.min(this.sy, this.ey) - 220;
      this.x    = mt * mt * this.sx + 2 * mt * t * cx + t * t * this.ex;
      this.y    = mt * mt * this.sy + 2 * mt * t * cy + t * t * this.ey;
      this.scale.set(1 - raw * 0.65);
      this.alpha    = raw < 0.55 ? 1 : (1 - raw) / 0.45;
      this.rotation = raw * 0.22;

    } else {
      this._isDone  = true;
      this.visible  = false;
    }
  }
}
