import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';
import { drawPanel } from './graphicsFactory';

export class SettingsOverlay extends PIXI.Container {
  constructor(
    ctx: AppContext,
    onResume:  () => void,
    onGoLobby: () => void,
  ) {
    super();
    this.visible = false;

    const PANEL_W = 700;
    const PANEL_H = 400;
    const PANEL_X = 190;
    const PANEL_Y = 760;

    const bg = new PIXI.Graphics();
    drawPanel(bg, PANEL_W, PANEL_H);
    bg.x = PANEL_X;
    bg.y = PANEL_Y;
    this.addChild(bg);

    const btnSize   = 200;
    const btnY      = PANEL_Y + PANEL_H / 2 - btnSize / 2 + 20;
    const btnLeftX  = PANEL_X + 80;
    const btnRightX = PANEL_X + PANEL_W - 80 - btnSize;

    const resumeBtn   = new PIXI.Sprite(ctx.assets.GetTexture('next.png'));
    resumeBtn.width   = btnSize;
    resumeBtn.height  = btnSize;
    resumeBtn.x       = btnLeftX;
    resumeBtn.y       = btnY;
    this.addChild(resumeBtn);
    ctx.input.registerUI(new UIElement({ zIndex: 20, sprite: resumeBtn, onTap: onResume }));

    const lobbyBtn    = new PIXI.Sprite(ctx.assets.GetTexture('lobby.png'));
    lobbyBtn.width    = btnSize;
    lobbyBtn.height   = btnSize;
    lobbyBtn.x        = btnRightX;
    lobbyBtn.y        = btnY;
    this.addChild(lobbyBtn);
    ctx.input.registerUI(new UIElement({ zIndex: 20, sprite: lobbyBtn, onTap: onGoLobby }));
  }

  public show(): void { this.visible = true;  }
  public hide(): void { this.visible = false; }
}
