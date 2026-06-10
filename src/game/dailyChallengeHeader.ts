/**
 * dailyChallengeHeader.ts
 *
 * Header bar for the Daily Challenge scene.
 * Extends BaseHeader for clock, music button, tip formula, and slot rendering.
 */
import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { Orientation } from './enums';
import { UIElement } from '../inputSystem/uiElement';
import { drawHeaderBar } from './graphicsFactory';
import { DigitDisplay } from './digitDisplay';
import { GAME_WIDTH, OFFSET_Y } from './consts';
import { getDailyTarget } from './dailyChallengeConfig';
import { BaseHeader, TipLayout } from './baseHeader';

// ── Header-bar bounds (exported for ScreenConfig.setGridBounds) ───────────────

export const DC_HEADER_X_PORTRAIT      = 20;
export const DC_HEADER_BAR_W_PORTRAIT  = GAME_WIDTH - 40; // 1040
export const DC_HEADER_X_LANDSCAPE     = 480;
export const DC_HEADER_BAR_W_LANDSCAPE = 1300;

/** Seconds at which the DC timer is considered "full" (hand at 12 o'clock). */
const DC_TIMER_REF_SECS = 90;

// ── Layout interface ──────────────────────────────────────────────────────────

export interface DCHeaderLayout extends TipLayout {
  barX: number; barY: number; barW: number; barH: number;
  backIconX: number; backIconY: number; backIconH: number;
  hitX: number; hitY: number; hitW: number; hitH: number;
  clockX: number; clockY: number; clockSize: number;
  timerRightX: number; timerY: number; timerDigitH: number;
  trophyX: number; trophyY: number; trophySize: number;
  scoreX: number; scoreY: number; scoreDigitH: number;
  dcIconX: number; dcIconY: number; dcIconSize: number;
  musicX: number;  musicY: number;  musicSize: number;
}

// ── Layout functions ──────────────────────────────────────────────────────────

export function portraitDCLayout(): DCHeaderLayout {
  const barX = DC_HEADER_X_PORTRAIT;
  const barW = DC_HEADER_BAR_W_PORTRAIT;
  const barH = 260;

  const r1 = 65;
  const r2 = 195;

  const backIconH = 90;
  const backIconX = barX + 15;
  const backIconY = Math.round(barH / 2 - backIconH / 2);

  const slotW = Math.round(62 * 1.2);
  const slotH = Math.round(74 * 1.2);
  const tipY  = Math.round(r1 - slotH / 2);
  const tip0  = 145;

  const btnSize   = 102;
  const rightEdge = barX + barW;
  const dcIconX   = rightEdge - btnSize - 12 - 50;
  const musicX    = dcIconX - btnSize - 8;
  const btnY      = Math.round(barH / 2 - btnSize / 2);

  const clockSize   = Math.round(88 * 1.2);
  const clockX      = 145;
  const clockY      = Math.round(r2 - clockSize / 2);
  const timerDigitH = 66;
  const timerY      = Math.round(r2 - timerDigitH / 2);
  const timerRightX = clockX + clockSize + 130;

  const trophySize = 80;
  const trophyX    = timerRightX + 70;
  const trophyY    = Math.round(r2 - trophySize / 2);
  const scoreDigitH = 66;
  const scoreX     = trophyX + trophySize + 10;
  const scoreY     = Math.round(r2 - scoreDigitH / 2);

  return {
    barX, barY: 10, barW, barH,
    backIconX, backIconY, backIconH,
    hitX: barX, hitY: 80, hitW: 145, hitH: 160,
    clockX, clockY, clockSize,
    timerRightX, timerY, timerDigitH,
    trophyX, trophyY, trophySize,
    scoreX, scoreY, scoreDigitH,
    tipY, tipSlotW: slotW, tipSlotH: slotH,
    tipSlot1X: tip0,
    tipPlusX:  tip0 + (slotW + 8),
    tipSlot2X: tip0 + (slotW + 8) * 2,
    tipEquaX:  tip0 + (slotW + 8) * 3,
    tipTargetX: tip0 + (slotW + 8) * 4,
    tipTargetStep: Math.round(66 * 1.2),
    dcIconX, dcIconY: btnY, dcIconSize: btnSize,
    musicX,  musicY:  btnY, musicSize:  btnSize,
  };
}

