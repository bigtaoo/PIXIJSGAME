import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';
import { ScreenConfig } from './screenConfig';
import { Orientation } from './enums';
import { GAME_WIDTH } from './consts';
import { BaseResultOverlay } from './baseResultOverlay';

// -- Star row dimensions (fixed, identical in both orientations) ---------------

const STAR_SIZE = 72;
const STAR_GAP = 8;
const TOTAL_STAR_W = 3 * STAR_SIZE + 2 * STAR_GAP;

// -- Layout -------------------------------------------------------------------

interface GameResultLayout {
  panelW: number;
  panelH: number;
  panelX: number;
  panelY: number;
  btnSize: number;
  btnY: number;
  btnLeftX: number;
  btnRightX: number;
  starRowX: number;
  starRowY: number;
}

function portraitLayout(screenH: number): GameResultLayout {
  const panelW = 700,
    panelH = 500;
  const panelX = (GAME_WIDTH - panelW) / 2;
  const panelY = Math.round((screenH - panelH) / 2);
  const btnSize = 200;
  const btnY = panelY + panelH / 2 - btnSize / 2 + 30;
  return {
    panelW,
    panelH,
    panelX,
    panelY,
    btnSize,
    btnY,
    btnLeftX: panelX + 80,
    btnRightX: panelX + panelW - 80 - btnSize,
    starRowX: panelX + panelW / 2 - TOTAL_STAR_W / 2,
    starRowY: panelY + 84,
  };
}

function landscapeLayout(screenW: number, screenH: number): GameResultLayout {
  const panelW = 700,
    panelH = 500;
  const panelX = Math.round((screenW - panelW) / 2);
  const panelY = Math.round((screenH - panelH) / 2);
  const btnSize = 200;
  const btnY = panelY + panelH / 2 - btnSize / 2 + 30;
  return {
    panelW,
    panelH,
    panelX,
    panelY,
    btnSize,
    btnY,
    btnLeftX: panelX + 80,
    btnRightX: panelX + panelW - 80 - btnSize,
    starRowX: panelX + panelW / 2 - TOTAL_STAR_W / 2,
    starRowY: panelY + 84,
  };
}

function getLayout(screen: ScreenConfig): GameResultLayout {
  return screen.orientation === Orientation.Landscape
    ? landscapeLayout(screen.width, screen.height)
    : portraitLayout(screen.height);
}

// -- Star reveal animation ----------------------------------------------------

const STAR_DELAY = 150;
const STAR_POP_DUR = 220;
const STAR_PEAK = 1.25;

interface StarAnim {
  starIndex: number;
  elapsed: number;
  filled: boolean;
}

// -- GameResultOverlay --------------------------------------------------------

export class GameResultOverlay extends BaseResultOverlay {
  private readonly nextBtn: PIXI.Sprite;
  private readonly starRow: PIXI.Container;
  private readonly starSprites: PIXI.Sprite[] = [];
  private starBaseScale = 1;
  private _lastLayout: GameResultLayout = portraitLayout(0);

  private starAnims: StarAnim[] = [];

  constructor(ctx: AppContext, onRetry: () => void, onNext: () => void, onLobby: () => void) {
    super(ctx, onRetry, onLobby, 20);

    this.nextBtn = new PIXI.Sprite(ctx.assets.GetTexture('next.png'));
    this.addChild(this.nextBtn);
    ctx.input.registerUI(new UIElement({ zIndex: 20, sprite: this.nextBtn, onTap: onNext }));

    // Build star row (3 stars, repositioned in applyLayout)
    this.starRow = new PIXI.Container();
    for (let i = 0; i < 3; i++) {
      const s = new PIXI.Sprite(ctx.assets.GetTexture('star.png'));
      s.width = STAR_SIZE;
      s.height = STAR_SIZE;
      // width/height above set scale implicitly; remember it so the pop
      // animation can scale relative to the 72px target, not the raw texture.
      this.starBaseScale = s.scale.x;
      s.x = i * (STAR_SIZE + STAR_GAP);
      s.tint = 0x888888;
      s.alpha = 0.35;
      this.starRow.addChild(s);
      this.starSprites.push(s);
    }
    this.addChild(this.starRow);

    this.applyLayout(portraitLayout(1920));
  }

  // -- Public API -------------------------------------------------------------

  public resize(screen: ScreenConfig): void {
    this.applyLayout(getLayout(screen));
  }

  public show(success: boolean, stars?: number): void {
    this.retryBtn.visible = !success;
    this.nextBtn.visible = success;

    const L = this._lastLayout;
    if (success) {
      this.lobbyBtn.x = L.btnLeftX;
      this.nextBtn.x = L.btnRightX;
    } else {
      this.retryBtn.x = L.btnLeftX;
      this.lobbyBtn.x = L.btnRightX;
    }

    const filled = success ? (stars ?? 0) : 0;

    this.starAnims = [];
    for (let i = 0; i < 3; i++) {
      this.starSprites[i].scale.set(0);
      this.starSprites[i].alpha = 1;
      this.starSprites[i].tint = i < filled ? 0xeab830 : 0x888888;
      this.starAnims.push({ starIndex: i, elapsed: 0, filled: i < filled });
    }

    this.visible = true;
  }

  // hide() inherited from BaseResultOverlay

  public update(deltaMs: number): void {
    if (this.starAnims.length === 0) return;

    for (const anim of this.starAnims) {
      anim.elapsed += deltaMs;

      const localT = anim.elapsed - anim.starIndex * STAR_DELAY;
      if (localT <= 0) continue;

      const sprite = this.starSprites[anim.starIndex];
      const targetAlpha = anim.filled ? 1.0 : 0.35;
      if (localT >= STAR_POP_DUR) {
        sprite.scale.set(this.starBaseScale);
        sprite.alpha = targetAlpha;
      } else {
        const t = localT / STAR_POP_DUR;
        let scale: number;
        if (t < 0.6) {
          scale = (t / 0.6) * STAR_PEAK;
        } else {
          scale = STAR_PEAK - (STAR_PEAK - 1.0) * ((t - 0.6) / 0.4);
        }
        sprite.scale.set(scale * this.starBaseScale);
        sprite.alpha = Math.min(targetAlpha, t * 3);
      }
    }

    const allDone = this.starAnims.every(
      (a) => a.elapsed - a.starIndex * STAR_DELAY >= STAR_POP_DUR
    );
    if (allDone) this.starAnims = [];
  }

  // -- Private ----------------------------------------------------------------

  private applyLayout(L: GameResultLayout): void {
    this._lastLayout = L;
    this.redrawPanel(L.panelW, L.panelH, L.panelX, L.panelY);

    this.retryBtn.width = L.btnSize;
    this.retryBtn.height = L.btnSize;
    this.retryBtn.x = L.btnLeftX;
    this.retryBtn.y = L.btnY;

    this.nextBtn.width = L.btnSize;
    this.nextBtn.height = L.btnSize;
    this.nextBtn.x = L.btnRightX;
    this.nextBtn.y = L.btnY;

    this.lobbyBtn.width = L.btnSize;
    this.lobbyBtn.height = L.btnSize;
    this.lobbyBtn.x = L.btnLeftX;
    this.lobbyBtn.y = L.btnY;

    this.starRow.x = L.starRowX;
    this.starRow.y = L.starRowY;
  }
}
