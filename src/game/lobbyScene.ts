import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { STAGES, StageData } from './stageConfig';
import { StageManager } from './stageManager';
import { StarManager } from './starManager';
import { UIElement } from '../inputSystem/uiElement';
import { GAME_WIDTH, GAME_HEIGHT } from './consts';
import { drawCircleCell, drawCircleCellSelected, makeTexture } from './graphicsFactory';
import { getDailyBestScore, getStreakDays } from './dailyChallengeStore';
import { getLobbyLayout, LobbyLayout } from './lobbyLayout';
import { Orientation } from './enums';
import { DigitDisplay } from './digitDisplay';

// ── Node star dimensions ──────────────────────────────────────────────────────
const STAR_SIZE    = 22;
const STAR_GAP     = 3;
const TOTAL_STAR_W = 3 * STAR_SIZE + 2 * STAR_GAP;
// Padding around stars for the white pill background
const STAR_PAD_X   = 6;
const STAR_PAD_Y   = 4;

// ── Adventure path ────────────────────────────────────────────────────────────
const PATH_COLOR_DONE   = 0x6D4C41; // dark brown, completed segment
const PATH_COLOR_LOCKED = 0x8B6E47; // mid warm-brown, locked segment
const PATH_WIDTH        = 6;        // line width (logical pixels)
const PATH_DASH         = 14;       // dash length
const PATH_GAP          = 8;        // gap between dashes
const PATH_ALPHA_DONE   = 0.8;
const PATH_ALPHA_LOCKED = 0.55;

// ── Daily challenge animation ─────────────────────────────────────────────────
const GLOW_RADIUS_MIN  = 68;  // minimum glow radius (slightly larger than the circle icon radius of 65)
const GLOW_RADIUS_RANGE = 8;  // glow amplitude
const GLOW_PERIOD_MS   = 1200;
const PULSE_PERIOD_MS  = 800; // node pulse period
const BOUNCE_DURATION  = 100; // click bounce animation duration (ms)

// ── Daily challenge area: icon + digit row dimensions (1.5 × 1.3 = 1.95× original) ─
const DC_ICON_H  = 59;
const DC_ICON_W  = 59;
const DC_DIGIT_H = 59;
const DC_DIGIT_W = Math.round(DC_DIGIT_H * 120 / 160); // ~44
const DC_GAP     = 12;

// ── Node stage number dimensions ─────────────────────────────────────────────
const NODE_DIGIT_H = Math.round(150 * 0.85); // 127 — 85% of NODE_SIZE
const NODE_DIGIT_W = Math.round(NODE_DIGIT_H * 120 / 160); // ~95

// Per-node runtime data for repositioning on resize
interface NodeEntry {
  stageIndex:    number;
  card:          PIXI.Sprite;
  numDisplay:    DigitDisplay;
  starContainer: PIXI.Container;
  starSprites:   PIXI.Sprite[];
}

// Daily challenge element refs for repositioning on resize
interface DailyChallengeEntry {
  circle:        PIXI.Graphics;
  icon:          PIXI.Sprite;
  bestRow:       PIXI.Container;
  bestDisplay:   DigitDisplay;
  streakRow:     PIXI.Container;
  streakDisplay: DigitDisplay;
  hit:           PIXI.Sprite;
  /** Breathing glow Graphics, rendered below the circle */
  glow:          PIXI.Graphics;
}

const MUSIC_BTN_SIZE = 109;  // 56 × 1.5 × 1.3

export class LobbyScene extends PIXI.Container {
  private readonly screen: ScreenConfig;

  private static readonly NODE_SIZE  = 150;
  private static readonly DAILY_SIZE = 254;  // 130 × 1.5 × 1.3

  private bg!: PIXI.Sprite;

  private nodeEntries: NodeEntry[]         = [];
  private dailyEntry!: DailyChallengeEntry;
  private musicBtn!:   PIXI.Sprite;

  // Parallel arrays kept for refresh()
  private stageCards:         PIXI.Sprite[]    = [];
  private nodeStarContainers: PIXI.Container[] = [];
  private nodeStarSprites:    PIXI.Sprite[][]  = [];

