import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';

/**
 * 游戏结果浮层（关卡胜利 / 失败）。
 *
 * 三个按钮：
 *   retryBtn  — 失败时显示，重试本关
 *   nextBtn   — 胜利时显示，进入下一关
 *   lobbyBtn  — 两种状态均显示，返回大厅
 *
 * show(win) 控制 retry / next 互斥；lobbyBtn 始终可见。
 */
export class GameResultOverlay extends PIXI.Container {
  private retryBtn: PIXI.Sprite;
  private nextBtn: PIXI.Sprite;
  private lobbyBtn: PIXI.Sprite;

  constructor(
    ctx: AppContext,
    onRetry: () => void,
    onNext: () => void,
    onLobby: () => void,
  ) {
    super();
    this.visible = false;

    const bg = ctx.assets.GetSpriteFromNumberAtlas('note.png');
    bg.width = 700;
    bg.height = 800;
    bg.x = 190;
    bg.y = 560;
    this.addChild(bg);

    const btnY = 720;
    const btnSize = 200;

    // 失败：重试按钮（左）
    this.retryBtn = ctx.assets.GetSpriteFromNumberAtlas('retry.png');
    this.retryBtn.width = btnSize;
    this.retryBtn.height = btnSize;
    this.retryBtn.x = 230;
    this.retryBtn.y = btnY;
    this.addChild(this.retryBtn);
    ctx.input.registerUI(
      new UIElement({ zIndex: 20, sprite: this.retryBtn, onTap: onRetry }),
    );

    // 胜利：下一关按钮（左）
    this.nextBtn = ctx.assets.GetSpriteFromNumberAtlas('next.png');
    this.nextBtn.width = btnSize;
    this.nextBtn.height = btnSize;
    this.nextBtn.x = 230;
    this.nextBtn.y = btnY;
    this.addChild(this.nextBtn);
    ctx.input.registerUI(
      new UIElement({ zIndex: 20, sprite: this.nextBtn, onTap: onNext }),
    );

    // 大厅按钮（右，始终显示）
    this.lobbyBtn = ctx.assets.GetSpriteFromNumberAtlas('clock.png');
    this.lobbyBtn.width = btnSize;
    this.lobbyBtn.height = btnSize;
    this.lobbyBtn.x = 470;
    this.lobbyBtn.y = btnY;
    this.addChild(this.lobbyBtn);
    ctx.input.registerUI(
      new UIElement({ zIndex: 20, sprite: this.lobbyBtn, onTap: onLobby }),
    );
  }

  /** win=true 显示"下一关"，win=false 显示"重试" */
  public show(win: boolean): void {
    this.visible = true;
    this.retryBtn.visible = !win;
    this.nextBtn.visible = win;
    this.lobbyBtn.visible = true;
  }

  public hide(): void {
    this.visible = false;
  }
}
