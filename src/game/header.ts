import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { UIElement } from '../inputSystem/uiElement';
import { Orientation } from './enums';
import { drawHeaderBar } from './graphicsFactory';
import { BaseHeader, TipLayout } from './baseHeader';

/** Reference duration (seconds): above this value the hand rests at 12 o'clock. */
const CLOCK_REF_SECS = 30;

// ── Layout configuration ──────────────────────────────────────────────────────

interface HeaderLayout extends TipLayout {
  barW: number;
  barH: number;

  clockX: number;
  clockY: number;
  clockSize: number;

  timeStartX: number;
  timeY: number;
  timeDigitW: number;
  timeDigitH: number;
  timeDigitGap: number;

  livesStartX: number;
  livesY: number;
  heartSize: number;
  heartGap: number;

  settingsX: number;
  settingsY: number;
  settingsSize: number;

  musicX: number;
  musicY: number;
  musicSize: number;
}

function landscapeLayout(): HeaderLayout {
  return {
    barW: 1350,
    barH: 250,
    tipY: 85,
    tipSlotW: 80,
    tipSlotH: 100,
    tipSlot1X: 50,
    tipPlusX: 140,
    tipSlot2X: 225,
    tipEquaX: 315,
    tipTargetX: 395,
    tipTargetStep: 65,
    clockX: 550,
    clockY: 70,
    clockSize: 110,
    timeStartX: 668,
    timeY: 70,
    timeDigitW: 80,
    timeDigitH: 110,
    timeDigitGap: -20,
    livesStartX: 860,
    livesY: 95,
    heartSize: 60,
    heartGap: 10,
    settingsX: 1240,
    settingsY: 70,
    settingsSize: 100,
    musicX: 1130,
    musicY: 70,
    musicSize: 100,
  };
}

function portraitLayout(): HeaderLayout {
  const barH = 280;
  const r2 = 200;

  const clockCenterY = barH / 2;
  const clockSize = 158;
  const clockX = 15;
  const clockY = clockCenterY - clockSize / 2;
  const timeDigitH = 135;
  const timeDigitW = 99;
  const timeDigitGap = 4;
  const timeStartX = clockX + clockSize + 8;

  const heartSize = Math.round(62 * 1.5);
  const heartGap = 10;
  const livesStartX = timeStartX + 3 * (timeDigitW + timeDigitGap) + 10;
  const livesY = r2 - heartSize / 2;

  const heartsRight = livesStartX + 3 * heartSize + 2 * heartGap;
  const btnSize = Math.round(65 * 1.5);
  const musicX = heartsRight + 14;
  const settingsX = musicX + btnSize + 8;

  const slotW = 70,
    slotH = 80;
  const tipTargetStep = 72;
  const tip0 = livesStartX;
  const tipY = 75 - slotH / 2;

  return {
    barW: 1020,
    barH,
    tipY,
    tipSlotW: slotW,
    tipSlotH: slotH,
    tipSlot1X: tip0,
    tipPlusX: tip0 + (slotW + 8),
    tipSlot2X: tip0 + (slotW + 8) * 2,
    tipEquaX: tip0 + (slotW + 8) * 3,
    tipTargetX: tip0 + (slotW + 8) * 4,
    tipTargetStep,
    clockX,
    clockY,
    clockSize,
    timeStartX,
    timeY: clockCenterY - timeDigitH / 2,
    timeDigitW,
    timeDigitH,
    timeDigitGap,
    livesStartX,
    livesY,
    heartSize,
    heartGap,
    settingsX,
    settingsY: r2 - btnSize / 2,
    settingsSize: btnSize,
    musicX,
    musicY: r2 - btnSize / 2,
    musicSize: btnSize,
  };
}

// ── Header ────────────────────────────────────────────────────────────────────

export class Header extends BaseHeader {
  // ── Time display ──────────────────────────────────────────────────
  private timeSprites: PIXI.Sprite[] = [];
  private lastDisplayedSeconds = -1;

  // ── Lives hearts ──────────────────────────────────────────────────
  private livesSprites: PIXI.Sprite[] = [];

