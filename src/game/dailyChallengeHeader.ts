/**
 * dailyChallengeHeader.ts
 *
 * Header bar for the Daily Challenge scene.
 *
 * Layout (both orientations):
 *   Top-right corner : music-toggle button + leaderboard/lobby icon (small)
 *   Main content row : [formula] … [clock + timer] … [trophy + score]
 *   All main-row elements are vertically centred within the bar.
 *
 * Public API:
 *   new DailyChallengeHeader(ctx, onGoLobby, screen)
 *   header.resize(screen)
 *   header.setScore(n)
 *   header.setTimer(secs)
 *   header.rebuildTip(first, second)
 *   header.tickTipReset(deltaMs)
 *   header.startTipResultTimer()
 *   header.getScoreCenterPos()
 */
import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { Orientation } from './enums';
import { UIElement } from '../inputSystem/uiElement';
import { drawHeaderBar, drawQuestionMark } from './graphicsFactory';
import { DigitDisplay } from './digitDisplay';
import { GAME_WIDTH, OFFSET_Y } from './consts';
import { getDailyTarget } from './dailyChallengeConfig';

// ── Header-bar bounds (exported for ScreenConfig.setGridBounds) ───────────────

export const DC_HEADER_X_PORTRAIT     = 20;
export const DC_HEADER_BAR_W_PORTRAIT  = GAME_WIDTH - 40; // 1040
export const DC_HEADER_X_LANDSCAPE    = 480;
export const DC_HEADER_BAR_W_LANDSCAPE = 1300;

/** Seconds at which the DC timer is considered "full" (hand at 12 o'clock). */
const DC_TIMER_REF_SECS = 90;
const WARN_THRESHOLD    = 10;
const RESULT_DISPLAY_MS = 500;

// ── Layout interface ──────────────────────────────────────────────────────────

export interface DCHeaderLayout {
  barX: number; barY: number; barW: number; barH: number;
  // Back/lobby icon (top-left, doubles as lobby button hit-area)
  backIconX: number; backIconY: number; backIconH: number;
  hitX: number; hitY: number; hitW: number; hitH: number;
  // Clock face (same design as game header)
  clockX: number; clockY: number; clockSize: number;
  // Countdown digits, right-aligned to timerRightX
  timerRightX: number; timerY: number; timerDigitH: number;
  // Trophy icon before score
  trophyX: number; trophyY: number; trophySize: number;
  // Score display, left-aligned from scoreX
  scoreX: number; scoreY: number; scoreDigitH: number;
  // Hint formula
  tipY: number; tipSlotW: number; tipSlotH: number;
  tipSlot1X: number; tipPlusX: number;
  tipSlot2X: number; tipEquaX: number;
  tipTargetX: number; tipTargetStep: number;
  // Top-right small buttons
  dcIconX: number; dcIconY: number; dcIconSize: number;
  musicX: number;  musicY: number;  musicSize: number;
}

// ── Layout functions ──────────────────────────────────────────────────────────

