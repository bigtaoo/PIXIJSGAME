import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';
import { drawPanel } from './graphicsFactory';
import { ScreenConfig } from './screenConfig';
import { Orientation } from './enums';
import { GAME_WIDTH } from './consts';

// ── Layout ────────────────────────────────────────────────────────────────────

interface SettingsLayout {
  panelW: number;
  panelH: number;
  panelX: number;
  panelY: number;
  btnSize: number;
  btnY: number;
  btnLeftX: number;
  btnRightX: number;
}

function portraitLayout(): SettingsLayout {
  const panelW = 700,
    panelH = 400;
  const panelX = (GAME_WIDTH - panelW) / 2;
  const panelY = 760;
  const btnSize = 200;
  const btnY = panelY + panelH / 2 - btnSize / 2 + 20;
  return {
    panelW,
    panelH,
    panelX,
    panelY,
    btnSize,
    btnY,
    btnLeftX: panelX + 80,
    btnRightX: panelX + panelW - 80 - btnSize,
  };
}

function landscapeLayout(screenW: number): SettingsLayout {
  const panelW = 700,
    panelH = 400;
  const panelX = Math.round((screenW - panelW) / 2);
  const panelY = 340;
  const btnSize = 200;
  const btnY = panelY + panelH / 2 - btnSize / 2 + 20;
  return {
    panelW,
    panelH,
    panelX,
    panelY,
    btnSize,
    btnY,
    btnLeftX: panelX + 80,
    btnRightX: panelX + panelW - 80 - btnSize,
  };
}

function getLayout(screen: ScreenConfig): SettingsLayout {
  return screen.orientation === Orientation.Landscape
    ? landscapeLayout(screen.width)
    : portraitLayout();
}

// ── SettingsOverlay ───────────────────────────────────────────────────────────

export class SettingsOverlay extends PIXI.Container {
  private readonly bg: PIXI.Graphics;
  private readonly resumeBtn: PIXI.Sprite;
  private readonly lobbyBtn: PIXI.Sprite;
  private lastPanelW = 0;
  private lastPanelH = 0;

  constructor(ctx: AppContext, onResume: () => void, onGoLobby: () => void) {
    super();
    this.visible = false;

    this.bg = new PIXI.Graphics();
    this.addChild(this.bg);

    this.resumeBtn = new PIXI.Sprite(ctx.assets.GetTexture('next.png'));
    this.addChild(this.resumeBtn);
    ctx.input.registerUI(new UIElement({ zIndex: 20, sprite: this.resumeBtn, onTap: onResume }));

    this.lobbyBtn = new PIXI.Sprite(ctx.assets.GetTexture('lobby.png'));
    this.addChild(this.lobbyBtn);
    ctx.input.registerUI(new UIElement({ zIndex: 20, sprite: this.lobbyBtn, onTap: onGoLobby }));

    this.applyLayout(portraitLayout());
  }

  public resize(screen: ScreenConfig): void {
    this.applyLayout(getLayout(screen));
  }
  public show(): void {
    this.visible = true;
  }
  public hide(): void {
    this.visible = false;
  }

  private applyLayout(L: SettingsLayout): void {
    if (L.panelW !== this.lastPanelW || L.panelH !== this.lastPanelH) {
      this.bg.clear();
      drawPanel(this.bg, L.panelW, L.panelH);
      this.lastPanelW = L.panelW;
      this.lastPanelH = L.panelH;
    }
    this.bg.x = L.panelX;
    this.bg.y = L.panelY;

    this.resumeBtn.width = L.btnSize;
    this.resumeBtn.height = L.btnSize;
    this.resumeBtn.x = L.btnLeftX;
    this.resumeBtn.y = L.btnY;

    this.lobbyBtn.width = L.btnSize;
    this.lobbyBtn.height = L.btnSize;
    this.lobbyBtn.x = L.btnRightX;
    this.lobbyBtn.y = L.btnY;
  }
}
