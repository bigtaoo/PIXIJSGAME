import * as PIXI from 'pixi.js-legacy';
import { ExplosionSystem } from './effect';
import { FlyingBonus } from './flyingBonus';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';

// ── ComboRipple ────────────────────────────────────────────────────────────

const RIPPLE_DURATION = 200; // ms
const RIPPLE_COLOR_2  = 0xFFD700; // combo ×2 — gold
const RIPPLE_COLOR_3  = 0x76FF03; // combo ×3+ — bright green
const RIPPLE_LINE_WIDTH = 3;

interface Ripple {
  gfx:      PIXI.Graphics;
  cx:       number;
  cy:       number;
  color:    number;
  elapsed:  number;
  active:   boolean;
}

// ── EffectManager ──────────────────────────────────────────────────────────

export class EffectManager extends PIXI.Container {
  private readonly explosion: ExplosionSystem;
  private flyingBonuses: FlyingBonus[] = [];

  /** Object pool for combo ripple rings. */
  private readonly ripples: Ripple[] = [];

  /**
   * Separate container for flying-bonus labels.
   * Add this to the scene AFTER the Header so it always renders on top.
   */
  public readonly flyingLayer = new PIXI.Container();

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig,
  ) {
    super();
    this.explosion = new ExplosionSystem(this, ctx.assets);
  }

  /**
   * Trigger an explosion at the given cell index.
   *
   * @param index      Cell index (used to look up screen position)
   * @param isCombo    Whether this elimination is part of a combo
   * @param comboCount Current combo count (used to pick ripple colour)
   */
  public playEffect(index: number, isCombo = false, comboCount = 1): void {
    const { x, y } = this.screen.indexToPos(index);
    const half = this.screen.gridSize / 2;
    const cx = x + half;
    const cy = y + half;
    this.explosion.play(cx, cy, isCombo, this.screen.gridSize);
    if (isCombo) {
      this.spawnRipple(cx, cy, comboCount >= 3 ? RIPPLE_COLOR_3 : RIPPLE_COLOR_2);
    }
  }

  // ── Ripple helpers ───────────────────────────────────────────────────────

  private spawnRipple(cx: number, cy: number, color: number): void {
    // Reuse an inactive ripple from the pool, or create a new one.
    let r = this.ripples.find(p => !p.active);
    if (!r) {
      const gfx = new PIXI.Graphics();
      this.addChild(gfx);
      r = { gfx, cx, cy, color, elapsed: 0, active: false };
      this.ripples.push(r);
    }
    r.cx      = cx;
    r.cy      = cy;
    r.color   = color;
    r.elapsed = 0;
    r.active  = true;
  }

  private updateRipples(deltaMs: number): void {
    const gs = this.screen.gridSize;
    const rMin = gs * 0.5;
    const rMax = gs * 1.0;

    for (const r of this.ripples) {
      if (!r.active) continue;
      r.elapsed += deltaMs;
      const t = Math.min(r.elapsed / RIPPLE_DURATION, 1);
      const radius = rMin + (rMax - rMin) * t;
      const alpha  = 1 - t;

      r.gfx.clear();
      r.gfx.lineStyle(RIPPLE_LINE_WIDTH, r.color, alpha);
      r.gfx.drawCircle(r.cx, r.cy, radius);

      if (t >= 1) {
        r.gfx.clear();
        r.active = false;
      }
    }
  }

  /**
   * Spawn a "+Xs" label that pops up at (startX, startY) and flies to the clock.
   * Labels live in flyingLayer so GameScene can render them above the Header.
   */
  public playFlyingBonus(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    bonusSeconds: number,
    isCombo: boolean,
    onReached: () => void,
  ): void {
    const fb = new FlyingBonus(startX, startY, endX, endY, bonusSeconds, isCombo, onReached, this.ctx);
    this.flyingBonuses.push(fb);
    this.flyingLayer.addChild(fb);
  }

  /**
   * Spawn a "+N" score label (no unit suffix) that flies from (startX, startY)
   * to (endX, endY).  Used by DailyChallengeScene.
   */
  public playFlyingScore(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    points: number,
    isCombo: boolean,
  ): void {
    const fb = new FlyingBonus(startX, startY, endX, endY, points, isCombo, () => {}, this.ctx, false);
    this.flyingBonuses.push(fb);
    this.flyingLayer.addChild(fb);
  }

  public update(deltaMs: number): void {
    this.explosion.update(deltaMs);
    this.updateRipples(deltaMs);

    this.flyingBonuses = this.flyingBonuses.filter((fb) => {
      fb.update(deltaMs);
      if (fb.isDone) {
        this.flyingLayer.removeChild(fb);
        return false;
      }
      return true;
    });
  }
}
