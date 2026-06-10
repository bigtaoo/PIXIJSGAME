import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { STAGES, StageData } from './stageConfig';
import { StageManager } from './stageManager';
import { StarManager } from './starManager';
import { UIElement } from '../inputSystem/uiElement';
import { GAME_WIDTH, GAME_HEIGHT } from './consts';
import {
  drawCircleCell,
  drawCircleCellSelected,
  makeTexture,
  drawButtonBackground,
} from './graphicsFactory';
import { getDailyBestScore } from './dailyChallengeStore';
import { getLobbyLayout } from './lobbyLayout';
import { Orientation } from './enums';
import { DigitDisplay } from './digitDisplay';

// ── Lobby decoration seeded RNG ──────────────────────────────────────────────
/** Simple LCG, returns 0..1. Pass a fixed seed for deterministic placement. */
function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// ── Node star dimensions ─────────────────────────────────────────────────────
const STAR_SIZE = 22;
const STAR_GAP = 3;
const TOTAL_STAR_W = 3 * STAR_SIZE + 2 * STAR_GAP;
// Padding around stars for the white pill background
const STAR_PAD_X = 6;
const STAR_PAD_Y = 4;

// ── Adventure path ────────────────────────────────────────────────────────────
// Roadbed: solid polyline drawn UNDER the dashed progress line.
// Replaces the painted trail formerly baked into lobby_bg.png (art.md 8.3).
const ROADBED_COLOR = 0xc19a6b; // warm sandy tan
const ROADBED_ALPHA = 0.45;
const ROADBED_WIDTH = 22;
const PATH_COLOR_DONE = 0x6d4c41; // dark brown, completed segment
const PATH_COLOR_LOCKED = 0x8b6e47; // mid warm-brown, locked segment
const PATH_WIDTH = 6; // line width (logical pixels)
const PATH_DASH = 14; // dash length
const PATH_GAP = 8; // gap between dashes
const PATH_ALPHA_DONE = 0.8;
const PATH_ALPHA_LOCKED = 0.55;

// ── Daily challenge animation ─────────────────────────────────────────────────
const GLOW_RADIUS_MIN = 68; // minimum glow radius (slightly larger than the circle icon radius of 65)
const GLOW_RADIUS_RANGE = 8; // glow amplitude
const GLOW_PERIOD_MS = 1200;
const PULSE_PERIOD_MS = 800; // node pulse period
const BOUNCE_DURATION = 100; // click bounce animation duration (ms)

// ── Daily challenge area: icon + digit row dimensions (1.5 × 1.3 = 1.95× original) ─
const DC_ICON_H = 59;
const DC_ICON_W = 59;
const DC_DIGIT_H = 59;
const DC_DIGIT_W = Math.round((DC_DIGIT_H * 120) / 160); // ~44
const DC_GAP = 12;

// ── Node stage number dimensions ─────────────────────────────────────────────
const NODE_DIGIT_H = Math.round(150 * 0.85); // 127 — 85% of NODE_SIZE
const NODE_DIGIT_W = Math.round((NODE_DIGIT_H * 120) / 160); // ~95

// Per-node runtime data for repositioning on resize
interface NodeEntry {
  stageIndex: number;
  card: PIXI.Sprite;
  numDisplay: DigitDisplay;
  starContainer: PIXI.Container;
  starSprites: PIXI.Sprite[];
}

// Daily challenge element refs for repositioning on resize
interface DailyChallengeEntry {
  circle: PIXI.Graphics;
  icon: PIXI.Sprite;
  bestRow: PIXI.Container;
  bestDisplay: DigitDisplay;
  hit: PIXI.Sprite;
  /** Breathing glow Graphics, rendered below the circle */
  glow: PIXI.Graphics;
}

const MUSIC_BTN_SIZE = 109; // 56 × 1.5 × 1.3
// Icon inset within the parchment button frame (matches art.md 9.3: size × 0.16)
const MUSIC_ICON_PAD = Math.round(MUSIC_BTN_SIZE * 0.16);

