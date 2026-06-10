/**
 * baseResultOverlay.ts
 *
 * Abstract base for GameResultOverlay and DailyChallengeResult.
 * Provides: background panel, retry/lobby buttons, lastPanelW/H tracking,
 * and hide().
 */
import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';
import { drawPanel } from './graphicsFactory';

export abstract class BaseResultOverlay extends PIXI.Container {
  protected readonly bg: PIXI.Graphics;
  protected readonly retryBtn: PIXI.Sprite;
  protected readonly lobbyBtn: PIXI.Sprite;
  protected lastPanelW = 0;
  protected lastPanelH = 0;

  constructor(
    protected readonly ctx: AppContext,
    onRetry: () => void,
    onLobby: () => void,
    zIndex = 20
  ) {
    super();
    this.visible = false;

    this.bg = new PIXI.Graphics();
    this.addChild(this.bg);

    this.retryBtn = new PIXI.Sprite(ctx.assets.GetTexture('retry.png'));
    this.addChild(this.retryBtn);
    ctx.input.registerUI(new UIElement({ zIndex, sprite: this.retryBtn, onTap: onRetry }));

    this.lobbyBtn = new PIXI.Sprite(ctx.assets.GetTexture('lobby.png'));
    this.addChild(this.lobbyBtn);
    ctx.input.registerUI(new UIElement({ zIndex, sprite: this.lobbyBtn, onTap: onLobby }));
  }

  public hide(): void {
    this.visible = false;
  }

  /**
   * Redraw the background panel if the size changed, then position it.
   * Call this inside applyLayout() in the subclass.
   */
  protected redrawPanel(panelW: number, panelH: number, panelX: number, panelY: number): void {
    if (panelW !== this.lastPanelW || panelH !== this.lastPanelH) {
      this.bg.clear();
      drawPanel(this.bg, panelW, panelH);
      this.lastPanelW = panelW;
      this.lastPanelH = panelH;
    }
    this.bg.x = panelX;
    this.bg.y = panelY;
  }
}