export function landscapeDCLayout(): DCHeaderLayout {
  const barX = DC_HEADER_X_LANDSCAPE;
  const barW = DC_HEADER_BAR_W_LANDSCAPE;
  const barH = OFFSET_Y - 20;
  const cy   = 10 + barH / 2;

  const slotW = 65, slotH = 80;
  const tipY  = Math.round(cy - slotH / 2);

  const clockSize = 90;
  const clockCx   = barX + barW / 2;
  const clockX    = clockCx - clockSize / 2;
  const clockY    = cy - clockSize / 2;

  const timerDigitH  = 65;
  const timerY       = Math.round(cy - timerDigitH / 2);
  const timerRightX  = clockCx + clockSize / 2 + 120;

  const btnSize   = 78;
  const rightEdge = barX + barW;
  const dcIconX   = rightEdge - btnSize - 12;
  const musicX    = dcIconX - btnSize - 10;
  const btnY      = Math.round(cy - btnSize / 2);

  const trophySize   = 90;
  const trophyX      = timerRightX + 40 + 20;
  const trophyY      = Math.round(cy - trophySize / 2);

  const scoreDigitH  = 65;
  const scoreY       = Math.round(cy - scoreDigitH / 2);
  const scoreX       = trophyX + trophySize + 12;

  return {
    barX, barY: 10, barW, barH,
    backIconX: barX + 15, backIconY: Math.round(cy - 40), backIconH: 80,
    hitX: barX, hitY: 80, hitW: 145, hitH: 160,
    clockX, clockY, clockSize,
    timerRightX, timerY, timerDigitH,
    trophyX, trophyY, trophySize,
    scoreX, scoreY, scoreDigitH,
    tipY, tipSlotW: slotW, tipSlotH: slotH,
    tipSlot1X: barX + 30,
    tipPlusX:  barX + 30 + slotW + 8,
    tipSlot2X: barX + 30 + (slotW + 8) * 2,
    tipEquaX:  barX + 30 + (slotW + 8) * 3,
    tipTargetX: barX + 30 + (slotW + 8) * 4,
    tipTargetStep: 68,
    dcIconX, dcIconY: btnY, dcIconSize: btnSize,
    musicX,  musicY:  btnY, musicSize:  btnSize,
  };
}

export function getDCLayout(screen: ScreenConfig): DCHeaderLayout {
  return screen.orientation === Orientation.Landscape
    ? landscapeDCLayout()
    : portraitDCLayout();
}

// ── DailyChallengeHeader ──────────────────────────────────────────────────────

export class DailyChallengeHeader extends BaseHeader {
  private readonly bar:           PIXI.Graphics;
  private readonly trophySprite:  PIXI.Sprite;
  private readonly scoreDisplay:  DigitDisplay;
  private readonly timerDisplay:  DigitDisplay;

  private dcIconSprite!: PIXI.Sprite;
  private layout:        DCHeaderLayout;

  constructor(
    ctx:       AppContext,
    private readonly onGoLobby: () => void,
    screen: ScreenConfig,
  ) {
    super(ctx);

    // Grey slot style (DC mode)
    this.emptySlotBorderColor = 0xBBBBBB;
    this.emptySlotBorderAlpha = 1;
    this.emptySlotBorderWidth = 3;
    this.emptySlotFillColor   = 0xF0F0F0;
    this.tipSymbolFullSize    = true;

    this.layout = getDCLayout(screen);
    const L = this.layout;

    // ── Background bar ───────────────────────────────────────────────────
    this.bar = new PIXI.Graphics();
    drawHeaderBar(this.bar, L.barW, L.barH);
    this.bar.x = L.barX; this.bar.y = L.barY;
    this.addChild(this.bar);

    // ── Clock ────────────────────────────────────────────────────────────
    this.buildClock(L.clockX, L.clockY, L.clockSize);

    // ── Countdown digits ─────────────────────────────────────────────────
    this.timerDisplay = new DigitDisplay(
      ctx,
      Math.round(L.timerDigitH * 120 / 160),
      L.timerDigitH,
    );
    this.timerDisplay.y = L.timerY;
    this.addChild(this.timerDisplay);

    // ── Trophy icon ──────────────────────────────────────────────────────
    this.trophySprite = new PIXI.Sprite(ctx.assets.GetTexture('trophy.png'));
    this.trophySprite.width  = L.trophySize;
    this.trophySprite.height = L.trophySize;
    this.trophySprite.x      = L.trophyX;
    this.trophySprite.y      = L.trophyY;
    this.addChild(this.trophySprite);

    // ── Score digits ─────────────────────────────────────────────────────
    this.scoreDisplay = new DigitDisplay(
      ctx,
      Math.round(L.scoreDigitH * 120 / 160),
      L.scoreDigitH,
    );
    this.scoreDisplay.y = L.scoreY;
    this.addChild(this.scoreDisplay);

    // ── Top-right: music + dc-icon buttons ───────────────────────────────
    this.buildMusicButton(L.musicX, L.musicY, L.musicSize);
    this.buildDcIconButton(L);

    // ── Hint formula ─────────────────────────────────────────────────────
    this.rebuildTip(null, null);
  }

