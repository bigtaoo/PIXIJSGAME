import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';
import { drawPanel } from './graphicsFactory';
import { ScreenConfig } from './screenConfig';
import { Orientation } from './enums';
import { GAME_WIDTH } from './consts';

// -- Star row dimensions (fixed, identical in both orientations) ---------------

const STAR_SIZE    = 72;
const STAR_GAP     = 8;
const TOTAL_STAR_W = 3 * STAR_SIZE + 2 * STAR_GAP;

// -- Layout -------------------------------------------------------------------

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

function portraitLayout(screenH: number): GameResultLayout {
  const panelW = 700, panelH = 500;
  const panelX = (GAME_WIDTH - panelW) / 2;
  const panelY = Math.round((screenH - panelH) / 2);
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

function landscapeLayout(screenW: number, screenH: number): GameResultLayout {
  const panelW = 700, panelH = 500;
  const panelX = Math.round((screenW - panelW) / 2);
  const panelY = Math.round((screenH - panelH) / 2);
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
    ? landscapeLayout(screen.width, screen.height)
    : portraitLayout(screen.height);
}

// -- Star reveal animation ----------------------------------------------------

/** Delay before each star pops in (ms). Star i starts at i * STAR_DELAY. */
const STAR_DELAY    = 150;
/** Duration of the scale pop for each star (ms). */
const STAR_POP_DUR  = 220;
/** Peak scale overshoot before settling at 1.0. */
const STAR_PEAK     = 1.25;

interface StarAnim {
  /** Index into starSprites (0-2). */
  starIndex: number;
  /** Total elapsed since show() was called (ms). */
  elapsed:   number;
  /** Whether this star should be filled (gold) or empty (grey). */
  filled:    boolean;
}

// -- GameResultOverlay --------------------------------------------------------

export class GameResultOverlay extends PIXI.Container {
  private readonly bg:          PIXI.Graphics;
  private readonly retryBtn:    PIXI.Sprite;
  private readonly nextBtn:     PIXI.Sprite;
  private readonly lobbyBtn:    PIXI.Sprite;
  private readonly starRow:     PIXI.Container;
  private readonly starSprites: PIXI.Sprite[] = [];
  private lastPanelW = 0;
  private lastPanelH = 0;
  private _lastLayout: GameResultLayout = portraitLayout(0);

  /** Running star animations; empty when all done. */
  private starAnims: StarAnim[] = [];

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
      const s = new PIXI.Sprite(ctx.assets.GetTexture('star.png'));
      s.width  = STAR_SIZE;
      s.height = STAR_SIZE;
      s.x = i * (STAR_SIZE + STAR_GAP);
      s.tint  = 0x888888;
      s.alpha = 0.35;
      this.starRow.addChild(s);
      this.starSprites.push(s);
    }
    this.addChild(this.starRow);

    // Placeholder layout; resize() must be called with the real ScreenConfig before show().
    this.applyLayout(portraitLayout(1920));
  }

  // -- Public API -------------------------------------------------------------

  public resize(screen: ScreenConfig): void {
    this.applyLayout(getLayout(screen));
  }

  public show(success: boolean, stars?: number): void {
    this.retryBtn.visible = !success;
    this.nextBtn.visible  = success;

    // On success:  [lobby | next]  (left | right)
    // On failure:  [retry | lobby] (left | right)
    const L = this._lastLayout;
    if (success) {
      this.lobbyBtn.x = L.btnLeftX;
      this.nextBtn.x  = L.btnRightX;
    } else {
      this.retryBtn.x = L.btnLeftX;
      this.lobbyBtn.x = L.btnRightX;
    }

    const filled = success ? (stars ?? 0) : 0;

    // Reset all stars to hidden initial state; animations will reveal them.
    this.starAnims = [];
    for (let i = 0; i < 3; i++) {
      this.starSprites[i].scale.set(0);
      this.starSprites[i].alpha = 1;
      this.starSprites[i].tint  = i < filled ? 0xEAB830 : 0x888888;
      this.starAnims.push({ starIndex: i, elapsed: 0, filled: i < filled });
    }

    this.visible = true;
  }

  public hide(): void {
    this.starAnims = [];
    this.visible = false;
  }

  /**
   * Advance star reveal animations. Call once per frame from GameScene.update()
   * whenever the overlay is visible.
   */
  public update(deltaMs: number): void {
    if (this.starAnims.length === 0) return;

    for (const anim of this.starAnims) {
      anim.elapsed += deltaMs;

      // Each star starts after its staggered delay.
      const localT = anim.elapsed - anim.starIndex * STAR_DELAY;
      if (localT <= 0) continue;

      const sprite = this.starSprites[anim.starIndex];
      if (localT >= STAR_POP_DUR) {
        // Animation finished - snap to final state.
        sprite.scale.set(1);
        sprite.alpha = anim.filled ? 1.0 : 0.35;
      } else {
        // Pop-in: scale 0 -> STAR_PEAK -> 1.0, alpha ramps up quickly.
        const t = localT / STAR_POP_DUR; // 0..1
        let scale: number;
        if (t < 0.6) {
          // Phase 1: spring up to peak
          scale = (t / 0.6) * STAR_PEAK;
        } else {
          // Phase 2: settle back to 1.0
          scale = STAR_PEAK - (STAR_PEAK - 1.0) * ((t - 0.6) / 0.4);
        }
        sprite.scale.set(scale);
        sprite.alpha = Math.min(1, t * 3);
        // For unfilled stars, blend to lower final alpha
        if (!anim.filled && t >= 1) sprite.alpha = 0.35;
      }
    }

    // Purge completed anims
    const allDone = this.starAnims.every(
      (a) => a.elapsed - a.starIndex * STAR_DELAY >= STAR_POP_DUR,
    );
    if (allDone) this.starAnims = [];
  }

  // -- Private ----------------------------------------------------------------

  private applyLayout(L: GameResultLayout): void {
    this._lastLayout = L;
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