  // ── Background bar ────────────────────────────────────────────────
  private bgGraphics!: PIXI.Graphics;

  // ── Animations ────────────────────────────────────────────────────
  private bounceElapsed = -1;
  private static readonly BOUNCE_DURATION = 200;

  private highlightElapsed = -1;
  private static readonly HIGHLIGHT_DURATION = 300;

  private warnShakeMs = 0;

  private heartAnims: Array<{
    sprite: PIXI.Sprite;
    callback: () => void;
    elapsed: number;
    done: boolean;
    baseScaleX: number;
    baseScaleY: number;
  }> = [];

  private _target: number;
  private settingsSprite!: PIXI.Sprite;

  private layout: HeaderLayout;

  constructor(
    ctx: AppContext,
    private readonly screen: ScreenConfig,
    initialTarget: number,
    onSettings: () => void
  ) {
    super(ctx);

    // Warm gold slot style (main game)
    this.emptySlotBorderColor = 0xc4a068;
    this.emptySlotBorderAlpha = 0.8;
    this.emptySlotFillColor = 0xf5e8c8;
    this.tipSymbolFullSize = false;

    this._target = initialTarget;
    this.layout =
      screen.orientation === Orientation.Landscape ? landscapeLayout() : portraitLayout();

    this.buildBackground();
    this.buildTip();
    this.buildTime();
    this.buildLives();
    this.buildSettingsButton(onSettings);
    this.buildMusicButton(this.layout.musicX, this.layout.musicY, this.layout.musicSize);
  }

  // ── Abstract implementations ──────────────────────────────────────
  protected getTarget(): number {
    return this._target;
  }
  protected getCurrentTipLayout(): TipLayout {
    return this.layout;
  }

  // ── Public API ────────────────────────────────────────────────────

  public updateTarget(target: number): void {
    this._target = target;
    this.tipResultElapsed = -1;
    this.rebuildTip(null, null);
  }

  public setFirstSelected(value: number): void {
    this.tipResultElapsed = -1;
    this.rebuildTip(value, null);
  }

  public resetTip(): void {
    this.tipResultElapsed = -1;
    this.rebuildTip(null, null);
  }

  public showMatchResult(a: number, b: number): void {
    this.rebuildTip(a, b);
    this.tipResultElapsed = 0;
  }

  public update(deltaMs: number): void {
    this.updateBounce(deltaMs);
    this.tickTipResultReset(deltaMs);
    this.updateWarnShake(deltaMs);
    this.updateHighlight(deltaMs);
    this.updateHeartAnims(deltaMs);
  }

  public updateTime(seconds: number): void {
    if (seconds === this.lastDisplayedSeconds) return;
    this.lastDisplayedSeconds = seconds;

    const s = Math.max(0, seconds).toString();
    for (const d of this.timeSprites) d.visible = false;
    for (let i = 0; i < s.length && i < this.timeSprites.length; i++) {
      const sprite = this.timeSprites[i];
      sprite.texture = this.ctx.assets.GetTexture(`${s[i]}.png`);
      sprite.visible = true;
    }

    const ratio = Math.min(Math.max(seconds, 0) / CLOCK_REF_SECS, 1);
    this.clockHand.rotation = Math.PI + (1 - ratio) * Math.PI * 2;

    const warnColor = seconds > 0 && seconds < BaseHeader.WARN_THRESHOLD ? 0xff5252 : 0xffffff;
    this.clockFace.tint = warnColor;
    this.clockHand.tint = warnColor;
    if (this.highlightElapsed < 0) {
      for (const sp of this.timeSprites) sp.tint = warnColor;
    }
  }

  public updateLives(lives: number): void {
    for (let i = 0; i < this.livesSprites.length; i++) {
      this.livesSprites[i].texture =
        i < lives
          ? this.ctx.assets.GetTexture('heart.png')
          : this.ctx.assets.GetTexture('heart_empty.png');
    }
  }

  public triggerClockBounce(): void {
    this.bounceElapsed = 0;
    this.highlightElapsed = 0;
  }