  // ── Abstract implementations ──────────────────────────────────────────────
  protected getTarget(): number { return getDailyTarget(); }
  protected getCurrentTipLayout(): TipLayout { return this.layout; }

  // ── Public API ──────────────────────────────────────────────────────────────

  public resize(screen: ScreenConfig): void {
    this.layout = getDCLayout(screen);
    const L = this.layout;

    this.bar.clear();
    drawHeaderBar(this.bar, L.barW, L.barH);
    this.bar.x = L.barX; this.bar.y = L.barY;

    this.resizeClock(L.clockX, L.clockY, L.clockSize);

    this.timerDisplay.digitW = Math.round(L.timerDigitH * 120 / 160);
    this.timerDisplay.digitH = L.timerDigitH;
    this.timerDisplay.y      = L.timerY;

    this.trophySprite.width  = L.trophySize;
    this.trophySprite.height = L.trophySize;
    this.trophySprite.x      = L.trophyX;
    this.trophySprite.y      = L.trophyY;

    this.scoreDisplay.digitW = Math.round(L.scoreDigitH * 120 / 160);
    this.scoreDisplay.digitH = L.scoreDigitH;
    this.scoreDisplay.y      = L.scoreY;

    this.musicSprite.width  = L.musicSize;
    this.musicSprite.height = L.musicSize;
    this.musicSprite.x      = L.musicX;
    this.musicSprite.y      = L.musicY;

    const dcScale = L.dcIconSize / Math.max(this.dcIconSprite.texture.width, this.dcIconSprite.texture.height);
    this.dcIconSprite.width  = this.dcIconSprite.texture.width  * dcScale;
    this.dcIconSprite.height = this.dcIconSprite.texture.height * dcScale;
    this.dcIconSprite.x = L.dcIconX + (L.dcIconSize - this.dcIconSprite.width)  / 2;
    this.dcIconSprite.y = L.dcIconY + (L.dcIconSize - this.dcIconSprite.height) / 2;

    this.rebuildTip(null, null);
  }

  public setScore(score: number): void {
    this.scoreDisplay.update(score);
    this.scoreDisplay.x = this.layout.scoreX;
  }

  public setTimer(secs: number): void {
    this.timerDisplay.update(secs);
    this.timerDisplay.x = this.layout.timerRightX - this.timerDisplay.totalWidth;

    const ratio = Math.min(Math.max(secs, 0) / DC_TIMER_REF_SECS, 1);
    this.clockHand.rotation = Math.PI + (1 - ratio) * Math.PI * 2;

    const warn = secs > 0 && secs < BaseHeader.WARN_THRESHOLD;
    const tint  = warn ? 0xFF5252 : 0xFFFFFF;
    this.clockFace.tint     = tint;
    this.clockHand.tint     = tint;
    this.timerDisplay.tint  = tint;
  }

  public rebuildTip(first: number | null, second: number | null): void {
    this.rebuildTipContainer(first, second, this.layout);
  }

  public getScoreCenterPos(): { x: number; y: number } {
    return {
      x: this.layout.scoreX + this.scoreDisplay.totalWidth / 2,
      y: this.layout.scoreY + this.layout.scoreDigitH / 2,
    };
  }

  public startTipResultTimer(): void {
    this.tipResultElapsed = 0;
  }

  public tickTipReset(deltaMs: number): void {
    this.tickTipResultReset(deltaMs);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private buildDcIconButton(L: DCHeaderLayout): void {
    const dcBtn = new PIXI.Sprite(this.ctx.assets.GetTexture('daily_challenge_icon.png'));
    const scale  = L.dcIconSize / Math.max(dcBtn.texture.width, dcBtn.texture.height);
    dcBtn.width  = dcBtn.texture.width  * scale;
    dcBtn.height = dcBtn.texture.height * scale;
    dcBtn.x = L.dcIconX + (L.dcIconSize - dcBtn.width)  / 2;
    dcBtn.y = L.dcIconY + (L.dcIconSize - dcBtn.height) / 2;
    this.dcIconSprite = dcBtn;
    this.addChild(dcBtn);
    this.ctx.input.registerUI(new UIElement({
      zIndex: 15,
      sprite: dcBtn,
      onTap: () => this.onGoLobby(),
    }));
  }
}
