import * as PIXI from 'pixi.js-legacy';
import { ExplosionSystem } from './effect';
import { FlyingBonus } from './flyingBonus';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';

export class EffectManager extends PIXI.Container {
  private readonly explosion: ExplosionSystem;
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
    this.explosion = new ExplosionSystem(this, ctx.assets);
  }

  /**
   * Trigger an explosion at the given cell index.
   *
   * @param index   Cell index (used to look up screen position)
   * @param isCombo Whether this elimination is part of a combo
   */
  public playEffect(index: number, isCombo = false): void {
    const { x, y } = this.screen.indexToPos(index);
    const half = this.screen.gridSize / 2;
    this.explosion.play(x + half, y + half, isCombo, this.screen.gridSize);
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
