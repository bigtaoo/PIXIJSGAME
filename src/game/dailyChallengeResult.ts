/**
 * dailyChallengeResult.ts
 *
 * Result overlay shown when the 90-second Daily Challenge timer expires.
 */
import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { getDailyBestScore } from './dailyChallengeStore';
import { GAME_WIDTH } from './consts';
import { DigitDisplay } from './digitDisplay';
import { ScreenConfig } from './screenConfig';
import { BaseResultOverlay } from './baseResultOverlay';

// ── Layout ────────────────────────────────────────────────────────────────────

interface DailyChallengeResultLayout {
  panelW: number;
  panelH: number;
  panelX: number;
  panelY: number;
  scoreDigitW: number;
  scoreDigitH: number;
  scoreY: number;
  rowIconW: number;
  rowIconH: number;
  rowDigitW: number;
  rowDigitH: number;
  rowGap: number;
  bestRowY: number;
  btnSize: number;
  btnGap: number;
  btnY: number;
}

function buildLayout(screenW: number, screenH: number): DailyChallengeResultLayout {
  const panelW = 720,
    panelH = 520;
  const panelX = Math.round((screenW - panelW) / 2);
  const panelY = Math.round((screenH - panelH) / 2);
  const scoreDigitH = 110;
  const btnSize = 160;
  return {
    panelW,
    panelH,
    panelX,
    panelY,
    scoreDigitW: Math.round((scoreDigitH * 120) / 160),
    scoreDigitH,
    scoreY: panelY + 60,
    rowIconW: 36,
    rowIconH: 36,
    rowDigitW: Math.round((36 * 120) / 160),
    rowDigitH: 36,
    rowGap: 8,
    bestRowY: panelY + 220,
    btnSize,
    btnGap: 80,
    btnY: panelY + panelH - btnSize - 40,
  };
}

function getLayout(screen: ScreenConfig): DailyChallengeResultLayout {
  return buildLayout(screen.width, screen.height);
}

// ── DailyChallengeResult ───────────────────────────────────────────────────────

export class DailyChallengeResult extends BaseResultOverlay {
  private readonly scoreDisplay: DigitDisplay;

  private bestDisplay!: DigitDisplay;
  private bestRow!: PIXI.Container;

  private layout: DailyChallengeResultLayout;

  constructor(
    ctx: AppContext,
    private readonly onPlayAgain: () => void,
    private readonly onLobby_: () => void
  ) {
    super(ctx, onPlayAgain, onLobby_, 25);

    const L = buildLayout(GAME_WIDTH, Math.round((GAME_WIDTH * 16) / 9));
    this.layout = L;

    this.scoreDisplay = new DigitDisplay(ctx, L.scoreDigitW, L.scoreDigitH);
    this.scoreDisplay.update(0);
    this.addChild(this.scoreDisplay);

    this.buildIconRows(L);

    this.applyLayout(L);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public resize(screen: ScreenConfig): void {
    this.layout = getLayout(screen);
    this.applyLayout(this.layout);
  }

  public show(score: number, _isNewBest: boolean): void {
    const L = this.layout;
    const cx = L.panelX + L.panelW / 2;

    this.scoreDisplay.digitW = L.scoreDigitW;
    this.scoreDisplay.digitH = L.scoreDigitH;
    this.scoreDisplay.update(score);
    this.scoreDisplay.x = cx - this.scoreDisplay.totalWidth / 2;

    const best = getDailyBestScore();
    if (best > 0) {
      this.bestDisplay.update(best);
      const rowW = L.rowIconW + L.rowGap + this.bestDisplay.totalWidth;
      this.bestRow.x = cx - rowW / 2;
      this.bestRow.visible = true;
    } else {
      this.bestRow.visible = false;
    }

    this.ctx.platform?.submitDailyScore?.(score);
    this.visible = true;
  }

  // hide() inherited from BaseResultOverlay

  // ── Private ────────────────────────────────────────────────────────────────

  private buildIconRows(L: DailyChallengeResultLayout): void {
    // Best score row
    const bestCont = new PIXI.Container();
    const bestIcon = new PIXI.Sprite(this.ctx.assets.GetTexture('trophy.png'));
    bestIcon.width = L.rowIconW;
    bestIcon.height = L.rowIconH;
    bestIcon.x = 0;
    bestIcon.y = (L.rowDigitH - L.rowIconH) / 2;
    bestCont.addChild(bestIcon);
    this.bestDisplay = new DigitDisplay(this.ctx, L.rowDigitW, L.rowDigitH);
    this.bestDisplay.x = L.rowIconW + L.rowGap;
    bestCont.addChild(this.bestDisplay);
    this.bestRow = bestCont;
    this.addChild(this.bestRow);
  }

  private applyLayout(L: DailyChallengeResultLayout): void {
    this.redrawPanel(L.panelW, L.panelH, L.panelX, L.panelY);

    this.scoreDisplay.y = L.scoreY;

    this.bestRow.y = L.bestRowY;

    const totalW = L.btnSize * 2 + L.btnGap;
    const startX = L.panelX + (L.panelW - totalW) / 2;

    this.retryBtn.width = L.btnSize;
    this.retryBtn.height = L.btnSize;
    this.retryBtn.x = startX;
    this.retryBtn.y = L.btnY;

    this.lobbyBtn.width = L.btnSize;
    this.lobbyBtn.height = L.btnSize;
    this.lobbyBtn.x = startX + L.btnSize + L.btnGap;
    this.lobbyBtn.y = L.btnY;
  }
}
