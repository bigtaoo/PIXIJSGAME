import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';
import { drawPanel, C } from './graphicsFactory';

export class GameResultOverlay extends PIXI.Container {
  private retryBtn:  PIXI.Sprite;
  private nextBtn:   PIXI.Sprite;
  private lobbyBtn:  PIXI.Sprite;
  private starText!: PIXI.Text;

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

    // Star display shown on win
    this.starText = new PIXI.Text('', {
      fontFamily: 'Arial',
      fontSize:   72,
      fill:       0xEAB830,
    });
    this.starText.anchor.set(0.5, 0.5);
    this.starText.x = PANEL_X + PANEL_W / 2;
    this.starText.y = PANEL_Y + 120;
    this.addChild(this.starText);
  }

  public show(win: boolean, stars = 0): void {
    this.visible          = true;
    this.retryBtn.visible = !win;
    this.nextBtn.visible  = win;
    this.lobbyBtn.visible = true;
    this.starText.visible = win;
    if (win) {
      this.starText.text  = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      this.starText.style.fill = stars === 3 ? 0xEAB830 : C.icon;
    }
  }

  public hide(): void {
    this.visible = false;
  }
}