  // ── Animation state ──────────────────────────────────────────────────────────
  private pulseMs        = 0;
  private glowMs         = 0;
  private bounceElapsed  = -1;
  /** Current stage node Sprite (null means all stages are completed). */
  private currentCard: PIXI.Sprite | null = null;

  // ── Path / panel ──────────────────────────────────────────────────────────────
  private pathGraphics!: PIXI.Graphics;
  private panelGraphics!: PIXI.Graphics;

  private cardTexture!:         PIXI.Texture;
  private cardSelectedTexture!: PIXI.Texture;

  constructor(
    private readonly ctx: AppContext,
    private readonly onSelectStage: (stage: StageData) => void,
    private readonly onDailyChallenge: () => void,
  ) {
    super();
    this.screen = new ScreenConfig();
    this.screen.update(GAME_WIDTH, GAME_HEIGHT);
    this.buildUI();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  public resize(windowWidth: number, windowHeight: number): void {
    this.screen.update(windowWidth, windowHeight);
    this.x = 0;
    this.y = 0;
    this.scale.set(this.screen.scale);
    this.updateBgSize();
    this.repositionAll();
  }

  public refresh(): void {
    const maxCompleted = StageManager.getMaxCompleted();
    this.currentCard = null; // reset; reassigned by the loop below

    STAGES.forEach((stage, i) => {
      const card      = this.stageCards[i];
      const starCont  = this.nodeStarContainers[i];
      const starSprts = this.nodeStarSprites[i];
      if (!card || !starCont || !starSprts) return;

      const completed = stage.stageIndex <= maxCompleted;
      const isCurrent = stage.stageIndex === maxCompleted + 1;

      const entry = this.nodeEntries[i];
      if (isCurrent) {
        card.texture   = this.cardSelectedTexture;
        card.tint      = 0xFFFFFF;
        card.alpha     = 1;
        this.currentCard = card;
        if (entry) entry.numDisplay.tint = 0xF5EAC8;
      } else if (completed) {
        card.texture = this.cardTexture;
        card.tint    = 0xFFFFFF;
        card.alpha   = 1;
        if (entry) entry.numDisplay.tint = 0xF5EAC8;
      } else {
        card.texture = this.cardTexture;
        card.tint    = 0xB09060;
        card.alpha   = 0.75;
        if (this.currentCard === card) this.currentCard = null;
        if (entry) entry.numDisplay.tint = 0xB09060;
      }

      if (completed || isCurrent) {
        const stars = StarManager.getStars(stage.stageIndex);
        starCont.visible = stars > 0;
        for (let s = 0; s < 3; s++) {
          const sp = starSprts[s]!;
          sp.tint  = s < stars ? 0xEAB830 : 0x888888;
          sp.alpha = s < stars ? 1.0 : 0.35;
        }
      } else {
        starCont.visible = false;
      }
    });

    this.refreshDailyRows();
    this.refreshPath();
  }

  // ── Build helpers ───────────────────────────────────────────────────────────

  private buildUI(): void {
    this.buildBackground();
    this.buildPath();          // path renders below the nodes
    this.buildAdventureMap();
    this.buildPanel();         // background panel renders below the daily challenge / music button
    this.buildDailyChallenge();
    this.buildMusicButton();
  }

  // ── update (called every frame by SceneCoordinator) ──────────────────────────

  public update(deltaMs: number): void {
    this.pulseMs += deltaMs;
    this.glowMs  += deltaMs;
    this.updateCurrentNodePulse();
    this.updateDailyGlow();
    this.updateDailyBounce(deltaMs);
  }

  private buildBackground(): void {
    this.bg = new PIXI.Sprite(this.ctx.assets.GetTexture('lobby_bg.png'));
    this.addChild(this.bg);
  }

  private buildAdventureMap(): void {
    const sz = LobbyScene.NODE_SIZE;
    const r  = sz / 2;

    this.cardTexture         = makeTexture(this.ctx.renderer, g => drawCircleCell(g, sz), sz);
    this.cardSelectedTexture = makeTexture(this.ctx.renderer, g => drawCircleCellSelected(g, sz), sz);

    // Build nodes using the portrait layout initially (resize() repositions them for the current orientation)
    const layout = getLobbyLayout(this.screen);

    STAGES.forEach((stage, i) => {
      const pos = layout.nodePositions[i];
      if (!pos) return;
      const cx = pos.x;
      const cy = pos.y;

      const card = this.buildStageButton(stage, cx - r, cy - r, sz);
      this.stageCards.push(card);

      const numDisplay = new DigitDisplay(this.ctx, NODE_DIGIT_W, NODE_DIGIT_H, 0xFFFFFF, Math.round(NODE_DIGIT_W * 2 / 3));
      numDisplay.update(stage.stageIndex);
      numDisplay.x = cx - numDisplay.totalWidth / 2;
      numDisplay.y = cy - NODE_DIGIT_H / 2;
      this.addChild(numDisplay);

      const { container: starContainer, sprites: starSprites } = this.buildStarRow();
      starContainer.x       = cx - TOTAL_STAR_W / 2;
      starContainer.y       = cy + r + 4;
      starContainer.visible = false;
      this.addChild(starContainer);
      this.nodeStarContainers.push(starContainer);
      this.nodeStarSprites.push(starSprites);

      this.nodeEntries.push({
        stageIndex: stage.stageIndex,
        card, numDisplay, starContainer, starSprites,
      });
    });

    this.refresh();
    this.refreshPath();
  }

  private buildStarRow(): { container: PIXI.Container; sprites: PIXI.Sprite[] } {
    const container = new PIXI.Container();

    // White pill background — makes stars legible on any map background.
    const pillW = TOTAL_STAR_W + STAR_PAD_X * 2;
    const pillH = STAR_SIZE    + STAR_PAD_Y * 2;
    const pill  = new PIXI.Graphics();
    pill.beginFill(0xFFFFFF, 0.88);
    pill.drawRoundedRect(-STAR_PAD_X, -STAR_PAD_Y, pillW, pillH, pillH / 2);
    pill.endFill();
    container.addChild(pill);

    const sprites: PIXI.Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const s    = new PIXI.Sprite(this.ctx.assets.GetTexture('star.png'));
      s.width    = STAR_SIZE;
      s.height   = STAR_SIZE;
      s.x        = i * (STAR_SIZE + STAR_GAP);
      s.y        = 0;
      s.tint     = 0x888888;
      s.alpha    = 0.45;
      container.addChild(s);
      sprites.push(s);
    }
    return { container, sprites };
  }

