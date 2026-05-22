import * as PIXI from 'pixi.js-legacy';
import { Effect } from './effect';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';

export class EffectManager extends PIXI.Container {
  private effects: Effect[] = [];

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig,
  ) {
    super();
  }

  public playEffect(index: number): void {
    // 复用已结束的 Effect，避免无限增长
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

  public update(deltaMs: number): void {
    for (const e of this.effects) {
      if (e.IsVisible()) e.Update(deltaMs);
    }
  }
}
