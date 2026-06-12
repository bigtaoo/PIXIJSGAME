/**
 * baseHeader.ts
 *
 * Abstract base for Header (main game) and DailyChallengeHeader.
 *
 * Provides:
 *  - buildClock / resizeClock — clock face + proportional hand
 *  - buildMusicButton / applyMusicTint
 *  - rebuildTipContainer — hint formula (□ + □ = Target)
 *  - tickTipResultReset — auto-reset tip after match display
 *  - addSlotOrValue — empty slot or digit sprite(s)
 *  - WARN_THRESHOLD / RESULT_DISPLAY_MS constants
 */
import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';
import { drawQuestionMark } from './graphicsFactory';

/** Minimum layout info needed to render the hint-formula tip area. */
export interface TipLayout {
  tipY: number;
  tipSlotW: number;
  tipSlotH: number;
  tipSlot1X: number;
  tipPlusX: number;
  tipSlot2X: number;
  tipEquaX: number;
  tipTargetX: number;
  tipTargetStep: number;
}

export abstract class BaseHeader extends PIXI.Container {
  // ── Clock ──────────────────────────────────────────────────────────────────
  protected clockContainer!: PIXI.Container;
  protected clockFace!: PIXI.Sprite;
  protected clockHand!: PIXI.Sprite;

  // ── Tip formula ────────────────────────────────────────────────────────────
  protected tipContainer!: PIXI.Container;
  protected tipResultElapsed = -1;

  // ── Music ──────────────────────────────────────────────────────────────────
  protected musicSprite!: PIXI.Sprite;
  protected musicOffSlash!: PIXI.Graphics;

  // ── Shared constants ───────────────────────────────────────────────────────
  protected static readonly WARN_THRESHOLD = 10;
  protected static readonly RESULT_DISPLAY_MS = 500;

  // ── Slot style (set in subclass constructor) ───────────────────────────────
  protected emptySlotBorderColor = 0xbbbbbb;
  protected emptySlotBorderAlpha = 1;
  protected emptySlotBorderWidth = 2;
  protected emptySlotFillColor = 0xf0f0f0;

  /**
   * true  → plus/equals signs use full slot dimensions (DailyChallengeHeader)
   * false → scaled to 2/3 and centred (Header)
   */
  protected tipSymbolFullSize = false;

  constructor(protected readonly ctx: AppContext) {
    super();
  }

  // ── Abstract ───────────────────────────────────────────────────────────────

  /** Current target number shown in the tip formula. */
  protected abstract getTarget(): number;

  /**
   * Layout snapshot for auto-resetting the tip after a result display.
   * Return the current layout cast to TipLayout (all layout types satisfy it).
   */
  protected abstract getCurrentTipLayout(): TipLayout;

  // ── Protected clock helpers ────────────────────────────────────────────────

  /** Construct and add the clock container (face + proportional hand). */
  protected buildClock(x: number, y: number, size: number): void {
    this.clockContainer = new PIXI.Container();
    this.clockContainer.x = x;
    this.clockContainer.y = y;

    this.clockFace = new PIXI.Sprite(this.ctx.assets.GetTexture('clock_face.png'));
    this.clockFace.width = size;
    this.clockFace.height = size;
    this.clockContainer.addChild(this.clockFace);

    const r = size / 2;
    const handW = Math.round(size * 0.063);
    const handH = Math.round(size * 0.35);
    this.clockHand = new PIXI.Sprite(this.ctx.assets.GetTexture('clock_hand.png'));
    this.clockHand.width = handW;
    this.clockHand.height = handH;
    this.clockHand.pivot.set(handW / 2, 0);
    this.clockHand.x = r;
    this.clockHand.y = r;
    this.clockHand.rotation = Math.PI;
    this.clockContainer.addChild(this.clockHand);

    this.addChild(this.clockContainer);
  }

  /** Reposition and resize an existing clock (call from resize()). */
  protected resizeClock(x: number, y: number, size: number): void {
    this.clockContainer.x = x;
    this.clockContainer.y = y;
    this.clockFace.width = size;
    this.clockFace.height = size;
    const r = size / 2;
    const handW = Math.round(size * 0.063);
    const handH = Math.round(size * 0.35);
    this.clockHand.width = handW;
    this.clockHand.height = handH;
    this.clockHand.pivot.set(handW / 2, 0);
    this.clockHand.x = r;
    this.clockHand.y = r;
  }

  // ── Protected music helpers ────────────────────────────────────────────────

  /** Create, add, and register the music-toggle button. */
  protected buildMusicButton(x: number, y: number, size: number): void {
    const btn = new PIXI.Sprite(this.ctx.assets.GetTexture('music.png'));
    btn.width = size;
    btn.height = size;
    btn.x = x;
    btn.y = y;
    this.addChild(btn);
    this.musicSprite = btn;

    const slash = new PIXI.Graphics();
    this.drawMusicSlash(slash, x, y, size);
    this.addChild(slash);
    this.musicOffSlash = slash;

    this.applyMusicState();

    this.ctx.input.registerUI(
      new UIElement({
        zIndex: 15,
        sprite: btn,
        onTap: () => {
          this.ctx.audio.toggleMusic();
          this.applyMusicState();
        },
      })
    );
  }