  private buildDailyChallenge(): void {
    const layout = getLobbyLayout(this.screen);
    const { x, y } = layout.dailyChallengePos;
    const sz = LobbyScene.DAILY_SIZE;
    const r  = sz / 2;

    // Breathing glow (rendered below the circular icon)
    const glow = new PIXI.Graphics();
    glow.x = x;
    glow.y = y;
    this.addChild(glow);

    const circle = new PIXI.Graphics();
    circle.lineStyle(4, 0x6D4C41, 1);
    circle.beginFill(0xC8862A);
    circle.drawCircle(0, 0, r);
    circle.endFill();
    circle.x = x;
    circle.y = y;
    this.addChild(circle);

    const icon = new PIXI.Sprite(this.ctx.assets.GetTexture('daily_challenge_icon.png'));
    const targetPx  = sz * 0.7;
    const iconScale = targetPx / Math.max(icon.texture.width, icon.texture.height);
    icon.width  = icon.texture.width  * iconScale;
    icon.height = icon.texture.height * iconScale;
    icon.anchor.set(0.5, 0.5);
    icon.x = x;
    icon.y = y;
    this.addChild(icon);

    const best   = this.buildIconDigitRow('trophy.png');
    this.addChild(best.container);

    const streak = this.buildIconDigitRow('fire.png');
    this.addChild(streak.container);

    const hit = new PIXI.Sprite(PIXI.Texture.EMPTY);
    hit.width  = sz;
    hit.height = sz;
    hit.x      = x - r;
    hit.y      = y - r;
    this.addChild(hit);
    this.ctx.input.registerUI(
      new UIElement({
        zIndex: 5,
        sprite: hit,
        onTap: () => {
          this.ctx.audio.playClick();
          this.bounceElapsed = 0;
          this.onDailyChallenge();
        },
      }),
    );

    this.dailyEntry = {
      circle, icon, glow,
      bestRow:       best.container,   bestDisplay:   best.display,
      streakRow:     streak.container, streakDisplay: streak.display,
      hit,
    };

    this.refreshDailyRows();
  }