export function portraitDCLayout(): DCHeaderLayout {
  const barX = DC_HEADER_X_PORTRAIT;
  const barW = DC_HEADER_BAR_W_PORTRAIT;
  const barH = 260;

  // Two-row layout:
  //   Row 1 (centre y ≈ 65):  hint formula (left) + music / dc-icon buttons (right)
  //   Row 2 (centre y ≈ 195): clock + timer (left) + trophy + score (right)
  const r1 = 65;
  const r2 = 195;

  // Back icon — vertically centred across the full bar height
  const backIconH = 90;
  const backIconX = barX + 15;
  const backIconY = Math.round(barH / 2 - backIconH / 2); // 85

  // Hint formula (row 1) — 1.2×
  const slotW = Math.round(62 * 1.2);  // 74
  const slotH = Math.round(74 * 1.2);  // 89
  const tipY  = Math.round(r1 - slotH / 2);  // 21
  const tip0  = 145;                           // start after back icon

  // Buttons (right side) — vertically centred in bar, shifted -50px left
  const btnSize   = 102;
  const rightEdge = barX + barW;                          // 1060
  const dcIconX   = rightEdge - btnSize - 12 - 50;        // 896
  const musicX    = dcIconX - btnSize - 8;                 // 786
  const btnY      = Math.round(barH / 2 - btnSize / 2);   // 79

  // Clock + timer (row 2) — clock 1.2×
  const clockSize   = Math.round(88 * 1.2);               // 106
  const clockX      = 145;
  const clockY      = Math.round(r2 - clockSize / 2);     // 142
  const timerDigitH = 66;
  const timerY      = Math.round(r2 - timerDigitH / 2); // 157
  const timerRightX = clockX + clockSize + 130;           // 381

  // Trophy + score (row 2, after timer)
  const trophySize = 80;
  const trophyX    = timerRightX + 70;                  // 433 (+50px)
  const trophyY    = Math.round(r2 - trophySize / 2);   // 150
  const scoreDigitH = 66;
  const scoreX     = trophyX + trophySize + 10;         // 523
  const scoreY     = Math.round(r2 - scoreDigitH / 2);  // 157

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
    tipTargetStep: Math.round(66 * 1.2),  // 79
    dcIconX, dcIconY: btnY, dcIconSize: btnSize,
    musicX,  musicY:  btnY, musicSize:  btnSize,
  };
}

