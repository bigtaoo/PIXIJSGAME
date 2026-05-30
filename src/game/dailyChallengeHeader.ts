/**
 * dailyChallengeHeader.ts
 *
 * Header bar for the Daily Challenge scene.
 *
 * Contains:
 *   - DCHeaderLayout interface (portrait/landscape coordinate definitions)
 *   - portraitDCLayout / landscapeDCLayout (two layout functions; coordinates can be edited directly in this file)
 *   - DailyChallengeHeader class (PIXI.Container subclass that owns all header elements)
 *
 * Public API:
 *   new DailyChallengeHeader(ctx, onGoLobby)
 *   header.resize(screen)          — call when the screen orientation changes
 *   header.setScore(n)             — update the score display
 *   header.setTimer(secs)          — update the countdown display
 *   header.rebuildTip(first, second) — rebuild the hint formula
 *   header.tickTipReset(deltaMs)   — call every frame to drive automatic tip reset
 *   header.startTipResultTimer()   — call after a successful elimination to start the 500 ms reset timer
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

// ── Layout interface ──────────────────────────────────────────────────────────

export interface DCHeaderLayout {
  // Background bar
  barX: number; barY: number; barW: number; barH: number;
  // Icon (daily_challenge_icon.png)
  iconX: number; iconY: number; iconH: number;
  // Return-to-lobby hit area
  hitX: number; hitY: number; hitW: number; hitH: number;
  // Score: scoreCenterX = horizontal centre of the digit region
  scoreCenterX: number; scoreY: number; scoreDigitH: number;
  // Countdown: timerRightX = right-align baseline x for the digits
  timerRightX: number; timerY: number; timerDigitH: number;
  // Hint formula (□ + □ = Target)
  tipY: number; tipSlotW: number; tipSlotH: number;
  tipSlot1X: number; tipPlusX: number;
  tipSlot2X: number; tipEquaX: number;
  tipTargetX: number; tipTargetStep: number;
  // Music button
  musicX: number; musicY: number; musicSize: number;
}

// ── Layout functions ──────────────────────────────────────────────────────────

/** Portrait layout (canvas width = GAME_WIDTH = 1080). */
export function portraitDCLayout(): DCHeaderLayout {
  return {
    barX: 20,  barY: 10, barW: GAME_WIDTH - 40, barH: OFFSET_Y - 20,
    iconX: 50, iconY: 15, iconH: 70,
    hitX: 20,  hitY: 10, hitW: 260, hitH: 110,
    scoreCenterX: GAME_WIDTH / 2,
    scoreY: 18, scoreDigitH: 72,
    timerRightX: GAME_WIDTH - 50,
    timerY: 18, timerDigitH: 72,
    tipY: 115, tipSlotW: 65, tipSlotH: 82,
    tipSlot1X: 50,  tipPlusX: 125, tipSlot2X: 200,
    tipEquaX: 275,  tipTargetX: 350, tipTargetStep: 70,
    musicX: GAME_WIDTH - 160, musicY: 18, musicSize: 72,
  };
}

/**
 * Landscape layout.
 * barX / barW are absolute coordinates within the scene (no container x offset).
 * Coordinates can be adjusted directly here.
 */
export function landscapeDCLayout(): DCHeaderLayout {
  const barX = 480;
  const barW = 1300;
  const cx   = barX + barW / 2;
  return {
    barX, barY: 10, barW, barH: OFFSET_Y - 20,
    iconX: barX + 30, iconY: 15, iconH: 70,
    hitX:  barX,      hitY: 10,  hitW: 260, hitH: 110,
    scoreCenterX: cx,
    scoreY: 18, scoreDigitH: 72,
    timerRightX: barX + barW - 100,
    timerY: 18, timerDigitH: 72,
    tipY: 115, tipSlotW: 65, tipSlotH: 82,
    tipSlot1X: barX + 30, tipPlusX: barX + 105, tipSlot2X: barX + 180,
    tipEquaX:  barX + 255, tipTargetX: barX + 330, tipTargetStep: 70,
    musicX: barX + barW - 90, musicY: 18, musicSize: 72,
  };
}

export function getDCLayout(screen: ScreenConfig): DCHeaderLayout {
  return screen.orientation === Orientation.Landscape
    ? landscapeDCLayout()
    : portraitDCLayout();
}

// ── DailyChallengeHeader ──────────────────────────────────────────────────────

const RESULT_DISPLAY_MS = 500;

export class DailyChallengeHeader extends PIXI.Container {
  private readonly bar:          PIXI.Graphics;
  private readonly icon:         PIXI.Sprite;
  private readonly hit:          PIXI.Sprite;
  private readonly scoreDisplay: DigitDisplay;
  private readonly timerDisplay: DigitDisplay;

  private tipContainer!:    PIXI.Container;
  private tipResultElapsed = -1;

  private musicSprite!: PIXI.Sprite;
  private layout: DCHeaderLayout;