// ── Daily challenge / music button panel (warm parchment, header-bar family) ──
const PANEL_FILL = 0xead5a8; // warm parchment (= header bar body)
const PANEL_FILL_ALPHA = 0.85; // slightly translucent so the map shows through
const PANEL_BORDER = 0xc4a068; // warm gold (= header bar border)
const PANEL_BORDER_ALPHA = 0.55;
const PANEL_BORDER_WIDTH = 1.5;
const PANEL_SHADOW = 0x3d2200;
const PANEL_SHADOW_ALPHA = 0.18;
const PANEL_SHADOW_OFF_Y = 5;
const PANEL_RADIUS = 24;
const PANEL_HILIGHT_H = 48; // top highlight strip height
const PANEL_HILIGHT_ALPHA = 0.18;

export class LobbyScene extends PIXI.Container {
  private readonly screen: ScreenConfig;

  private static readonly NODE_SIZE = 150;
  private static readonly DAILY_SIZE = 254; // 130 × 1.5 × 1.3

  private bg!: PIXI.Sprite;
  private decoContainer!: PIXI.Container;
  private decoOrientation: Orientation | null = null;

  private nodeEntries: NodeEntry[] = [];
  private dailyEntry!: DailyChallengeEntry;
  private musicBtn!: PIXI.Sprite;
  private musicBtnBg!: PIXI.Graphics;
  private musicOffSlash!: PIXI.Graphics;
  private musicBtnHit!: PIXI.Sprite;

  // Parallel arrays kept for refresh()
  private stageCards: PIXI.Sprite[] = [];
  private nodeStarContainers: PIXI.Container[] = [];
  private nodeStarSprites: PIXI.Sprite[][] = [];

  // ── Animation state ──────────────────────────────────────────────────────────
  private pulseMs = 0;
  private glowMs = 0;
  private bounceElapsed = -1;
  /** Current stage node Sprite (null means all stages are completed). */
  private currentCard: PIXI.Sprite | null = null;

  // ── Path / panel ──────────────────────────────────────────────────────────────
  private pathGraphics!: PIXI.Graphics;
  private panelGraphics!: PIXI.Graphics;

  private cardTexture!: PIXI.Texture;
  private cardSelectedTexture!: PIXI.Texture;

