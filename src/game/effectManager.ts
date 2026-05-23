import * as PIXI from 'pixi.js-legacy';
import { Effect } from './effect';
import { FlyingBonus } from './flyingBonus';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';

export class EffectManager extends PIXI.Container {
  private effects: Effect[] = [];
  private flyingBonuses: FlyingBonus[] = [];

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig,
  ) {
    super();
  }

  // ── Explosion effect ──────────────────────────────────────────────

  public playEffect(index: number): void {
    // Reuse a finished Effect instance to avoid unbounded growth
    let effect = this.effects.find((e) => !e.IsVisible());
    if (!effect) {
      const sprite = this.ctx.assets.GetSpriteFromNumberAtlas('boom-0.png');
      sprite.width = this.screen.gridSize;
      sprite.height = this.screen.gridSize;
      this.addChild(sprite);
      effect = new Effect(sprite, this.ctx.assets);
      this.effects.push(effect);
    }
    const { x, y } = this.screen.indexToPos(index);
    effect.Play(x, y);
  }

  // ── Flying time-bonus animation ───────────────────────────────────

  /**
   * Spawn a "+Xs" label that arcs from (startX, startY) to the clock icon
   * at (endX, endY). onReached fires when the label arrives, so the caller
   * can trigger the clock bounce.
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
    const fb = new FlyingBonus(startX, startY, endX, endY, bonusSeconds, isCombo, onReached);
    this.flyingBonuses.push(fb);
    this.addChild(fb);
  }

  // ── Per-frame update ──────────────────────────────────────────────

  public update(deltaMs: number): void {
    // Explosion frames
    for (const e of this.effects) {
      if (e.IsVisible()) e.Update(deltaMs);
    }

    // Flying bonus labels — remove completed ones
    this.flyingBonuses = this.flyingBonuses.filter((fb) => {
      fb.update(deltaMs);
      if (fb.isDone) {
        this.removeChild(fb);
        return false;
      }
      return true;
    });
  }
}