export function landscapeDCLayout(): DCHeaderLayout {
  const barX = DC_HEADER_X_LANDSCAPE;
  const barW = DC_HEADER_BAR_W_LANDSCAPE;
  const barH = OFFSET_Y - 20;                    // 280
  const cy   = 10 + barH / 2;                    // 150

  const slotW = 65, slotH = 80;
  const tipY  = Math.round(cy - slotH / 2);      // 110

  const clockSize = 90;
  const clockCx   = barX + barW / 2;             // 1130
  const clockX    = clockCx - clockSize / 2;     // 1085
  const clockY    = cy - clockSize / 2;          // 105

  const timerDigitH  = 65;
  const timerY       = Math.round(cy - timerDigitH / 2);
  const timerRightX  = clockCx + clockSize / 2 + 120;     // 1295

  // Buttons inline with content row — 1.5× the original 52 px.
  const btnSize   = 78;
  const rightEdge = barX + barW;                          // 1780
  const dcIconX   = rightEdge - btnSize - 12;             // 1690
  const musicX    = dcIconX - btnSize - 10;               // 1602
  const btnY      = Math.round(cy - btnSize / 2);         // 111

  // Trophy: original 60 px × 1.5 = 90 px, shifted 20 px right.
  const trophySize   = 90;
  const trophyX      = timerRightX + 40 + 20;             // 1355
  const trophyY      = Math.round(cy - trophySize / 2);

  // Score: left-aligned after trophy, ample space before music button.
  const scoreDigitH  = 65;
  const scoreY       = Math.round(cy - scoreDigitH / 2);
  const scoreX       = trophyX + trophySize + 12;         // 1457

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

export class DailyChallengeHeader extends PIXI.Container {
  private readonly bar:            PIXI.Graphics;
  private readonly clockContainer: PIXI.Container;
  private readonly clockFace:     PIXI.Sprite;
  private readonly clockHand:     PIXI.Sprite;
  private readonly trophySprite:  PIXI.Sprite;
  private readonly scoreDisplay:  DigitDisplay;
  private readonly timerDisplay:  DigitDisplay;

  private tipContainer!:    PIXI.Container;
  private tipResultElapsed = -1;
  private musicSprite!:     PIXI.Sprite;
  private dcIconSprite!:    PIXI.Sprite;
  private layout:           DCHeaderLayout;

  constructor(
    private readonly ctx:       AppContext,
    private readonly onGoLobby: () => void,
    screen: ScreenConfig,
  ) {
    super();

    this.layout = getDCLayout(screen);
    const L = this.layout;

    // ── Background bar ───────────────────────────────────────────────────
    this.bar = new PIXI.Graphics();
    drawHeaderBar(this.bar, L.barW, L.barH);
    this.bar.x = L.barX; this.bar.y = L.barY;
    this.addChild(this.bar);

    // ── Clock (face + hand, same design as game header) ──────────────────
    this.clockContainer = new PIXI.Container();
    this.clockContainer.x = L.clockX;
    this.clockContainer.y = L.clockY;

    this.clockFace = new PIXI.Sprite(ctx.assets.GetTexture('clock_face.png'));
    this.clockFace.width  = L.clockSize;
    this.clockFace.height = L.clockSize;
    this.clockContainer.addChild(this.clockFace);

    const r = L.clockSize / 2;
    this.clockHand = new PIXI.Sprite(ctx.assets.GetTexture('clock_hand.png'));
    this.clockHand.width    = 6;
    this.clockHand.height   = 33;
    this.clockHand.pivot.set(3, 0);
    this.clockHand.x        = r;
    this.clockHand.y        = r;
    this.clockHand.rotation = Math.PI; // 12 o'clock
    this.clockContainer.addChild(this.clockHand);

    this.addChild(this.clockContainer);

    // ── Countdown digits ──────────────────────────────────────────────────
    this.timerDisplay = new DigitDisplay(
      ctx,
      Math.round(L.timerDigitH * 120 / 160),
      L.timerDigitH,
    );
    this.timerDisplay.y = L.timerY;
    this.addChild(this.timerDisplay);

    // ── Trophy icon ───────────────────────────────────────────────────────
    this.trophySprite = new PIXI.Sprite(ctx.assets.GetTexture('trophy.png'));
    this.trophySprite.width  = L.trophySize;
    this.trophySprite.height = L.trophySize;
    this.trophySprite.x      = L.trophyX;
    this.trophySprite.y      = L.trophyY;
    this.addChild(this.trophySprite);

    // ── Score digits ──────────────────────────────────────────────────────
    this.scoreDisplay = new DigitDisplay(
      ctx,
      Math.round(L.scoreDigitH * 120 / 160),
      L.scoreDigitH,
    );
    this.scoreDisplay.y = L.scoreY;
    this.addChild(this.scoreDisplay);

    // ── Top-right: music button + leaderboard/lobby icon ─────────────────
    this.buildTopRightButtons(L);

    // ── Hint formula ─────────────────────────────────────────────────────
    this.rebuildTip(null, null);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  public resize(screen: ScreenConfig): void {
    this.layout = getDCLayout(screen);
    const L = this.layout;

    this.bar.clear();
    drawHeaderBar(this.bar, L.barW, L.barH);
    this.bar.x = L.barX; this.bar.y = L.barY;

    // Clock
    this.clockContainer.x = L.clockX;
    this.clockContainer.y = L.clockY;
    this.clockFace.width  = L.clockSize;
    this.clockFace.height = L.clockSize;
    const r = L.clockSize / 2;
    this.clockHand.x = r;
    this.clockHand.y = r;

    // Timer
    this.timerDisplay.digitW = Math.round(L.timerDigitH * 120 / 160);
    this.timerDisplay.digitH = L.timerDigitH;
    this.timerDisplay.y      = L.timerY;

    // Trophy
    this.trophySprite.width  = L.trophySize;
    this.trophySprite.height = L.trophySize;
    this.trophySprite.x      = L.trophyX;
    this.trophySprite.y      = L.trophyY;

    // Score
    this.scoreDisplay.digitW = Math.round(L.scoreDigitH * 120 / 160);
    this.scoreDisplay.digitH = L.scoreDigitH;
    this.scoreDisplay.y      = L.scoreY;

    // Top-right buttons
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

    // Clock hand rotation: ratio=1 → 12 o'clock (full time); decreases clockwise
    const ratio = Math.min(Math.max(secs, 0) / DC_TIMER_REF_SECS, 1);
    this.clockHand.rotation = Math.PI + (1 - ratio) * Math.PI * 2;

    // Warning colour at < WARN_THRESHOLD seconds
    const warn = secs > 0 && secs < WARN_THRESHOLD;
    const tint  = warn ? 0xFF5252 : 0xFFFFFF;
    this.clockFace.tint     = tint;
    this.clockHand.tint     = tint;
    this.timerDisplay.tint  = tint;
  }

  public rebuildTip(first: number | null, second: number | null): void {
    if (this.tipContainer) {
      this.removeChild(this.tipContainer);
      this.tipContainer.destroy({ children: true });
    }
    this.tipContainer = new PIXI.Container();
    const L = this.layout;
    const { tipY: Y, tipSlotW: W, tipSlotH: H } = L;

    this.addSlotOrValue(this.tipContainer, first,  L.tipSlot1X, Y, W, H);

    const plus   = new PIXI.Sprite(this.ctx.assets.GetTexture('plus.png'));
    plus.width   = W; plus.height = H;
    plus.x = L.tipPlusX; plus.y = Y;
    this.tipContainer.addChild(plus);

    this.addSlotOrValue(this.tipContainer, second, L.tipSlot2X, Y, W, H);

    const equa   = new PIXI.Sprite(this.ctx.assets.GetTexture('equa.png'));
    equa.width   = W; equa.height = H;
    equa.x = L.tipEquaX; equa.y = Y;
    this.tipContainer.addChild(equa);

    getDailyTarget().toString().split('').forEach((ch, i) => {
      const s   = new PIXI.Sprite(this.ctx.assets.GetTexture(`${ch}.png`));
      s.width   = W; s.height = H;
      s.x = L.tipTargetX + i * L.tipTargetStep; s.y = Y;
      this.tipContainer.addChild(s);
    });

    this.addChild(this.tipContainer);
  }

  /** Centre of the score area in scene coordinates (used for flying score animation). */
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
    if (this.tipResultElapsed < 0) return;
    this.tipResultElapsed += deltaMs;
    if (this.tipResultElapsed >= RESULT_DISPLAY_MS) {
      this.tipResultElapsed = -1;
      this.rebuildTip(null, null);
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private buildTopRightButtons(L: DCHeaderLayout): void {
    // Music button
    const music = new PIXI.Sprite(this.ctx.assets.GetTexture('music.png'));
    music.width  = L.musicSize;
    music.height = L.musicSize;
    music.x      = L.musicX;
    music.y      = L.musicY;
    this.applyMusicTint(music);
    this.addChild(music);
    this.musicSprite = music;
    this.ctx.input.registerUI(new UIElement({
      zIndex: 15,
      sprite: music,
      onTap: () => {
        this.ctx.audio.toggleMusic();
        this.applyMusicTint(music);
      },
    }));

    // Leaderboard / lobby icon (top-right)
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

  private applyMusicTint(sprite: PIXI.Sprite): void {
    sprite.tint = this.ctx.audio.isMusicEnabled() ? 0xFFFFFF : 0x444444;
  }

  private addSlotOrValue(
    container: PIXI.Container,
    value: number | null,
    x: number, y: number, w: number, h: number,
  ): void {
    if (value === null) {
      const g = new PIXI.Graphics();
      g.lineStyle(3, 0xBBBBBB, 1);
      g.beginFill(0xF0F0F0, 1);
      g.drawRoundedRect(x, y, w, h, 10);
      g.endFill();
      drawQuestionMark(g, x + w / 2, y + h / 2, h);
      container.addChild(g);
    } else {
      const digits = value.toString().split('');
      if (digits.length === 1) {
        const s   = new PIXI.Sprite(this.ctx.assets.GetTexture(`${digits[0]}.png`));
        s.width   = w; s.height = h;
        s.x = x;      s.y = y;
        container.addChild(s);
      } else {
        const dw = Math.floor((w - 4) / 2);
        digits.forEach((ch, i) => {
          const s = new PIXI.Sprite(this.ctx.assets.GetTexture(`${ch}.png`));
          s.width = dw; s.height = h;
          s.x = x + i * (dw + 4); s.y = y;
          container.addChild(s);
        });
      }
    }
  }
}