  constructor(
    private readonly ctx: AppContext,
    private readonly onSelectStage: (stage: StageData) => void,
    private readonly onDailyChallenge: () => void
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
      const card = this.stageCards[i];
      const starCont = this.nodeStarContainers[i];
      const starSprts = this.nodeStarSprites[i];
      if (!card || !starCont || !starSprts) return;

      const completed = stage.stageIndex <= maxCompleted;
      const isCurrent = stage.stageIndex === maxCompleted + 1;

      const entry = this.nodeEntries[i];
      if (isCurrent) {
        card.texture = this.cardSelectedTexture;
        card.tint = 0xffffff;
        card.alpha = 1;
        this.currentCard = card;
        if (entry) entry.numDisplay.tint = 0xf5eac8;
      } else if (completed) {
        card.texture = this.cardTexture;
        card.tint = 0xffffff;
        card.alpha = 1;
        if (entry) entry.numDisplay.tint = 0xf5eac8;
      } else {
        card.texture = this.cardTexture;
        card.tint = 0xb09060;
        card.alpha = 0.75;
        if (this.currentCard === card) this.currentCard = null;
        if (entry) entry.numDisplay.tint = 0xb09060;
      }

      if (completed || isCurrent) {
        const stars = StarManager.getStars(stage.stageIndex);
        starCont.visible = stars > 0;
        for (let s = 0; s < 3; s++) {
          const sp = starSprts[s]!;
          sp.tint = s < stars ? 0xeab830 : 0x888888;
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
    this.buildPath(); // path renders below the nodes
    this.buildAdventureMap();
    this.buildPanel(); // background panel renders below the daily challenge / music button
    this.buildDailyChallenge();
    this.buildMusicButton();
  }

  // ── update (called every frame by SceneCoordinator) ──────────────────────────

  public update(deltaMs: number): void {
    this.pulseMs += deltaMs;
    this.glowMs += deltaMs;
    this.updateCurrentNodePulse();
    this.updateDailyGlow();
    this.updateDailyBounce(deltaMs);
  }

  private buildBackground(): void {
    this.bg = new PIXI.Sprite(this.ctx.assets.GetTexture('lobby_bg.png'));
    this.addChild(this.bg);
    this.buildLobbyDecos();
  }

  /**
   * Creates the deco container and does the first placement pass.
   *
   * Assets required (place in src/assets/):
   *   deco_pencil.png    — angled pencil
   *   deco_eraser.png    — rectangular eraser
   *   deco_paperclip.png — oval paperclip
   */
  private buildLobbyDecos(): void {
    this.decoContainer = new PIXI.Container();
    this.addChildAt(this.decoContainer, 1);
    this.rebuildDecos();
  }

  /**
   * Clears and re-places all deco sprites for the current orientation.
   * Called on first build and whenever orientation changes.
   *
   * Positions are seeded-random so they are stable across redraws but
   * avoid all stage-node centres and the daily-challenge panel area.
   * Portrait has more vertical spread; landscape more horizontal.
   */
  private rebuildDecos(): void {
    this.decoContainer.removeChildren();
    this.decoOrientation = this.screen.orientation;

    const KEYS = ['deco_pencil.png', 'deco_eraser.png', 'deco_paperclip.png'];
    const COUNT = 12;
    const NODE_R = 160; // keep-out radius around each stage node centre
    const PANEL_R = 200; // keep-out radius around the daily-challenge panel centre
    const MARGIN = 50; // minimum distance from canvas edge
    const MARGIN_RIGHT = 240; // larger right keep-out so center-anchored decos never clip the edge

    const cw = this.screen.width;
    const ch = this.screen.height;
    const layout = getLobbyLayout(this.screen);
    const { x: pcx, y: pcy } = layout.dailyChallengePos;

    const rng = makeSeededRng(0xdeca_f00d);
    let placed = 0;
    let attempt = 0;

    while (placed < COUNT && attempt < 400) {
      attempt++;

      const x = MARGIN + rng() * (cw - MARGIN - MARGIN_RIGHT);
      const y = MARGIN + rng() * (ch - MARGIN * 2);

      // Reject if too close to any stage node
      const nearNode = layout.nodePositions.some((p) => {
        const dx = p.x - x,
          dy = p.y - y;
        return dx * dx + dy * dy < NODE_R * NODE_R;
      });
      if (nearNode) continue;

      // Reject if too close to the daily-challenge panel
      const dpx = pcx - x,
        dpy = pcy - y;
      if (dpx * dpx + dpy * dpy < PANEL_R * PANEL_R) continue;

      const key = KEYS[Math.floor(rng() * KEYS.length)]!;
      const scale = 0.7 + rng() * 0.35; // 0.70 – 1.05
      const deg = (rng() - 0.5) * 60; // –30° … +30°

      let tex: PIXI.Texture | null = null;
      try {
        tex = this.ctx.assets.GetTexture(key);
      } catch {
        continue;
      }
      if (!tex) continue;

      const spr = new PIXI.Sprite(tex);
      spr.anchor.set(0.5, 0.5);
      spr.x = x;
      spr.y = y;
      spr.scale.set(scale);
      spr.rotation = (deg * Math.PI) / 180;
      spr.alpha = 0.38;
      this.decoContainer.addChild(spr);
      placed++;
    }
  }

  private buildAdventureMap(): void {
    const sz = LobbyScene.NODE_SIZE;
    const r = sz / 2;

    this.cardTexture = makeTexture(this.ctx.renderer, (g) => drawCircleCell(g, sz), sz);
    this.cardSelectedTexture = makeTexture(
      this.ctx.renderer,
      (g) => drawCircleCellSelected(g, sz),
      sz
    );

    // Build nodes using the portrait layout initially (resize() repositions them for the current orientation)
    const layout = getLobbyLayout(this.screen);

    STAGES.forEach((stage, i) => {
      const pos = layout.nodePositions[i];
      if (!pos) return;
      const cx = pos.x;
      const cy = pos.y;

      const card = this.buildStageButton(stage, cx - r, cy - r, sz);
      this.stageCards.push(card);

      const numDisplay = new DigitDisplay(
        this.ctx,
        NODE_DIGIT_W,
        NODE_DIGIT_H,
        0xffffff,
        Math.round((NODE_DIGIT_W * 2) / 3)
      );
      numDisplay.update(stage.stageIndex);
      numDisplay.x = cx - numDisplay.totalWidth / 2;
      numDisplay.y = cy - NODE_DIGIT_H / 2;
      this.addChild(numDisplay);

      const { container: starContainer, sprites: starSprites } = this.buildStarRow();
      starContainer.x = cx - TOTAL_STAR_W / 2;
      starContainer.y = cy + r + 4;
      starContainer.visible = false;
      this.addChild(starContainer);
      this.nodeStarContainers.push(starContainer);
      this.nodeStarSprites.push(starSprites);

      this.nodeEntries.push({
        stageIndex: stage.stageIndex,
        card,
        numDisplay,
        starContainer,
        starSprites,
      });
    });

    this.refresh();
    this.refreshPath();
  }

  private buildStarRow(): { container: PIXI.Container; sprites: PIXI.Sprite[] } {
    const container = new PIXI.Container();

    // White pill background — makes stars legible on any map background.
    const pillW = TOTAL_STAR_W + STAR_PAD_X * 2;
    const pillH = STAR_SIZE + STAR_PAD_Y * 2;
    const pill = new PIXI.Graphics();
    pill.beginFill(0xffffff, 0.88);
    pill.drawRoundedRect(-STAR_PAD_X, -STAR_PAD_Y, pillW, pillH, pillH / 2);
    pill.endFill();
    container.addChild(pill);

    const sprites: PIXI.Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const s = new PIXI.Sprite(this.ctx.assets.GetTexture('star.png'));
      s.width = STAR_SIZE;
      s.height = STAR_SIZE;
      s.x = i * (STAR_SIZE + STAR_GAP);
      s.y = 0;
      s.tint = 0x888888;
      s.alpha = 0.45;
      container.addChild(s);
      sprites.push(s);
    }
    return { container, sprites };
  }

  private buildDailyChallenge(): void {
    const layout = getLobbyLayout(this.screen);
    const { x, y } = layout.dailyChallengePos;
    const sz = LobbyScene.DAILY_SIZE;
    const r = sz / 2;

    // Breathing glow (rendered below the circular icon)
    const glow = new PIXI.Graphics();
    glow.x = x;
    glow.y = y;
    this.addChild(glow);

    const circle = new PIXI.Graphics();
    circle.lineStyle(4, 0x6d4c41, 1);
    circle.beginFill(0xc8862a);
    circle.drawCircle(0, 0, r);
    circle.endFill();
    circle.x = x;
    circle.y = y;
    this.addChild(circle);

    const icon = new PIXI.Sprite(this.ctx.assets.GetTexture('daily_challenge_icon.png'));
    const targetPx = sz * 0.7;
    const iconScale = targetPx / Math.max(icon.texture.width, icon.texture.height);
    icon.width = icon.texture.width * iconScale;
    icon.height = icon.texture.height * iconScale;
    icon.anchor.set(0.5, 0.5);
    icon.x = x;
    icon.y = y;
    this.addChild(icon);

    const best = this.buildIconDigitRow('trophy.png');
    this.addChild(best.container);

    const hit = new PIXI.Sprite(PIXI.Texture.EMPTY);
    hit.width = sz;
    hit.height = sz;
    hit.x = x - r;
    hit.y = y - r;
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
      })
    );

    this.dailyEntry = {
      circle,
      icon,
      glow,
      bestRow: best.container,
      bestDisplay: best.display,
      hit,
    };

    this.refreshDailyRows();
  }

  private buildIconDigitRow(iconKey: string): { container: PIXI.Container; display: DigitDisplay } {
    const container = new PIXI.Container();
    const iconSprite = new PIXI.Sprite(this.ctx.assets.GetTexture(iconKey));
    iconSprite.width = DC_ICON_W;
    iconSprite.height = DC_ICON_H;
    iconSprite.x = 0;
    iconSprite.y = (DC_DIGIT_H - DC_ICON_H) / 2;
    container.addChild(iconSprite);

    const display = new DigitDisplay(this.ctx, DC_DIGIT_W, DC_DIGIT_H, 0xf5e6c8);
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

    // Only show best score once the player has completed at least one daily challenge.
    // Displaying 0 looks odd on a fresh install, so we hide the row until there is a real score.
    const best = getDailyBestScore();
    if (best > 0) {
      this.dailyEntry.bestDisplay.update(best);
      const rowW = DC_ICON_W + DC_GAP + this.dailyEntry.bestDisplay.totalWidth;
      this.dailyEntry.bestRow.x = x - rowW / 2;
      this.dailyEntry.bestRow.y = y + dr + 8;
      this.dailyEntry.bestRow.visible = true;
    } else {
      this.dailyEntry.bestRow.visible = false;
    }
  }

  // ── Resize helpers ──────────────────────────────────────────────────────────

  /**
   * Cover-scale the background over the logical canvas.
   *
   * The texture is authored in landscape (1920×1080, art.md 8.2).  In portrait
   * it is rotated 90° clockwise, so the effective cover dimensions are swapped.
   * Anchor is centred so rotation and centring compose trivially.
   */
  private updateBgSize(): void {
    if (!this.bg) return;
    const canvasW = this.screen.width;
    const canvasH = this.screen.height;
    const texW = this.bg.texture.width;
    const texH = this.bg.texture.height;
    const portrait = this.screen.orientation === Orientation.Portrait;

    const effW = portrait ? texH : texW;
    const effH = portrait ? texW : texH;
    const scale = Math.max(canvasW / effW, canvasH / effH);

    this.bg.anchor.set(0.5);
    this.bg.rotation = portrait ? Math.PI / 2 : 0;
    this.bg.width = texW * scale;
    this.bg.height = texH * scale;
    this.bg.x = canvasW / 2;
    this.bg.y = canvasH / 2;
  }

  /**
   * Reposition all nodes and the daily challenge elements using the LobbyLayout for
   * the current orientation.  Replaces the old toLogicalPos() ratio mapping with
   * explicit layout coordinates.
   */
  private repositionAll(): void {
    const layout = getLobbyLayout(this.screen);
    const sz = LobbyScene.NODE_SIZE;
    const r = sz / 2;

    for (const entry of this.nodeEntries) {
      const pos = layout.nodePositions.find((p) => p.stageIndex === entry.stageIndex);
      if (!pos) continue;
      const cx = pos.x;
      const cy = pos.y;

      entry.card.x = cx - r;
      entry.card.y = cy - r;
      entry.numDisplay.x = cx - entry.numDisplay.totalWidth / 2;
      entry.numDisplay.y = cy - NODE_DIGIT_H / 2;
      entry.starContainer.x = cx - TOTAL_STAR_W / 2;
      entry.starContainer.y = cy + r + 4;
    }

    if (this.dailyEntry) {
      const { x, y } = layout.dailyChallengePos;
      const dr = LobbyScene.DAILY_SIZE / 2;

      this.dailyEntry.glow.x = x;
      this.dailyEntry.glow.y = y;
      this.dailyEntry.circle.x = x;
      this.dailyEntry.circle.y = y;
      this.dailyEntry.icon.x = x;
      this.dailyEntry.icon.y = y;
      this.dailyEntry.hit.x = x - dr;
      this.dailyEntry.hit.y = y - dr;

      this.refreshDailyRows();
    }

    if (this.musicBtn) {
      const { x, y } = layout.dailyChallengePos;
      const dr = LobbyScene.DAILY_SIZE / 2;
      const bx = x - MUSIC_BTN_SIZE / 2;
      const by = y - dr - MUSIC_BTN_SIZE - 10;
      this.musicBtnBg.x = bx;
      this.musicBtnBg.y = by;
      this.musicBtn.x = bx + MUSIC_ICON_PAD;
      this.musicBtn.y = by + MUSIC_ICON_PAD;
      this.musicOffSlash.x = bx + MUSIC_ICON_PAD;
      this.musicOffSlash.y = by + MUSIC_ICON_PAD;
      this.musicBtnHit.x = bx;
      this.musicBtnHit.y = by;
    }

    const { x: pcx, y: pcy } = layout.dailyChallengePos;
    this.redrawPanel(pcx, pcy);
    this.refreshPath();

    // Rebuild decorations if orientation changed (portrait ↔ landscape)
    if (this.decoContainer && this.screen.orientation !== this.decoOrientation) {
      this.rebuildDecos();
    }
  }

  // ── Daily challenge + music button background panel ───────────────────────────

  /**
   * Compute the panel bounds covering the music button (above) + the daily challenge
   * circle + the stats digit rows (below).  cx/cy is the daily challenge circle centre.
   */
  private getPanelBounds(cx: number, cy: number): { x: number; y: number; w: number; h: number } {
    const dr = LobbyScene.DAILY_SIZE / 2; // 65
    const pad = 18;
    const top = cy - dr - MUSIC_BTN_SIZE - 10 - pad;
    const bottom = cy + dr + 8 + DC_DIGIT_H + pad;
    const left = cx - dr - pad;
    const right = cx + dr + pad;
    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  private buildPanel(): void {
    const layout = getLobbyLayout(this.screen);
    const { x: cx, y: cy } = layout.dailyChallengePos;

    this.panelGraphics = new PIXI.Graphics();
    this.drawPanelShape(cx, cy);
    this.addChild(this.panelGraphics);
  }

  private redrawPanel(cx: number, cy: number): void {
    if (!this.panelGraphics) return;
    this.drawPanelShape(cx, cy);
  }

  /**
   * Warm parchment panel, same visual family as the in-game header bar
   * (art.md 7.1.1): drop shadow + parchment body with gold border + top highlight.
   */
  private drawPanelShape(cx: number, cy: number): void {
    const { x, y, w, h } = this.getPanelBounds(cx, cy);
    const g = this.panelGraphics;
    g.clear();

    // Drop shadow (lifted-panel feel)
    g.lineStyle(0);
    g.beginFill(PANEL_SHADOW, PANEL_SHADOW_ALPHA);
    g.drawRoundedRect(x, y + PANEL_SHADOW_OFF_Y, w, h, PANEL_RADIUS);
    g.endFill();

    // Main body
    g.lineStyle(PANEL_BORDER_WIDTH, PANEL_BORDER, PANEL_BORDER_ALPHA);
    g.beginFill(PANEL_FILL, PANEL_FILL_ALPHA);
    g.drawRoundedRect(x, y, w, h, PANEL_RADIUS);
    g.endFill();

    // Top highlight strip
    g.lineStyle(0);
    g.beginFill(0xffffff, PANEL_HILIGHT_ALPHA);
    g.drawRoundedRect(x + 3, y + 3, w - 6, PANEL_HILIGHT_H, PANEL_RADIUS - 3);
    g.endFill();
  }

  // ── Music button ────────────────────────────────────────────────────────────

  private buildMusicButton(): void {
    const layout = getLobbyLayout(this.screen);
    const { x, y } = layout.dailyChallengePos;
    const dr = LobbyScene.DAILY_SIZE / 2;
    const bx = x - MUSIC_BTN_SIZE / 2;
    const by = y - dr - MUSIC_BTN_SIZE - 10;

    // Parchment button frame — same family as the in-game buttons (art.md 9.3)
    const bg = new PIXI.Graphics();
    drawButtonBackground(bg, MUSIC_BTN_SIZE);
    bg.x = bx;
    bg.y = by;
    this.addChild(bg);
    this.musicBtnBg = bg;

    const iconSize = MUSIC_BTN_SIZE - MUSIC_ICON_PAD * 2;
    const btn = new PIXI.Sprite(this.ctx.assets.GetTexture('music.png'));
    btn.width = iconSize;
    btn.height = iconSize;
    btn.x = bx + MUSIC_ICON_PAD;
    btn.y = by + MUSIC_ICON_PAD;
    this.addChild(btn);
    this.musicBtn = btn;

    // Diagonal slash shown when music is off (replaces the old grey tint)
    const slash = new PIXI.Graphics();
    slash.lineStyle(8, 0x6d4c41, 0.9);
    slash.moveTo(iconSize, 0);
    slash.lineTo(0, iconSize);
    slash.x = bx + MUSIC_ICON_PAD;
    slash.y = by + MUSIC_ICON_PAD;
    this.addChild(slash);
    this.musicOffSlash = slash;

    // Invisible full-frame hit target so the tap area covers the whole button
    const hit = new PIXI.Sprite(PIXI.Texture.EMPTY);
    hit.width = MUSIC_BTN_SIZE;
    hit.height = MUSIC_BTN_SIZE;
    hit.x = bx;
    hit.y = by;
    this.addChild(hit);
    this.musicBtnHit = hit;

    this.applyMusicBtnState();

    this.ctx.input.registerUI(
      new UIElement({
        zIndex: 10,
        sprite: hit,
        onTap: () => {
          this.ctx.audio.toggleMusic();
          this.applyMusicBtnState();
        },
      })
    );
  }

  private applyMusicBtnState(): void {
    const on = this.ctx.audio.isMusicEnabled();
    this.musicBtn.tint = on ? 0xffffff : 0x999999;
    this.musicBtn.alpha = on ? 1 : 0.55;
    this.musicOffSlash.visible = !on;
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
    const layout = getLobbyLayout(this.screen);
    const positions = [...layout.nodePositions].sort((a, b) => a.stageIndex - b.stageIndex);
    const maxCompleted = StageManager.getMaxCompleted();

    // Layer 1: solid roadbed — one continuous polyline through all node centres,
    // round caps/joins so corners look hand-painted rather than mitered.
    if (positions.length > 1) {
      this.pathGraphics.lineStyle({
        width: ROADBED_WIDTH,
        color: ROADBED_COLOR,
        alpha: ROADBED_ALPHA,
        cap: PIXI.LINE_CAP.ROUND,
        join: PIXI.LINE_JOIN.ROUND,
      });
      this.pathGraphics.moveTo(positions[0]!.x, positions[0]!.y);
      for (let i = 1; i < positions.length; i++) {
        this.pathGraphics.lineTo(positions[i]!.x, positions[i]!.y);
      }
    }

    // Layer 2: dashed progress line on top of the roadbed.
    for (let i = 0; i < positions.length - 1; i++) {
      const a = positions[i]!;
      const b = positions[i + 1]!;
      const done = a.stageIndex <= maxCompleted; // segment is "done" if its start node is completed
      const color = done ? PATH_COLOR_DONE : PATH_COLOR_LOCKED;
      const alpha = done ? PATH_ALPHA_DONE : PATH_ALPHA_LOCKED;
      this.pathGraphics.lineStyle(PATH_WIDTH, color, alpha);
      this.drawDashedLine(this.pathGraphics, a.x, a.y, b.x, b.y);
    }
  }

  /**
   * Draw a dashed line on the Graphics from (x1,y1) to (x2,y2).
   *
   * Each dash endpoint gets a small, seeded perpendicular jitter (±3px) to
   * simulate a hand-drawn pencil line.  The jitter is deterministic (based on
   * the segment index) so the path looks consistent across redraws.
   */
  private drawDashedLine(g: PIXI.Graphics, x1: number, y1: number, x2: number, y2: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = dx / len;
    const ny = dy / len;
    // Perpendicular unit vector for jitter
    const px = -ny;
    const py = nx;

    let traveled = 0;
    let drawing = true;
    let segIdx = 0;

    while (traveled < len) {
      const seg = Math.min(drawing ? PATH_DASH : PATH_GAP, len - traveled);
      if (drawing) {
        // Deterministic pseudo-random jitter per segment endpoint.
        // sin(prime * segIdx) maps to a stable value in [-1, 1].
        const j0 = Math.sin(segIdx * 7.3) * 3; // jitter at dash start
        const j1 = Math.sin((segIdx + 1) * 7.3) * 3; // jitter at dash end
        g.moveTo(x1 + nx * traveled + px * j0, y1 + ny * traveled + py * j0);
        g.lineTo(x1 + nx * (traveled + seg) + px * j1, y1 + ny * (traveled + seg) + py * j1);
      }
      traveled += seg;
      drawing = !drawing;
      segIdx++;
    }
  }

  // ── Animation updates ─────────────────────────────────────────────────────────

  /** Current stage node pulse (scale 1 → 1.03, 800 ms loop). */
  private updateCurrentNodePulse(): void {
    if (!this.currentCard) return;
    const t = (Math.sin((this.pulseMs / PULSE_PERIOD_MS) * Math.PI * 2) + 1) / 2; // 0..1
    const scale = 1 + 0.03 * t;
    this.currentCard.scale.set(scale);
  }

  /** Daily challenge breathing glow (sin-based expanding/contracting circle). */
  private updateDailyGlow(): void {
    if (!this.dailyEntry) return;
    const t = (Math.sin((this.glowMs / GLOW_PERIOD_MS) * Math.PI * 2) + 1) / 2; // 0..1
    const radius = GLOW_RADIUS_MIN + GLOW_RADIUS_RANGE * t;
    const alpha = 0.25 + 0.2 * t;
    const g = this.dailyEntry.glow;
    g.clear();
    g.beginFill(0xffd700, alpha);
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
    const card = new PIXI.Sprite(this.cardTexture);
    card.width = size;
    card.height = size;
    card.x = x;
    card.y = y;
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
      })
    );
    return card;
  }
}
