import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { UIElement } from '../inputSystem/uiElement';
import { Orientation } from './enums';
import { drawHeaderBar, drawQuestionMark } from './graphicsFactory';

/** Time warning threshold (seconds): below this value the clock container turns red. */
const WARN_THRESHOLD = 10;

/** Reference duration (seconds) for computing the hand angle: above this value the hand rests at 12 o'clock. */
const CLOCK_REF_SECS = 30;

// ── Layout configuration ──────────────────────────────────────────────────────

interface HeaderLayout {
  /** Header background bar width (local space) */
  barW: number;
  barH: number;

  // ── Hint formula ──────────────────────────────────────────────────────────
  tipY: number;
  tipSlotW: number;
  tipSlotH: number;
  tipSlot1X: number;    // left slot x
  tipPlusX: number;     // plus sign x
  tipSlot2X: number;    // right slot x
  tipEquaX: number;     // equals sign x
  tipTargetX: number;   // target digit start x
  tipTargetStep: number;// step width per digit character

  // ── Clock ─────────────────────────────────────────────────────────────────
  clockX: number;
  clockY: number;
  clockSize: number;   // face diameter (clockRadius = clockSize / 2)

  // ── Time digits ───────────────────────────────────────────────────────────
  timeStartX: number;
  timeY: number;
  timeDigitW: number;
  timeDigitH: number;
  timeDigitGap: number;

  // ── Lives hearts ──────────────────────────────────────────────────────────
  livesStartX: number;
  livesY: number;
  heartSize: number;
  heartGap: number;

  // ── Settings button ───────────────────────────────────────────────────────
  settingsX: number;
  settingsY: number;
  settingsSize: number;

  // ── Music button (immediately to the left of the settings button) ─────────
  musicX: number;
  musicY: number;
  musicSize: number;
}

/** Landscape layout (Header on the right side of the canvas, left offset 350, bar width 1350). */
function landscapeLayout(): HeaderLayout {
  return {
    barW: 1350, barH: 250,
    tipY: 85, tipSlotW: 80, tipSlotH: 100,
    tipSlot1X: 50, tipPlusX: 140, tipSlot2X: 225, tipEquaX: 315,
    tipTargetX: 395, tipTargetStep: 65,
    clockX: 550, clockY: 70, clockSize: 110,
    timeStartX: 668, timeY: 70, timeDigitW: 80, timeDigitH: 110, timeDigitGap: -20,
    livesStartX: 860, livesY: 95, heartSize: 60, heartGap: 10,
    settingsX: 1240, settingsY: 70, settingsSize: 100,
    musicX:    1130, musicY:    70, musicSize:    100,
  };
}

/**
 * Portrait layout — two-row design (Header at the top, left offset 30, bar width 1020).
 *   Row 1 (centre y ≈ 75): hint formula only, horizontally centred
 *   Row 2 (centre y ≈ 200): clock (1.5×) + time + hearts + music + settings
 */
function portraitLayout(): HeaderLayout {
  const barH = 280;
  const r1   = 75;   // row-1 vertical centre (hint formula)
  const r2   = 200;  // row-2 vertical centre (clock / time / hearts / music / settings)

  // Clock + time: centred vertically in the bar (barH/2 = 140)
  const clockCenterY  = barH / 2;            // 140
  const clockSize     = 158;
  const clockX        = 15;
  const clockY        = clockCenterY - clockSize / 2;  // 61
  const timeDigitH    = 135;
  const timeDigitW    = 99;
  const timeDigitGap  = 4;
  const timeStartX    = clockX + clockSize + 8; // 181

  // Hearts (row 2) — 1.5× size
  const heartSize   = Math.round(62 * 1.5);  // 93
  const heartGap    = 10;
  const livesStartX = timeStartX + 3 * (timeDigitW + timeDigitGap) + 10; // 499
  const livesY      = r2 - heartSize / 2;   // 169

  // Music + settings (row 2) — 1.5× size
  const heartsRight = livesStartX + 3 * heartSize + 2 * heartGap;        // 685
  const btnSize     = Math.round(65 * 1.5);  // 98
  const musicX      = heartsRight + 14;      // 699
  const settingsX   = musicX + btnSize + 8;  // 805

  // Hint formula — row 1, left edge aligned with hearts (livesStartX)
  const slotW = 70, slotH = 80;
  const tipTargetStep = 72;
  const tip0 = livesStartX;                  // 499 — left-aligned with hearts
  const tipY = r1 - slotH / 2;              // 35

  return {
    barW: 1020, barH,
    tipY, tipSlotW: slotW, tipSlotH: slotH,
    tipSlot1X: tip0,
    tipPlusX:  tip0 + (slotW + 8),
    tipSlot2X: tip0 + (slotW + 8) * 2,
    tipEquaX:  tip0 + (slotW + 8) * 3,
    tipTargetX: tip0 + (slotW + 8) * 4,
    tipTargetStep,
    clockX, clockY, clockSize,
    timeStartX, timeY: clockCenterY - timeDigitH / 2, timeDigitW, timeDigitH, timeDigitGap,
    livesStartX, livesY, heartSize, heartGap,
    settingsX, settingsY: r2 - btnSize / 2, settingsSize: btnSize,
    musicX,    musicY:    r2 - btnSize / 2, musicSize:    btnSize,
  };
}