  constructor(
    private readonly ctx:       AppContext,
    private readonly onGoLobby: () => void,
    screen: ScreenConfig,
  ) {
    super();

    this.layout = getDCLayout(screen);
    const L = this.layout;

    // Background bar
    this.bar = new PIXI.Graphics();
    drawHeaderBar(this.bar, L.barW, L.barH);
    this.bar.x = L.barX; this.bar.y = L.barY;
    this.addChild(this.bar);

    // Icon
    this.icon = new PIXI.Sprite(ctx.assets.GetTexture('daily_challenge_icon.png'));
    this.applyIconScale(L);
    this.addChild(this.icon);

    // Score
    this.scoreDisplay = new DigitDisplay(ctx, Math.round(L.scoreDigitH * 120 / 160), L.scoreDigitH);
    this.scoreDisplay.y = L.scoreY;
    this.addChild(this.scoreDisplay);

    // Countdown
    this.timerDisplay = new DigitDisplay(ctx, Math.round(L.timerDigitH * 120 / 160), L.timerDigitH);
    this.timerDisplay.y = L.timerY;
    this.addChild(this.timerDisplay);

    // Return hit area
    this.hit = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.hit.width  = L.hitW; this.hit.height = L.hitH;
    this.hit.x = L.hitX;     this.hit.y = L.hitY;
    this.addChild(this.hit);
    ctx.input.registerUI(
      new UIElement({ zIndex: 15, sprite: this.hit, onTap: () => this.onGoLobby() }),
    );

    // Music button
    this.buildMusicButton(L);

    // Initial tip (both slots empty)
    this.rebuildTip(null, null);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Called by DailyChallengeScene when the screen orientation changes. */
  public resize(screen: ScreenConfig): void {
    this.layout = getDCLayout(screen);
    const L = this.layout;

    this.bar.clear();
    drawHeaderBar(this.bar, L.barW, L.barH);
    this.bar.x = L.barX; this.bar.y = L.barY;

    this.applyIconScale(L);

    this.scoreDisplay.digitW = Math.round(L.scoreDigitH * 120 / 160);
    this.scoreDisplay.digitH = L.scoreDigitH;
    this.scoreDisplay.y      = L.scoreY;

    this.timerDisplay.digitW = Math.round(L.timerDigitH * 120 / 160);
    this.timerDisplay.digitH = L.timerDigitH;
    this.timerDisplay.y      = L.timerY;

    this.hit.x = L.hitX; this.hit.y = L.hitY;
    this.hit.width = L.hitW; this.hit.height = L.hitH;

    this.musicSprite.width  = L.musicSize;
    this.musicSprite.height = L.musicSize;
    this.musicSprite.x      = L.musicX;
    this.musicSprite.y      = L.musicY;

    this.rebuildTip(null, null);
  }

  /** Update the score digits. */
  public setScore(score: number): void {
    this.scoreDisplay.update(score);
    this.scoreDisplay.x = this.layout.scoreCenterX - this.scoreDisplay.totalWidth / 2;
  }

  /** Update the countdown digits; turns red when below 10 seconds. */
  public setTimer(secs: number): void {
    this.timerDisplay.update(secs);
    this.timerDisplay.x    = this.layout.timerRightX - this.timerDisplay.totalWidth;
    this.timerDisplay.tint = secs <= 10 ? 0xff4444 : 0xFFFFFF;
  }

  /** Rebuild the hint formula. When first / second is null an empty slot is shown. */
  public rebuildTip(first: number | null, second: number | null): void {
    if (this.tipContainer) {
      this.removeChild(this.tipContainer);
      this.tipContainer.destroy({ children: true });
    }
    this.tipContainer = new PIXI.Container();
    const L = this.layout;
    const { tipY: Y, tipSlotW: W, tipSlotH: H } = L;

    this.addSlotOrValue(this.tipContainer, first,  L.tipSlot1X, Y, W, H);

    const plus  = new PIXI.Sprite(this.ctx.assets.GetTexture('plus.png'));
    plus.width  = W; plus.height = H;
    plus.x = L.tipPlusX; plus.y = Y;
    this.tipContainer.addChild(plus);

    this.addSlotOrValue(this.tipContainer, second, L.tipSlot2X, Y, W, H);

    const equa  = new PIXI.Sprite(this.ctx.assets.GetTexture('equa.png'));
    equa.width  = W; equa.height = H;
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

  /**
   * Return the centre position of the score display area (in scene coordinates),
   * used to anchor the flying score animation's end point.
   */
  public getScoreCenterPos(): { x: number; y: number } {
    return {
      x: this.layout.scoreCenterX,
      y: this.layout.scoreY + this.layout.scoreDigitH / 2,
    };
  }

  /** Call after a successful elimination to start the 500 ms auto-reset countdown. */
  public startTipResultTimer(): void {
    this.tipResultElapsed = 0;
  }

  /** Called every frame by DailyChallengeScene.update(). */
  public tickTipReset(deltaMs: number): void {
    if (this.tipResultElapsed < 0) return;
    this.tipResultElapsed += deltaMs;
    if (this.tipResultElapsed >= RESULT_DISPLAY_MS) {
      this.tipResultElapsed = -1;
      this.rebuildTip(null, null);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private buildMusicButton(L: DCHeaderLayout): void {
    const btn = new PIXI.Sprite(this.ctx.assets.GetTexture('music.png'));
    btn.width  = L.musicSize;
    btn.height = L.musicSize;
    btn.x      = L.musicX;
    btn.y      = L.musicY;
    this.applyMusicTint(btn);
    this.addChild(btn);
    this.musicSprite = btn;
    this.ctx.input.registerUI(new UIElement({
      zIndex: 15,
      sprite: btn,
      onTap: () => {
        this.ctx.audio.toggleMusic();
        this.applyMusicTint(btn);
      },
    }));
  }

  private applyMusicTint(sprite: PIXI.Sprite): void {
    sprite.tint = this.ctx.audio.isMusicEnabled() ? 0xFFFFFF : 0x444444;
  }

  private applyIconScale(L: DCHeaderLayout): void {
    const scale = L.iconH / Math.max(this.icon.texture.width, this.icon.texture.height);
    this.icon.width  = this.icon.texture.width  * scale;
    this.icon.height = this.icon.texture.height * scale;
    this.icon.x = L.iconX;
    this.icon.y = L.iconY;
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
