import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';

/**
 * 游戏结果浮层（胜利/失败）。
 * 重构：移除对 display/config 的全局引用，改用回调函数。
 * 构造时即创建所有子节点，可见性由 show()/hide() 控制。
 */
export class GameResultOverlay extends PIXI.Container {
  private retryBtn: PIXI.Sprite;
  private nextBtn: PIXI.Sprite;

  constructor(
    ctx: AppContext,
    onRetry: () => void,
    onNext: () => void,
  ) {
    super();
    this.visible = false;

    const bg = ctx.assets.GetSpriteFromNumberAtlas('note.png');
    bg.width = 600;
    bg.height = 700;
    bg.x = 720;
    bg.y = 270;
    this.addChild(bg);

    const btnX = 830;
    const btnY = 410;

    this.retryBtn = ctx.assets.GetSpriteFromNumberAtlas('retry.png');
    this.retryBtn.width = 400;
    this.retryBtn.height = 400;
    this.retryBtn.x = btnX;
    this.retryBtn.y = btnY;
    this.addChild(this.retryBtn);
    ctx.input.registerUI(
      new UIElement({ zIndex: 20, sprite: this.retryBtn, onTap: onRetry }),
    );

    this.nextBtn = ctx.assets.GetSpriteFromNumberAtlas('next.png');
    this.nextBtn.width = 400;
    this.nextBtn.height = 400;
    this.nextBtn.x = btnX;
    this.nextBtn.y = btnY;
    this.addChild(this.nextBtn);
    ctx.input.registerUI(
      new UIElement({ zIndex: 20, sprite: this.nextBtn, onTap: onNext }),
    );
  }

  public show(win: boolean): void {
    this.visible = true;
    this.retryBtn.visible = !win;
    this.nextBtn.visible = win;
  }

  public hide(): void {
    this.visible = false;
  }
}