  /** Reposition slash and sprite after a resize. */
  protected resizeMusicButton(x: number, y: number, size: number): void {
    this.musicSprite.x = x;
    this.musicSprite.y = y;
    this.musicSprite.width = size;
    this.musicSprite.height = size;
    this.drawMusicSlash(this.musicOffSlash, x, y, size);
  }

  private drawMusicSlash(g: PIXI.Graphics, x: number, y: number, size: number): void {
    g.clear();
    g.lineStyle(Math.round(size * 0.09), 0x6d4c41, 0.9);
    g.moveTo(x + size, y);
    g.lineTo(x, y + size);
  }

  protected applyMusicTint(sprite: PIXI.Sprite): void {
    sprite.tint = this.ctx.audio.isMusicEnabled() ? 0xffffff : 0x999999;
    sprite.alpha = this.ctx.audio.isMusicEnabled() ? 1 : 0.55;
  }

  protected applyMusicState(): void {
    const on = this.ctx.audio.isMusicEnabled();
    this.applyMusicTint(this.musicSprite);
    if (this.musicOffSlash) this.musicOffSlash.visible = !on;
  }

  // ── Protected tip helpers ──────────────────────────────────────────────────

  /**
   * Destroy the old tip container and rebuild the hint formula.
   *
   * @param first  Left-slot value; null = empty slot
   * @param second Right-slot value; null = empty slot
   * @param L      Tip-area layout values
   */
  protected rebuildTipContainer(first: number | null, second: number | null, L: TipLayout): void {
    if (this.tipContainer) {
      this.removeChild(this.tipContainer);
      this.tipContainer.destroy({ children: true });
    }
    this.tipContainer = new PIXI.Container();
    const { tipY: Y, tipSlotW: W, tipSlotH: H } = L;

    this.addSlotOrValue(this.tipContainer, first, L.tipSlot1X, Y, W, H);
    this.addTipSymbol('plus.png', L.tipPlusX, Y, W, H);
    this.addSlotOrValue(this.tipContainer, second, L.tipSlot2X, Y, W, H);
    this.addTipSymbol('equa.png', L.tipEquaX, Y, W, H);

    this.getTarget()
      .toString()
      .split('')
      .forEach((ch, i) => {
        const s = new PIXI.Sprite(this.ctx.assets.GetTexture(`${ch}.png`));
        s.width = W;
        s.height = H;
        s.x = L.tipTargetX + i * L.tipTargetStep;
        s.y = Y;
        this.tipContainer.addChild(s);
      });

    this.addChild(this.tipContainer);
  }

  /** Advance the tip-result timer; resets to empty slots when expired. */
  protected tickTipResultReset(deltaMs: number): void {
    if (this.tipResultElapsed < 0) return;
    this.tipResultElapsed += deltaMs;
    if (this.tipResultElapsed >= BaseHeader.RESULT_DISPLAY_MS) {
      this.tipResultElapsed = -1;
      this.rebuildTipContainer(null, null, this.getCurrentTipLayout());
    }
  }

  /**
   * Draw an empty rounded-rect slot (with "?") or digit sprite(s) at (x, y).
   */
  protected addSlotOrValue(
    container: PIXI.Container,
    value: number | null,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    if (value === null) {
      const g = new PIXI.Graphics();
      g.lineStyle(this.emptySlotBorderWidth, this.emptySlotBorderColor, this.emptySlotBorderAlpha);
      g.beginFill(this.emptySlotFillColor, 1);
      g.drawRoundedRect(x, y, w, h, 10);
      g.endFill();
      drawQuestionMark(g, x + w / 2, y + h / 2, h);
      container.addChild(g);
    } else {
      const digits = value.toString().split('');
      if (digits.length === 1) {
        const s = new PIXI.Sprite(this.ctx.assets.GetTexture(`${digits[0]}.png`));
        s.width = w;
        s.height = h;
        s.x = x;
        s.y = y;
        container.addChild(s);
      } else {
        const dw = Math.floor((w - 4) / 2);
        digits.forEach((ch, i) => {
          const s = new PIXI.Sprite(this.ctx.assets.GetTexture(`${ch}.png`));
          s.width = dw;
          s.height = h;
          s.x = x + i * (dw + 4);
          s.y = y;
          container.addChild(s);
        });
      }
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Add a plus or equals symbol sprite to the tip container.
   * Full-size (DC style) when tipSymbolFullSize=true; 2/3 centred (game style) otherwise.
   */
  private addTipSymbol(texture: string, x: number, y: number, w: number, h: number): void {
    const sprite = new PIXI.Sprite(this.ctx.assets.GetTexture(texture));
    if (this.tipSymbolFullSize) {
      sprite.width = w;
      sprite.height = h;
      sprite.x = x;
      sprite.y = y;
    } else {
      const sW = Math.round((w * 2) / 3),
        sH = Math.round((h * 2) / 3);
      sprite.width = sW;
      sprite.height = sH;
      sprite.x = x + Math.round((w - sW) / 2);
      sprite.y = y + Math.round((h - sH) / 2);
    }
    this.tipContainer.addChild(sprite);
  }
}