// ── Header ────────────────────────────────────────────────────────────────────

export class Header extends PIXI.Container {
  // ── Time display ──────────────────────────────────────────────────
  private timeSprites: PIXI.Sprite[]  = [];
  private lastDisplayedSeconds        = -1;

  // ── Hint formula ──────────────────────────────────────────────────
  /** Container for the entire hint area; destroyed and rebuilt on each update. */
  private tipContainer!: PIXI.Container;
  /** Timer for briefly showing the complete equation after a match; -1 = idle. */
  private resultElapsed = -1;
  private static readonly RESULT_DISPLAY_MS = 500;

  // ── Lives hearts ──────────────────────────────────────────────────
  private livesSprites: PIXI.Sprite[] = [];

  // ── Background bar ────────────────────────────────────────────────
  private bgGraphics!: PIXI.Graphics;

  // ── Clock ─────────────────────────────────────────────────────────
  /** Overall clock container (face + hand); bounce/colour change operate on this container. */
  private clockContainer!: PIXI.Container;
  private clockFaceSprite!: PIXI.Sprite;
  private clockHandSprite!: PIXI.Sprite;

  /** Bounce animation progress; -1 = idle. */
  private bounceElapsed                  = -1;
  private static readonly BOUNCE_DURATION = 200; // ms

  /** Gold highlight progress for the time digits; -1 = idle. */
  private highlightElapsed                  = -1;
  private static readonly HIGHLIGHT_DURATION = 300; // ms

  /** Accumulated time for the low-time warning shake (ms). Only advances when lastDisplayedSeconds < WARN_THRESHOLD. */
  private warnShakeMs = 0;

  /** Queue of heart-breaking animations. */
  private heartAnims: Array<{
    sprite:     PIXI.Sprite;
    callback:   () => void;
    elapsed:    number;
    done:       boolean;
    /** Layout scale captured at animation start; all scale factors are relative to this. */
    baseScaleX: number;
    baseScaleY: number;
  }> = [];

  private _target: number;
  private settingsSprite!: PIXI.Sprite;
  private musicSprite!:    PIXI.Sprite;

