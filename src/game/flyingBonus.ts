import * as PIXI from 'pixi.js-legacy';

/**
 * A "+Xs" label that animates in three phases:
 *   Phase 1 (0-100 ms)  : Appear at click position, scale 0 -> 2
 *   Phase 2 (100-200 ms): Hold at click position at scale 2 (large, easy to read)
 *   Phase 3 (200-300 ms): Fly from click position to the clock icon, shrink and fade
 */
export class FlyingBonus extends PIXI.Container {
  private elapsed = 0;
  private _isDone = false;

  /** onReached fires at this time (ms) — during phase 3, before the animation ends. */
  private callbackFired = false;
  private static readonly CALLBACK_TIME = 250;

  private static readonly PHASE_GROW = 100;
  private static readonly PHASE_HOLD = 100;
  private static readonly PHASE_FLY  = 100;
  public  static readonly DURATION   = 300;

  constructor(
    private readonly sx: number,
    private readonly sy: number,
    private readonly ex: number,
    private readonly ey: number,
    bonusSeconds: number,
    isCombo: boolean,
    private readonly onReached: () => void,
  ) {
    super();

    const label = new PIXI.Text('+' + bonusSeconds + 's', {
      fontFamily: 'Arial Black, Arial',
      fontSize: 80,
      fontWeight: 'bold',
      fill: isCombo ? '#76FF03' : '#FFD700',
      stroke: '#333333',
      strokeThickness: 8,
    } as object);

    (label as PIXI.Text).anchor.set(0.5);
    this.addChild(label);

    this.x = sx;
    this.y = sy;
    this.scale.set(0);
    this.alpha = 1;
  }

  public get isDone(): boolean { return this._isDone; }

  public update(deltaMs: number): void {
    if (this._isDone) return;

    this.elapsed += deltaMs;

    // Fire onReached at 250ms (mid-flight, as the label approaches the clock).
    if (!this.callbackFired && this.elapsed >= FlyingBonus.CALLBACK_TIME) {
      this.callbackFired = true;
      this.onReached();
    }

    const GROW = FlyingBonus.PHASE_GROW;
    const HOLD = FlyingBonus.PHASE_HOLD;
    const FLY  = FlyingBonus.PHASE_FLY;

    if (this.elapsed < GROW) {
      // Phase 1: pop up at click position, scale 0 -> 2
      const t = this.elapsed / GROW;
      const s = (t < 0.75) ? (t / 0.75 * 2.2) : (2.2 - (t - 0.75) / 0.25 * 0.2);
      this.scale.set(Math.max(0, s));
      this.x = this.sx;
      this.y = this.sy;
      this.alpha = 1;
    } else if (this.elapsed < GROW + HOLD) {
      // Phase 2: hold at 2x scale
      this.scale.set(2);
      this.x = this.sx;
      this.y = this.sy;
      this.alpha = 1;
    } else if (this.elapsed < GROW + HOLD + FLY) {
      // Phase 3: fly to clock (ease-in), shrink from 2 to near 0, fade out
      const raw = (this.elapsed - GROW - HOLD) / FLY;
      const t = raw * raw;
      this.x = this.sx + (this.ex - this.sx) * t;
      this.y = this.sy + (this.ey - this.sy) * t;
      this.scale.set(2 * (1 - raw * 0.9));
      this.alpha = (raw < 0.4) ? 1 : (1 - raw) / 0.6;
    } else {
      this._isDone = true;
      this.visible = false;
      // onReached already fired at CALLBACK_TIME (250ms)
    }
  }
}