  private buildIconDigitRow(iconKey: string): { container: PIXI.Container; display: DigitDisplay } {
    const container  = new PIXI.Container();
    const iconSprite = new PIXI.Sprite(this.ctx.assets.GetTexture(iconKey));
    iconSprite.width  = DC_ICON_W;
    iconSprite.height = DC_ICON_H;
    iconSprite.x      = 0;
    iconSprite.y      = (DC_DIGIT_H - DC_ICON_H) / 2;
    container.addChild(iconSprite);

    const display = new DigitDisplay(this.ctx, DC_DIGIT_W, DC_DIGIT_H, 0xF5E6C8);
    display.x = DC_ICON_W + DC_GAP;
    display.y = 0;
    container.addChild(display);

    return { container, display };
  }

  /**
   * Refresh the daily challenge digit rows with the latest values and re-centre them
   * at the current coordinates.  Called by both refresh() and repositionAll().
   */
  private refreshDailyRows(): void {
    if (!this.dailyEntry) return;

    const layout = getLobbyLayout(this.screen);
    const { x, y } = layout.dailyChallengePos;
    const dr = LobbyScene.DAILY_SIZE / 2;

    const best = getDailyBestScore();
    if (best > 0) {
      this.dailyEntry.bestDisplay.update(best);
      const rowW = DC_ICON_W + DC_GAP + this.dailyEntry.bestDisplay.totalWidth;
      this.dailyEntry.bestRow.x       = x - rowW / 2;
      this.dailyEntry.bestRow.y       = y + dr + 8;
      this.dailyEntry.bestRow.visible = true;
    } else {
      this.dailyEntry.bestRow.visible = false;
    }

    const streakDays = getStreakDays();
    this.dailyEntry.streakDisplay.update(streakDays);
    const streakW = DC_ICON_W + DC_GAP + this.dailyEntry.streakDisplay.totalWidth;
    this.dailyEntry.streakRow.x       = x - streakW / 2;
    this.dailyEntry.streakRow.y       = y + dr + (best > 0 ? 82 : 58);
    this.dailyEntry.streakRow.visible = true;
  }

  // ── Resize helpers ──────────────────────────────────────────────────────────

  private updateBgSize(): void {
    if (!this.bg) return;
    const canvasW = this.screen.width;
    const canvasH = this.screen.height;
    const texW    = this.bg.texture.width;
    const texH    = this.bg.texture.height;
    const scale   = Math.max(canvasW / texW, canvasH / texH);
    const dispW   = texW * scale;
    const dispH   = texH * scale;
    this.bg.width  = dispW;
    this.bg.height = dispH;
    this.bg.x      = (canvasW - dispW) / 2;
    this.bg.y      = (canvasH - dispH) / 2;
  }

  /**
   * Reposition all nodes and the daily challenge elements using the LobbyLayout for
   * the current orientation.  Replaces the old toLogicalPos() ratio mapping with
   * explicit layout coordinates.
   */
  private repositionAll(): void {
    const layout = getLobbyLayout(this.screen);
    const sz = LobbyScene.NODE_SIZE;
    const r  = sz / 2;

    for (const entry of this.nodeEntries) {
      const pos = layout.nodePositions.find(p => p.stageIndex === entry.stageIndex);
      if (!pos) continue;
      const cx = pos.x;
      const cy = pos.y;

      entry.card.x          = cx - r;
      entry.card.y          = cy - r;
      entry.numDisplay.x    = cx - entry.numDisplay.totalWidth / 2;
      entry.numDisplay.y    = cy - NODE_DIGIT_H / 2;
      entry.starContainer.x = cx - TOTAL_STAR_W / 2;
      entry.starContainer.y = cy + r + 4;
    }

    if (this.dailyEntry) {
      const { x, y } = layout.dailyChallengePos;
      const dr = LobbyScene.DAILY_SIZE / 2;

      this.dailyEntry.glow.x   = x;
      this.dailyEntry.glow.y   = y;
      this.dailyEntry.circle.x = x;
      this.dailyEntry.circle.y = y;
      this.dailyEntry.icon.x   = x;
      this.dailyEntry.icon.y   = y;
      this.dailyEntry.hit.x    = x - dr;
      this.dailyEntry.hit.y    = y - dr;

      this.refreshDailyRows();
    }

    if (this.musicBtn) {
      const { x, y } = layout.dailyChallengePos;
      const dr = LobbyScene.DAILY_SIZE / 2;
      this.musicBtn.x = x - MUSIC_BTN_SIZE / 2;
      this.musicBtn.y = y - dr - MUSIC_BTN_SIZE - 10;
    }

    const { x: pcx, y: pcy } = layout.dailyChallengePos;
    this.redrawPanel(pcx, pcy);
    this.refreshPath();
  }

