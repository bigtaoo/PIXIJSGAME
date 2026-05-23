import * as PIXI from 'pixi.js-legacy';
import { Effect } from './effect';
import { FlyingBonus } from './flyingBonus';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';

export class EffectManager extends PIXI.Container {
  private effects: Effect[] = [];
  private flyingBonuses: FlyingBonus[] = [];

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
  }

  public playEffect(index: number): void {
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
    const fb = new FlyingBonus(startX, startY, endX, endY, bonusSeconds, isCombo, onReached);
    this.flyingBonuses.push(fb);
    this.flyingLayer.addChild(fb);
  }

  public update(deltaMs: number): void {
    for (const e of this.effects) {
      if (e.IsVisible()) e.Update(deltaMs);
    }

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
