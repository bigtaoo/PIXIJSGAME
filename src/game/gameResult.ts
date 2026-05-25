import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';
import { drawPanel } from './graphicsFactory';

// 星星行参数
const STAR_SIZE    = 72;
const STAR_GAP     = 8;
const TOTAL_STAR_W = 3 * STAR_SIZE + 2 * STAR_GAP;

export class GameResultOverlay extends PIXI.Container {
  private retryBtn:    PIXI.Sprite;
  private nextBtn:     PIXI.Sprite;
  private lobbyBtn:    PIXI.Sprite;
  private starRow!:    PIXI.Container;
  private starSprites: PIXI.Sprite[] = [];

  constructor(
    ctx: AppContext,
    onRetry: () => void,
    onNext:  () => void,
    onLobby: () => void,
  ) {
    super();
    this.visible = false;

    const PANEL_W = 700;
    const PANEL_H = 500;
    const PANEL_X = 190;
    const PANEL_Y = 710;

    const bg = new PIXI.Graphics();
    drawPanel(bg, PANEL_W, PANEL_H);
    bg.x = PANEL_X;
    bg.y = PANEL_Y;
    this.addChild(bg);

    const btnSize   = 200;
    const btnY      = PANEL_Y + PANEL_H / 2 - btnSize / 2 + 30;
    const btnLeftX  = PANEL_X + 80;
    const btnRightX = PANEL_X + PANEL_W - 80 - btnSize;

    this.retryBtn = new PIXI.Sprite(ctx.assets.GetTexture('retry.png'));
    this.retryBtn.width  = btnSize;
    this.retryBtn.height = btnSize;
    this.retryBtn.x = btnLeftX;
    this.retryBtn.y = btnY;
    this.addChild(this.retryBtn);
    ctx.input.registerUI(new UIElement({ zIndex: 20, sprite: this.retryBtn, onTap: onRetry }));

    this.nextBtn = new PIXI.Sprite(ctx.assets.GetTexture('next.png'));
    this.nextBtn.width  = btnSize;
    this.nextBtn.height = btnSize;
    this.nextBtn.x = btnLeftX;
    this.nextBtn.y = btnY;
    this.addChild(this.nextBtn);
    ctx.input.registerUI(new UIElement({ zIndex: 20, sprite: this.nextBtn, onTap: onNext }));

    this.lobbyBtn = new PIXI.Sprite(ctx.assets.GetTexture('lobby.png'));
    this.lobbyBtn.width  = btnSize;
    this.lobbyBtn.height = btnSize;
    this.lobbyBtn.x = btnRightX;
    this.lobbyBtn.y = btnY;
    this.addChild(this.lobbyBtn);
    ctx.input.registerUI(new UIElement({ zIndex: 20, sprite: this.lobbyBtn, onTap: onLobby }));

    // 3 颗星精灵（代替 "★☆" 文字）
    this.starRow = new PIXI.Container();
    this.starRow.x = PANEL_X + PANEL_W / 2 - TOTAL_STAR_W / 2;
    this.starRow.y = PANEL_Y + 84;
    for (let i = 0; i < 3; i++) {
      const s    = new PIXI.Sprite(ctx.assets.GetTexture('star.png'));
      s.width    = STAR_SIZE;
      s.height   = STAR_SIZE;
      s.x        = i * (STAR_SIZE + STAR_GAP);
      s.y        = 0;
      this.starRow.addChild(s);
      this.starSprites.push(s);
    }
    this.addChild(this.starRow);
  }

  public show(win: boolean, stars = 0): void {
    this.visible          = true;
    this.retryBtn.visible = !win;
    this.nextBtn.visible  = win;
    this.lobbyBtn.visible = true;
    this.starRow.visible  = win;

    if (win) {
      for (let i = 0; i < 3; i++) {
        const sp = this.starSprites[i]!;
        if (i < stars) {
          sp.tint  = 0xEAB830;  // 实心星——金色
          sp.alpha = 1.0;
        } else {
          sp.tint  = 0x888888;  // 空星——灰色半透明
          sp.alpha = 0.35;
        }
      }
    }
  }

  public hide(): void {
    this.visible = false;
  }
}