  // ── Daily challenge + music button background panel ───────────────────────────

  /**
   * Compute the panel bounds covering the music button (above) + the daily challenge
   * circle + the stats digit rows (below).  cx/cy is the daily challenge circle centre.
   */
  private getPanelBounds(cx: number, cy: number): { x: number; y: number; w: number; h: number } {
    const dr  = LobbyScene.DAILY_SIZE / 2;      // 65
    const pad = 18;
    const top    = cy - dr - MUSIC_BTN_SIZE - 10 - pad;
    const bottom = cy + dr + 8 + DC_DIGIT_H + 24 + DC_DIGIT_H + pad;
    const left   = cx - dr - pad;
    const right  = cx + dr + pad;
    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  private buildPanel(): void {
    const layout = getLobbyLayout(this.screen);
    const { x: cx, y: cy } = layout.dailyChallengePos;
    const { x, y, w, h } = this.getPanelBounds(cx, cy);

    this.panelGraphics = new PIXI.Graphics();
    this.panelGraphics.beginFill(0x1A0F00, 0.55);
    this.panelGraphics.drawRoundedRect(x, y, w, h, 24);
    this.panelGraphics.endFill();
    this.addChild(this.panelGraphics);
  }

  private redrawPanel(cx: number, cy: number): void {
    if (!this.panelGraphics) return;
    const { x, y, w, h } = this.getPanelBounds(cx, cy);
    this.panelGraphics.clear();
    this.panelGraphics.beginFill(0x1A0F00, 0.55);
    this.panelGraphics.drawRoundedRect(x, y, w, h, 24);
    this.panelGraphics.endFill();
  }

  // ── Music button ────────────────────────────────────────────────────────────

  private buildMusicButton(): void {
    const layout = getLobbyLayout(this.screen);
    const { x, y } = layout.dailyChallengePos;
    const dr = LobbyScene.DAILY_SIZE / 2;

    const btn = new PIXI.Sprite(this.ctx.assets.GetTexture('music.png'));
    btn.width  = MUSIC_BTN_SIZE;
    btn.height = MUSIC_BTN_SIZE;
    btn.x      = x - MUSIC_BTN_SIZE / 2;
    btn.y      = y - dr - MUSIC_BTN_SIZE - 10;

    this.applyMusicBtnTint(btn);
    this.addChild(btn);
    this.musicBtn = btn;

    this.ctx.input.registerUI(
      new UIElement({
        zIndex: 10,
        sprite: btn,
        onTap: () => {
          this.ctx.audio.toggleMusic();
          this.applyMusicBtnTint(btn);
        },
      }),
    );
  }

  private applyMusicBtnTint(sprite: PIXI.Sprite): void {
    sprite.tint = this.ctx.audio.isMusicEnabled() ? 0xFFFFFF : 0x444444;
  }

  // ── Adventure path ────────────────────────────────────────────────────────────

  private buildPath(): void {
    this.pathGraphics = new PIXI.Graphics();
    this.addChild(this.pathGraphics);
  }

  /**
   * Redraw the adventure path.  Nodes are connected in stageIndex 1→19 order.
   * Completed segments (both endpoints ≤ maxCompleted) use dark-brown; others use grey at low opacity.
   */
  private refreshPath(): void {
    if (!this.pathGraphics) return;
    this.pathGraphics.clear();
    const layout      = getLobbyLayout(this.screen);
    const positions   = [...layout.nodePositions].sort((a, b) => a.stageIndex - b.stageIndex);
    const maxCompleted = StageManager.getMaxCompleted();

    for (let i = 0; i < positions.length - 1; i++) {
      const a     = positions[i]!;
      const b     = positions[i + 1]!;
      const done  = a.stageIndex <= maxCompleted; // segment is "done" if its start node is completed
      const color = done ? PATH_COLOR_DONE : PATH_COLOR_LOCKED;
      const alpha = done ? PATH_ALPHA_DONE : PATH_ALPHA_LOCKED;
      this.pathGraphics.lineStyle(PATH_WIDTH, color, alpha);
      this.drawDashedLine(this.pathGraphics, a.x, a.y, b.x, b.y);
    }
  }

  /** Draw a dashed line on the Graphics from (x1,y1) to (x2,y2). */
  private drawDashedLine(
    g: PIXI.Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
  ): void {
    const dx  = x2 - x1;
    const dy  = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = dx / len;
    const ny = dy / len;
    let traveled = 0;
    let drawing  = true;
    while (traveled < len) {
      const seg = Math.min(drawing ? PATH_DASH : PATH_GAP, len - traveled);
      if (drawing) {
        g.moveTo(x1 + nx * traveled,          y1 + ny * traveled);
        g.lineTo(x1 + nx * (traveled + seg),   y1 + ny * (traveled + seg));
      }
      traveled += seg;
      drawing   = !drawing;
    }
  }

  // ── Animation updates ─────────────────────────────────────────────────────────

  /** Current stage node pulse (scale 1 → 1.03, 800 ms loop). */
  private updateCurrentNodePulse(): void {
    if (!this.currentCard) return;
    const t     = (Math.sin(this.pulseMs / PULSE_PERIOD_MS * Math.PI * 2) + 1) / 2; // 0..1
    const scale = 1 + 0.03 * t;
    this.currentCard.scale.set(scale);
  }

  /** Daily challenge breathing glow (sin-based expanding/contracting circle). */
  private updateDailyGlow(): void {
    if (!this.dailyEntry) return;
    const t      = (Math.sin(this.glowMs / GLOW_PERIOD_MS * Math.PI * 2) + 1) / 2; // 0..1
    const radius = GLOW_RADIUS_MIN + GLOW_RADIUS_RANGE * t;
    const alpha  = 0.25 + 0.2 * t;
    const g      = this.dailyEntry.glow;
    g.clear();
    g.beginFill(0xFFD700, alpha);
    g.drawCircle(0, 0, radius);
    g.endFill();
  }

  /** Daily challenge click bounce feedback (scale 1 → 0.92 → 1, 100 ms). */
  private updateDailyBounce(deltaMs: number): void {
    if (this.bounceElapsed < 0 || !this.dailyEntry) return;
    this.bounceElapsed += deltaMs;
    const t = Math.min(this.bounceElapsed / BOUNCE_DURATION, 1);
    // sin arc: t=0 → 1 → 0, scale is smallest at the midpoint
    const s = 1 - 0.08 * Math.sin(t * Math.PI);
    this.dailyEntry.circle.scale.set(s);
    this.dailyEntry.icon.scale.set(s);
    if (t >= 1) {
      this.dailyEntry.circle.scale.set(1);
      this.dailyEntry.icon.scale.set(1);
      this.bounceElapsed = -1;
    }
  }

  // ── Internal builders ───────────────────────────────────────────────────────

  private buildStageButton(stage: StageData, x: number, y: number, size: number): PIXI.Sprite {
    const card  = new PIXI.Sprite(this.cardTexture);
    card.width  = size;
    card.height = size;
    card.x      = x;
    card.y      = y;
    this.addChild(card);
    this.ctx.input.registerUI(
      new UIElement({
        zIndex: 5,
        sprite: card,
        onTap: () => {
          if (StageManager.isUnlocked(stage.stageIndex)) {
            this.ctx.audio.playClick();
            this.onSelectStage(stage);
          }
        },
      }),
    );
    return card;
  }
}
