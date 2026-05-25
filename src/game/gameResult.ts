import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';
import { drawPanel } from './graphicsFactory';
import { ScreenConfig } from './screenConfig';
import { Orientation } from './enums';
import { GAME_WIDTH } from './consts';

// ── 星星行尺寸（固定，两种方向相同）────────────────────────────────────────────

const STAR_SIZE    = 72;
const STAR_GAP     = 8;
const TOTAL_STAR_W = 3 * STAR_SIZE + 2 * STAR_GAP;

// ── Layout ────────────────────────────────────────────────────────────────────

interface GameResultLayout {
  panelW:    number;
  panelH:    number;
  panelX:    number;
  panelY:    number;
  btnSize:   number;
  btnY:      number;
  btnLeftX:  number;
  btnRightX: number;
  starRowX:  number;
  starRowY:  number;
}

function portraitLayout(): GameResultLayout {
  const panelW = 700, panelH = 500;
  const panelX = (GAME_WIDTH - panelW) / 2;   // 190
  const panelY = 710;
  const btnSize = 200;
  const btnY    = panelY + panelH / 2 - btnSize / 2 + 30;
  return {
    panelW, panelH, panelX, panelY, btnSize, btnY,
    btnLeftX:  panelX + 80,
    btnRightX: panelX + panelW - 80 - btnSize,
    starRowX:  panelX + panelW / 2 - TOTAL_STAR_W / 2,
    starRowY:  panelY + 84,
  };
}

function landscapeLayout(screenW: number): GameResultLayout {
  const panelW = 700, panelH = 500;
  const panelX = Math.round((screenW - panelW) / 2);
  const panelY = 290;
  const btnSize = 200;
  const btnY    = panelY + panelH / 2 - btnSize / 2 + 30;
  return {
    panelW, panelH, panelX, panelY, btnSize, btnY,
    btnLeftX:  panelX + 80,
    btnRightX: panelX + panelW - 80 - btnSize,
    starRowX:  panelX + panelW / 2 - TOTAL_STAR_W / 2,
    starRowY:  panelY + 84,
  };
}

function getLayout(screen: ScreenConfig): GameResultLayout {
  return screen.orientation === Orientation.Landscape
    ? landscapeLayout(screen.width)
    : portraitLayout();
}

// ── GameResultOverlay ─────────────────────────────────────────────────────────

export class GameResultOverlay extends PIXI.Container {
  private readonly bg:          PIXI.Graphics;
  private readonly retryBtn:    PIXI.Sprite;
  private readonly nextBtn:     PIXI.Sprite;
  private readonly lobbyBtn:    PIXI.Sprite;
  private readonly starRow:     PIXI.Container;
  private readonly starSprites: PIXI.Sprite[] = [];
  private lastPanelW = 0;
  private lastPanelH = 0;

  constructor(
    private readonly ctx: AppContext,
    onRetry: () => void,
    onNext:  () => void,
    onLobby: () => void,
  ) {
    super();
    this.visible = false;

    this.bg = new PIXI.Graphics();
    this.addChild(this.bg);

    this.retryBtn = new PIXI.Sprite(ctx.assets.GetTexture('retry.png'));
    this.addChild(this.retryBtn);
    ctx.input.registerUI(new UIElement({ zIndex: 20, sprite: this.retryBtn, onTap: onRetry }));

    this.nextBtn = new PIXI.Sprite(ctx.assets.GetTexture('next.png'));
    this.addChild(this.nextBtn);
    ctx.input.registerUI(new UIElement({ zIndex: 20, sprite: this.nextBtn, onTap: onNext }));

    this.lobbyBtn = new PIXI.Sprite(ctx.assets.GetTexture('lobby.png'));
    this.addChild(this.lobbyBtn);
    ctx.input.registerUI(new UIElement({ zIndex: 20, sprite: this.lobbyBtn, onTap: onLobby }));

    // Build star row (3 stars, repositioned in applyLayout)
    this.starRow = new PIXI.Container();
    for (let i = 0; i < 3; i++) {
      const s = new PIXI.Sprite(ctx.assets.GetTexture('star_empty.png'));
      s.width  = STAR_SIZE;
      s.height = STAR_SIZE;
      s.x = i * (STAR_SIZE + STAR_GAP);
      this.starRow.addChild(s);
      this.starSprites.push(s);
    }
    this.addChild(this.starRow);

    this.applyLayout(portraitLayout());
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public resize(screen: ScreenConfig): void {
    this.applyLayout(getLayout(screen));
  }

  public show(success: boolean, stars?: number): void {
    this.retryBtn.visible = !success;
    this.nextBtn.visible  = success;

    const filled = success ? (stars ?? 0) : 0;
    for (let i = 0; i < 3; i++) {
      this.starSprites[i].texture =
        this.ctx.assets.GetTexture(i < filled ? 'star_filled.png' : 'star_empty.png');
    }

    this.visible = true;
  }

  public hide(): void { this.visible = false; }

  // ── Private ────────────────────────────────────────────────────────────────

  private applyLayout(L: GameResultLayout): void {
    if (L.panelW !== this.lastPanelW || L.panelH !== this.lastPanelH) {
      this.bg.clear();
      drawPanel(this.bg, L.panelW, L.panelH);
      this.lastPanelW = L.panelW;
      this.lastPanelH = L.panelH;
    }
    this.bg.x = L.panelX; this.bg.y = L.panelY;

    this.retryBtn.width  = L.btnSize; this.retryBtn.height = L.btnSize;
    this.retryBtn.x = L.btnLeftX;    this.retryBtn.y = L.btnY;

    this.nextBtn.width  = L.btnSize; this.nextBtn.height = L.btnSize;
    this.nextBtn.x = L.btnRightX;   this.nextBtn.y = L.btnY;

    this.lobbyBtn.width  = L.btnSize; this.lobbyBtn.height = L.btnSize;
    this.lobbyBtn.x = L.btnLeftX;    this.lobbyBtn.y = L.btnY;

    this.starRow.x = L.starRowX;
    this.starRow.y = L.starRowY;
  }
}