  /** Current layout configuration (determined by the most recent resize call). */
  private layout: HeaderLayout;

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig,
    initialTarget: number,
    onSettings: () => void,
  ) {
    super();
    this._target = initialTarget;
    this.layout  = screen.orientation === Orientation.Landscape
      ? landscapeLayout()
      : portraitLayout();

    this.buildBackground();
    this.buildTip();
    this.buildTime();
    this.buildLives();
    this.buildSettingsButton(onSettings);
    this.buildMusicButton();
  }

  // ── Public API ────────────────────────────────────────────────────

  /** Called when the target number changes: destroys the old tip container and rebuilds it (showing empty slots). */
  public updateTarget(target: number): void {
    this._target = target;
    this.resultElapsed = -1;
    this.rebuildTip(null, null);
  }

  /** Called when the player selects the first number; fills it into the left slot. */
  public setFirstSelected(value: number): void {
    this.resultElapsed = -1;
    this.rebuildTip(value, null);
  }

  /** Reset to two empty slots on deselect or when entering a new target. */
  public resetTip(): void {
    this.resultElapsed = -1;
    this.rebuildTip(null, null);
  }

  /**
   * Called after a successful elimination: briefly shows the full equation (a + b = Target),
   * then automatically resets to empty slots after approximately 500 ms.
   */
  public showMatchResult(a: number, b: number): void {
    this.rebuildTip(a, b);
    this.resultElapsed = 0;
  }

  /** Called every frame by GameScene; drives bounce, elimination result timer, warning shake, highlight, and heart animations. */
  public update(deltaMs: number): void {
    this.updateBounce(deltaMs);
    this.updateResultReset(deltaMs);
    this.updateWarnShake(deltaMs);
    this.updateHighlight(deltaMs);
    this.updateHeartAnims(deltaMs);
  }

  /** Update the time display, clock hand, and warning colour. No-op when the second count has not changed. */
  public updateTime(seconds: number): void {
    if (seconds === this.lastDisplayedSeconds) return;
    this.lastDisplayedSeconds = seconds;

    // Digit display (left-aligned, immediately to the right of the clock, no zero-padding)
    const s = Math.max(0, seconds).toString();
    for (const d of this.timeSprites) d.visible = false;
    for (let i = 0; i < s.length && i < this.timeSprites.length; i++) {
      const sprite   = this.timeSprites[i];
      sprite.texture = this.ctx.assets.GetTexture(`${s[i]}.png`);
      sprite.visible = true;
    }

    // Hand rotation: ratio=1 → 12 o'clock (full time); rotates clockwise as time decreases
    const ratio = Math.min(Math.max(seconds, 0) / CLOCK_REF_SECS, 1);
    this.clockHandSprite.rotation = Math.PI + (1 - ratio) * Math.PI * 2;

    // Warning colour change (skip digit tint while the highlight animation is running — managed by updateHighlight)
    const warnColor = (seconds > 0 && seconds < WARN_THRESHOLD) ? 0xFF5252 : 0xFFFFFF;
    this.clockFaceSprite.tint = warnColor;
    this.clockHandSprite.tint = warnColor;
    if (this.highlightElapsed < 0) {
      for (const s of this.timeSprites) s.tint = warnColor;
    }
  }

  /** Update the lives display: switch between full-heart and empty-heart textures. */
  public updateLives(lives: number): void {
    for (let i = 0; i < this.livesSprites.length; i++) {
      this.livesSprites[i].texture = i < lives
        ? this.ctx.assets.GetTexture('heart.png')
        : this.ctx.assets.GetTexture('heart_empty.png');
    }
  }

  /** Trigger the bounce animation and the gold highlight on the time digits when bonus time arrives. */
  public triggerClockBounce(): void {
    this.bounceElapsed   = 0;
    this.highlightElapsed = 0;
  }

  /**
   * Trigger the breaking animation for heart at liveIndex (0-based).
   * Calls callback when the animation finishes (typically passed in by GameScene to swap the texture).
   * Total duration approximately 230 ms: scale 1→1.3 (80 ms) + scale 1.3→0 (150 ms).
   */
  public triggerHeartLost(liveIndex: number, callback: () => void): void {
    const sprite = this.livesSprites[liveIndex];
    if (!sprite) { callback(); return; }
    this.heartAnims.push({
      sprite, callback, elapsed: 0, done: false,
      baseScaleX: sprite.scale.x,
      baseScaleY: sprite.scale.y,
    });
  }

  /** Return the centre position of heart at liveIndex (0-based) in the Header's parent coordinate space. */
  public getHeartCenter(liveIndex: number): { x: number; y: number } {
    const L = this.layout;
    return {
      x: this.x + L.livesStartX + liveIndex * (L.heartSize + L.heartGap) + L.heartSize / 2,
      y: this.y + L.livesY + L.heartSize / 2,
    };
  }

  /**
   * Called by the parent scene when the orientation changes; selects a new layout
   * and repositions all child elements. Also rebuilds the tip area (rebuildTip)
   * to match the new coordinate system.
   */
  public resize(screen: ScreenConfig): void {
    this.layout = screen.orientation === Orientation.Landscape
      ? landscapeLayout()
      : portraitLayout();

    const L = this.layout;

    // Self offset
    if (screen.orientation === Orientation.Landscape) {
      this.x = 350; this.y = 10;
    } else {
      this.x = 30;  this.y = 10;
    }

    // Background bar
    this.bgGraphics.clear();
    drawHeaderBar(this.bgGraphics, L.barW, L.barH);

    // Clock container
    this.clockContainer.x = L.clockX;
    this.clockContainer.y = L.clockY;
    this.clockFaceSprite.width  = L.clockSize;
    this.clockFaceSprite.height = L.clockSize;

    // Hand — proportional to clockSize
    const handW = Math.round(L.clockSize * 0.063);
    const handH = Math.round(L.clockSize * 0.350);
    this.clockHandSprite.width  = handW;
    this.clockHandSprite.height = handH;
    this.clockHandSprite.pivot.set(handW / 2, 0);
    this.clockHandSprite.x = L.clockSize / 2;
    this.clockHandSprite.y = L.clockSize / 2;

    // Time digit sprites
    for (let i = 0; i < this.timeSprites.length; i++) {
      const s  = this.timeSprites[i];
      s.width  = L.timeDigitW;
      s.height = L.timeDigitH;
      s.x      = L.timeStartX + i * (L.timeDigitW + L.timeDigitGap);
      s.y      = L.timeY;
    }
    this.lastDisplayedSeconds = -1; // force refresh on the next frame

    // Lives hearts
    for (let i = 0; i < this.livesSprites.length; i++) {
      const s  = this.livesSprites[i];
      s.width  = L.heartSize;
      s.height = L.heartSize;
      s.x      = L.livesStartX + i * (L.heartSize + L.heartGap);
      s.y      = L.livesY;
    }

    // Settings button
    this.settingsSprite.width  = L.settingsSize;
    this.settingsSprite.height = L.settingsSize;
    this.settingsSprite.x      = L.settingsX;
    this.settingsSprite.y      = L.settingsY;

    // Music button
    this.musicSprite.width  = L.musicSize;
    this.musicSprite.height = L.musicSize;
    this.musicSprite.x      = L.musicX;
    this.musicSprite.y      = L.musicY;

    // Tip area: destroy the old container and rebuild with the new coordinates
    this.rebuildTip(null, null);
    this._target = this._target; // no-op; keeps target unchanged
  }

  /**
   * Return the position of the clock centre in the Header's parent coordinate space
   * (GameScene local coordinates), used to anchor the flying bonus animation's end point.
   */
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

  /**
   * Tip area: □ + □ = Target; slots are filled in as the player selects numbers.
   * @param first  Left slot value; null = show empty slot
   * @param second Right slot value; null = show empty slot
   */
  private rebuildTip(first: number | null, second: number | null): void {
    if (this.tipContainer) {
      this.removeChild(this.tipContainer);
      this.tipContainer.destroy({ children: true });
    }
    this.tipContainer = new PIXI.Container();
    const L = this.layout;

    // Left slot
    this.addSlotOrValue(this.tipContainer, first,  L.tipSlot1X, L.tipY, L.tipSlotW, L.tipSlotH);

    // Plus sign — 2/3 of slot size, centred within its allocated space
    const symW = Math.round(L.tipSlotW * 2 / 3);
    const symH = Math.round(L.tipSlotH * 2 / 3);
    const symDY = Math.round((L.tipSlotH - symH) / 2);
    const symDX = Math.round((L.tipSlotW - symW) / 2);
    const plus   = new PIXI.Sprite(this.ctx.assets.GetTexture('plus.png'));
    plus.width   = symW; plus.height = symH;
    plus.x       = L.tipPlusX + symDX; plus.y = L.tipY + symDY;
    this.tipContainer.addChild(plus);

    // Right slot
    this.addSlotOrValue(this.tipContainer, second, L.tipSlot2X, L.tipY, L.tipSlotW, L.tipSlotH);

    // Equals sign — same reduced size
    const equa   = new PIXI.Sprite(this.ctx.assets.GetTexture('equa.png'));
    equa.width   = symW; equa.height = symH;
    equa.x       = L.tipEquaX + symDX; equa.y = L.tipY + symDY;
    this.tipContainer.addChild(equa);

    // Target number (may be 1 or 2 digits)
    this._target.toString().split('').forEach((ch, i) => {
      const s   = new PIXI.Sprite(this.ctx.assets.GetTexture(`${ch}.png`));
      s.width   = L.tipSlotW; s.height = L.tipSlotH;
      s.x       = L.tipTargetX + i * L.tipTargetStep;
      s.y       = L.tipY;
      this.tipContainer.addChild(s);
    });

    this.addChild(this.tipContainer);
  }

  /**
   * Draw an empty slot or a digit sprite at (x, y) inside the container.
   * - value === null → draw a rounded-rectangle empty slot (grey border + "?" mark)
   * - value !== null → draw the corresponding digit sprite (two-digit values are scaled side-by-side to fit the slot width)
   */
  private addSlotOrValue(
    container: PIXI.Container,
    value: number | null,
    x: number, y: number, w: number, h: number,
  ): void {
    if (value === null) {
      const g = new PIXI.Graphics();
      g.lineStyle(2, 0xC4A068, 0.8);   // warm gold border, matches header palette
      g.beginFill(0xF5E8C8, 1);         // warm cream fill
      g.drawRoundedRect(x, y, w, h, 10);
      g.endFill();
      // Question mark: drawn programmatically, replacing the original PIXI.Text('?')
      drawQuestionMark(g, x + w / 2, y + h / 2, h);
      container.addChild(g);
    } else {
      const digits = value.toString().split('');
      if (digits.length === 1) {
        const s   = new PIXI.Sprite(this.ctx.assets.GetTexture(`${digits[0]}.png`));
        s.width   = w; s.height = h;
        s.x       = x; s.y      = y;
        container.addChild(s);
      } else {
        // Two-digit number: each digit takes ~48% of the width with a small gap
        const dw = Math.floor((w - 4) / 2);
        digits.forEach((ch, i) => {
          const s   = new PIXI.Sprite(this.ctx.assets.GetTexture(`${ch}.png`));
          s.width   = dw; s.height = h;
          s.x       = x + i * (dw + 4); s.y = y;
          container.addChild(s);
        });
      }
    }
  }

  /** Build the initial tip (both slots empty) at construction time. */
  private buildTip(): void {
    this.rebuildTip(null, null);
  }

  private buildTime(): void {
    const L = this.layout;

    this.clockContainer   = new PIXI.Container();
    this.clockContainer.x = L.clockX;
    this.clockContainer.y = L.clockY;

    // Clock face
    this.clockFaceSprite         = new PIXI.Sprite(this.ctx.assets.GetTexture('clock_face.png'));
    this.clockFaceSprite.width   = L.clockSize;
    this.clockFaceSprite.height  = L.clockSize;
    this.clockContainer.addChild(this.clockFaceSprite);

    // Hand: pivot at top-centre, placed at the clock face centre.
    // Width ≈ 6.3% of clockSize, height ≈ 35% of clockSize (reaches ~70% of face radius).
    const r     = L.clockSize / 2;
    const handW = Math.round(L.clockSize * 0.063);
    const handH = Math.round(L.clockSize * 0.350);
    this.clockHandSprite           = new PIXI.Sprite(this.ctx.assets.GetTexture('clock_hand.png'));
    this.clockHandSprite.width     = handW;
    this.clockHandSprite.height    = handH;
    this.clockHandSprite.pivot.set(handW / 2, 0);
    this.clockHandSprite.x        = r;
    this.clockHandSprite.y        = r;
    this.clockHandSprite.rotation = Math.PI; // 12 o'clock position
    this.clockContainer.addChild(this.clockHandSprite);

    this.addChild(this.clockContainer);

    // Time digits (up to 3 digits, left-aligned immediately to the right of the clock)
    for (let i = 0; i < 3; i++) {
      const s  = new PIXI.Sprite(this.ctx.assets.GetTexture('0.png'));
      s.width  = L.timeDigitW;
      s.height = L.timeDigitH;
      s.x      = L.timeStartX + i * (L.timeDigitW + L.timeDigitGap);
      s.y      = L.timeY;
      s.visible = false;
      this.addChild(s);
      this.timeSprites.push(s);
    }
  }

  private buildLives(): void {
    const L = this.layout;
    for (let i = 0; i < 3; i++) {
      const s  = new PIXI.Sprite(this.ctx.assets.GetTexture('heart.png'));
      s.width  = L.heartSize;
      s.height = L.heartSize;
      s.x      = L.livesStartX + i * (L.heartSize + L.heartGap);
      s.y      = L.livesY;
      this.addChild(s);
      this.livesSprites.push(s);
    }
  }

  private buildSettingsButton(onSettings: () => void): void {
    const L = this.layout;
    this.settingsSprite        = new PIXI.Sprite(this.ctx.assets.GetTexture('settings.png'));
    this.settingsSprite.width  = L.settingsSize;
    this.settingsSprite.height = L.settingsSize;
    this.settingsSprite.x      = L.settingsX;
    this.settingsSprite.y      = L.settingsY;
    this.addChild(this.settingsSprite);
    this.ctx.input.registerUI(new UIElement({ zIndex: 15, sprite: this.settingsSprite, onTap: onSettings }));
  }

  private buildMusicButton(): void {
    const L   = this.layout;
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

  // ── Elimination result timer ──────────────────────────────────────

  private updateResultReset(deltaMs: number): void {
    if (this.resultElapsed < 0) return;
    this.resultElapsed += deltaMs;
    if (this.resultElapsed >= Header.RESULT_DISPLAY_MS) {
      this.resultElapsed = -1;
      this.rebuildTip(null, null);
    }
  }

  // ── Low-time warning shake ────────────────────────────────────────

  /**
   * When remaining time is > 0 and < WARN_THRESHOLD, apply a left/right
   * sinusoidal shake to the clock container and time digits
   * (amplitude 3px, period approximately 100 ms).
   */
  private updateWarnShake(deltaMs: number): void {
    const warn = this.lastDisplayedSeconds > 0 && this.lastDisplayedSeconds < WARN_THRESHOLD;
    if (warn) {
      this.warnShakeMs += deltaMs;
    } else {
      this.warnShakeMs = 0;
    }
    const offset = warn ? Math.round(Math.sin(this.warnShakeMs / 50) * 3) : 0;
    const L = this.layout;

    this.clockContainer.x = L.clockX + offset;
    for (let i = 0; i < this.timeSprites.length; i++) {
      this.timeSprites[i].x =
        L.timeStartX + i * (L.timeDigitW + L.timeDigitGap) + offset;
    }
  }

  // ── Bounce animation ─────────────────────────────────────────────

  private updateBounce(deltaMs: number): void {
    if (this.bounceElapsed < 0) return;

    this.bounceElapsed += deltaMs;
    const t = this.bounceElapsed / Header.BOUNCE_DURATION;

    if (t >= 1) {
      this.clockContainer.scale.set(1);
      this.bounceElapsed = -1;
      return;
    }

    // Sinusoidal bounce: 0 → 1 → 0, peak scale 1.25
    const scale = 1 + 0.25 * Math.sin(t * Math.PI);
    this.clockContainer.scale.set(scale);
  }

  // ── Time digit gold highlight ─────────────────────────────────────

  /**
   * After bonus time arrives, fade the visible time digits from gold back to
   * normal colour (white or warning red) using an ease-in-out curve.
   * Total duration: HIGHLIGHT_DURATION.
   */
  private updateHighlight(deltaMs: number): void {
    if (this.highlightElapsed < 0) return;
    this.highlightElapsed += deltaMs;
    const raw = Math.min(this.highlightElapsed / Header.HIGHLIGHT_DURATION, 1);
    // ease-in-out
    const eased = raw < 0.5 ? 2 * raw * raw : -1 + (4 - 2 * raw) * raw;

    // Target colour: red during warning, otherwise white
    const targetTint = (this.lastDisplayedSeconds > 0 && this.lastDisplayedSeconds < WARN_THRESHOLD)
      ? 0xFF5252 : 0xFFFFFF;
    const toR = (targetTint >> 16) & 0xFF;
    const toG = (targetTint >>  8) & 0xFF;
    const toB =  targetTint        & 0xFF;

    // Gold #FFD700 → targetTint
    const r = Math.round(0xFF + (toR - 0xFF) * eased);
    const g = Math.round(0xD7 + (toG - 0xD7) * eased);
    const b = Math.round(0x00 + (toB - 0x00) * eased);
    const tint = (r << 16) | (g << 8) | b;

    for (const s of this.timeSprites) if (s.visible) s.tint = tint;

    if (raw >= 1) {
      this.highlightElapsed = -1;
      for (const s of this.timeSprites) s.tint = targetTint;
    }
  }

  // ── Heart breaking animation ──────────────────────────────────────

  /**
   * Apply a scale pop to a heart that is currently playing its breaking animation:
   *   Phase 1 (0–80 ms):   scale 1 → 1.3
   *   Phase 2 (80–230 ms): scale 1.3 → 0
   * Calls callback when the animation finishes (passed in by GameScene to swap to the empty-heart texture).
   */
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
          // Restore to layout size before firing the callback (which swaps the texture).
          anim.sprite.scale.x = anim.baseScaleX;
          anim.sprite.scale.y = anim.baseScaleY;
          anim.done = true;
          anim.callback();
        }
      }
    }
    // Remove completed animations
    this.heartAnims = this.heartAnims.filter(a => !a.done);
  }
}