  public triggerHeartLost(liveIndex: number, callback: () => void): void {
    const sprite = this.livesSprites[liveIndex];
    if (!sprite) {
      callback();
      return;
    }
    this.heartAnims.push({
      sprite,
      callback,
      elapsed: 0,
      done: false,
      baseScaleX: sprite.scale.x,
      baseScaleY: sprite.scale.y,
    });
  }

  public getHeartCenter(liveIndex: number): { x: number; y: number } {
    const L = this.layout;
    return {
      x: this.x + L.livesStartX + liveIndex * (L.heartSize + L.heartGap) + L.heartSize / 2,
      y: this.y + L.livesY + L.heartSize / 2,
    };
  }

  public resize(screen: ScreenConfig): void {
    this.layout =
      screen.orientation === Orientation.Landscape ? landscapeLayout() : portraitLayout();

    const L = this.layout;

    if (screen.orientation === Orientation.Landscape) {
      this.x = 350;
      this.y = 10;
    } else {
      this.x = 30;
      this.y = 10;
    }

    this.bgGraphics.clear();
    drawHeaderBar(this.bgGraphics, L.barW, L.barH);

    this.resizeClock(L.clockX, L.clockY, L.clockSize);

    for (let i = 0; i < this.timeSprites.length; i++) {
      const s = this.timeSprites[i];
      s.width = L.timeDigitW;
      s.height = L.timeDigitH;
      s.x = L.timeStartX + i * (L.timeDigitW + L.timeDigitGap);
      s.y = L.timeY;
    }
    this.lastDisplayedSeconds = -1;

    for (let i = 0; i < this.livesSprites.length; i++) {
      const s = this.livesSprites[i];
      s.width = L.heartSize;
      s.height = L.heartSize;
      s.x = L.livesStartX + i * (L.heartSize + L.heartGap);
      s.y = L.livesY;
    }

    this.settingsSprite.width = L.settingsSize;
    this.settingsSprite.height = L.settingsSize;
    this.settingsSprite.x = L.settingsX;
    this.settingsSprite.y = L.settingsY;

    this.musicSprite.width = L.musicSize;
    this.musicSprite.height = L.musicSize;
    this.musicSprite.x = L.musicX;
    this.musicSprite.y = L.musicY;

    this.rebuildTip(null, null);
  }

  public getClockCenter(): { x: number; y: number } {
    const r = this.layout.clockSize / 2;
    return {
      x: this.x + this.layout.clockX + r,
      y: this.y + this.layout.clockY + r,
    };
  }

  // ── Private build methods ─────────────────────────────────────────

  private buildBackground(): void {
    this.bgGraphics = new PIXI.Graphics();
    const L = this.layout;

    if (this.screen.orientation === Orientation.Landscape) {
      this.x = 350;
      this.y = 10;
    } else {
      this.x = 30;
      this.y = 10;
    }
    drawHeaderBar(this.bgGraphics, L.barW, L.barH);
    this.addChild(this.bgGraphics);
  }

  private rebuildTip(first: number | null, second: number | null): void {
    this.rebuildTipContainer(first, second, this.layout);
  }

  private buildTip(): void {
    this.rebuildTip(null, null);
  }

  private buildTime(): void {
    const L = this.layout;
    this.buildClock(L.clockX, L.clockY, L.clockSize);

    for (let i = 0; i < 3; i++) {
      const s = new PIXI.Sprite(this.ctx.assets.GetTexture('0.png'));
      s.width = L.timeDigitW;
      s.height = L.timeDigitH;
      s.x = L.timeStartX + i * (L.timeDigitW + L.timeDigitGap);
      s.y = L.timeY;
      s.visible = false;
      this.addChild(s);
      this.timeSprites.push(s);
    }
  }

  private buildLives(): void {
    const L = this.layout;
    for (let i = 0; i < 3; i++) {
      const s = new PIXI.Sprite(this.ctx.assets.GetTexture('heart.png'));
      s.width = L.heartSize;
      s.height = L.heartSize;
      s.x = L.livesStartX + i * (L.heartSize + L.heartGap);
      s.y = L.livesY;
      this.addChild(s);
      this.livesSprites.push(s);
    }
  }

