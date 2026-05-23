import * as PIXI from 'pixi.js-legacy';

/**
 * A "+Xs" label that flies along a bezier arc from an elimination point to the
 * clock icon in the header, giving the player clear visual feedback on the
 * time bonus they earned.
 *
 * The caller owns the lifecycle: add to a container, call update() each frame,
 * and remove when isDone returns true.
 */
export class FlyingBonus extends PIXI.Container {
  private elapsed = 0;
  private _isDone = false;

  // Bezier control point stored at construction time
  private readonly cx: number;
  private readonly cy: number;

  private static readonly DURATION = 550; // ms

  constructor(
    private readonly sx: number,  // start X (GameScene local)
    private readonly sy: number,  // start Y
    private readonly ex: number,  // end X  (clock centre)
    private readonly ey: number,  // end Y
    bonusSeconds: number,
    isCombo: boolean,
    private readonly onReached: () => void,
  ) {
    super();

    // Control point: one third of the way horizontally, well above both endpoints.
    // This creates a smooth arc that rises before curving toward the header.
    this.cx = sx + (ex - sx) * 0.3;
    this.cy = Math.min(sy, ey) - 180;

    const label = new PIXI.Text(`+${bonusSeconds}s`, {
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
  }

  public get isDone(): boolean { return this._isDone; }

  /** Advance the animation. Call every frame until isDone is true. */
  public update(deltaMs: number): void {
    if (this._isDone) return;

    this.elapsed += deltaMs;
    const raw = Math.min(this.elapsed / FlyingBonus.DURATION, 1);

    // Smooth ease-in-out
    const t = raw < 0.5 ? 2 * raw * raw : -1 + (4 - 2 * raw) * raw;
    const mt = 1 - t;

    // Quadratic bezier position
    this.x = mt * mt * this.sx + 2 * mt * t * this.cx + t * t * this.ex;
    this.y = mt * mt * this.sy + 2 * mt * t * this.cy + t * t * this.ey;

    // Fade: in over first 20%, out over last 20%
    if (raw < 0.2)      this.alpha = raw / 0.2;
    else if (raw > 0.8) this.alpha = (1 - raw) / 0.2;
    else                this.alpha = 1;

    if (raw >= 1) {
      this._isDone = true;
      this.visible = false;
      this.onReached();
    }
  }
}