  private buildSettingsButton(onSettings: () => void): void {
    const L = this.layout;
    this.settingsSprite = new PIXI.Sprite(this.ctx.assets.GetTexture('settings.png'));
    this.settingsSprite.width = L.settingsSize;
    this.settingsSprite.height = L.settingsSize;
    this.settingsSprite.x = L.settingsX;
    this.settingsSprite.y = L.settingsY;
    this.addChild(this.settingsSprite);
    this.ctx.input.registerUI(
      new UIElement({ zIndex: 15, sprite: this.settingsSprite, onTap: onSettings })
    );
  }

  // ── Warning shake ─────────────────────────────────────────────────

  private updateWarnShake(deltaMs: number): void {
    const warn =
      this.lastDisplayedSeconds > 0 && this.lastDisplayedSeconds < BaseHeader.WARN_THRESHOLD;
    if (warn) {
      this.warnShakeMs += deltaMs;
    } else {
      this.warnShakeMs = 0;
    }
    const offset = warn ? Math.round(Math.sin(this.warnShakeMs / 50) * 3) : 0;
    const L = this.layout;

    this.clockContainer.x = L.clockX + offset;
    for (let i = 0; i < this.timeSprites.length; i++) {
      this.timeSprites[i].x = L.timeStartX + i * (L.timeDigitW + L.timeDigitGap) + offset;
    }
  }

  // ── Bounce animation ──────────────────────────────────────────────

  private updateBounce(deltaMs: number): void {
    if (this.bounceElapsed < 0) return;
    this.bounceElapsed += deltaMs;
    const t = this.bounceElapsed / Header.BOUNCE_DURATION;
    if (t >= 1) {
      this.clockContainer.scale.set(1);
      this.bounceElapsed = -1;
      return;
    }
    const scale = 1 + 0.25 * Math.sin(t * Math.PI);
    this.clockContainer.scale.set(scale);
  }

  // ── Time digit highlight ──────────────────────────────────────────

  private updateHighlight(deltaMs: number): void {
    if (this.highlightElapsed < 0) return;
    this.highlightElapsed += deltaMs;
    const raw = Math.min(this.highlightElapsed / Header.HIGHLIGHT_DURATION, 1);
    const eased = raw < 0.5 ? 2 * raw * raw : -1 + (4 - 2 * raw) * raw;

    const targetTint =
      this.lastDisplayedSeconds > 0 && this.lastDisplayedSeconds < BaseHeader.WARN_THRESHOLD
        ? 0xff5252
        : 0xffffff;
    const toR = (targetTint >> 16) & 0xff;
    const toG = (targetTint >> 8) & 0xff;
    const toB = targetTint & 0xff;

    const r = Math.round(0xff + (toR - 0xff) * eased);
    const g = Math.round(0xd7 + (toG - 0xd7) * eased);
    const b = Math.round(0x00 + (toB - 0x00) * eased);
    const tint = (r << 16) | (g << 8) | b;

    for (const s of this.timeSprites) if (s.visible) s.tint = tint;

    if (raw >= 1) {
      this.highlightElapsed = -1;
      for (const s of this.timeSprites) s.tint = targetTint;
    }
  }

  // ── Heart breaking animation ──────────────────────────────────────

  private updateHeartAnims(deltaMs: number): void {
    for (const anim of this.heartAnims) {
      if (anim.done) continue;
      anim.elapsed += deltaMs;

      if (anim.elapsed < 80) {
        const t = anim.elapsed / 80;
        const f = 1 + 0.3 * t;
        anim.sprite.scale.x = anim.baseScaleX * f;
        anim.sprite.scale.y = anim.baseScaleY * f;
      } else {
        const t = Math.min((anim.elapsed - 80) / 150, 1);
        const f = 1.3 * (1 - t);
        anim.sprite.scale.x = anim.baseScaleX * f;
        anim.sprite.scale.y = anim.baseScaleY * f;
        if (t >= 1) {
          anim.sprite.scale.x = anim.baseScaleX;
          anim.sprite.scale.y = anim.baseScaleY;
          anim.done = true;
          anim.callback();
        }
      }
    }
    this.heartAnims = this.heartAnims.filter((a) => !a.done);
  }
}
