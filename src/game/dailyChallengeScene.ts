/**
 * dailyChallengeScene.ts
 *
 * The Daily Challenge scene — a 90-second timed sprint on a fixed 6×8 board.
 *
 * Key differences from GameScene:
 *   - No lives, no target progression: one board, one timer.
 *   - Scoring: +2 per elimination; combo multiplier: +3 / +4 / +5 (cap at 4th+).
 *   - Tetris-style row collapse: when a full row is cleared the rows above
 *     fall down and a fresh self-paired row is inserted at the top.
 *   - Board is seeded by today's date so every player faces the same layout.
 *
 * Header matches main GameScene conventions:
 *   - Sprite-based tip formula (□ + □ = Target) in the bottom row of the header.
 *   - Hint system: 3 s after selecting the first tile, matching tiles flash once.
 *   - Wrong second click: switches selection to the newly tapped cell (same as
 *     GameScene — does not reset to empty).
 *
 * Lifecycle:
 *   SceneCoordinator creates this once and calls start() each time the
 *   player enters. Call resize() whenever the window changes.
 */
import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { GameState } from './gameState';
import { Grid } from './grid';
import { NumberLayer } from './numbers';
import { EffectManager } from './effectManager';
import { DailyChallengeLogic } from './dailyChallengeLogic';
import { DailyChallengeResult } from './dailyChallengeResult';
import { drawBackground, drawHeaderBar, drawQuestionMark, C } from './graphicsFactory';
import { DigitDisplay } from './digitDisplay';
import { GAME_WIDTH, OFFSET_Y } from './consts';
import { getDailyTarget, getDailySeed, DAILY_GRID_W, DAILY_GRID_H, DAILY_DURATION_MS } from './dailyChallengeConfig';
import { saveDailyScore, getDailyBestScore, recordDailyPlay } from './dailyChallengeStore';
import { makeRng } from './seededRng';
import { UIElement } from '../inputSystem/uiElement';

const COMBO_WINDOW_MS  = 3_000;
const HINT_DELAY_MS    = 3_000;
const RESULT_DISPLAY_MS = 500;

export class DailyChallengeScene extends PIXI.Container {
  private readonly screen: ScreenConfig;
  private readonly state:  GameState;
  private readonly logic:  DailyChallengeLogic;

  private bg!:           PIXI.Graphics;
  private gridLayer!:    Grid;
  private numberLayer!:  NumberLayer;
  private effectLayer!:  EffectManager;
  private resultOverlay!: DailyChallengeResult;

  // ── Header row 1: mode icon / score / timer ───────────────────────────────
  private headerBar!:    PIXI.Graphics;
  private scoreDisplay!: DigitDisplay;   // 得分（数字精灵）
  private timerDisplay!: DigitDisplay;   // 倒计时（数字精灵）

  // ── Header row 2: sprite-based tip formula ────────────────────────────────
  private tipContainer!: PIXI.Container;
  /** 消除成功后短暂展示完整等式计时器，-1 = 空闲。 */
  private tipResultElapsed = -1;

  // ── Runtime ───────────────────────────────────────────────────────────────
  private selectedIndex    = -1;
  private score            = 0;
  private comboCount       = 0;
  private lastElimGameTime = -Infinity;
  private gameTimeMs       = 0;
  private initialized      = false;
  private playRecorded     = false;

  // ── Hint system ───────────────────────────────────────────────────────────
  /** ms elapsed since the player selected the first tile; -1 = inactive. */
  private hintTimerMs = -1;
  /** True once the hint has fired for the current selection. */
  private hintFired   = false;

  constructor(
    private readonly ctx: AppContext,
    private readonly onGoLobby: () => void,
  ) {
    super();
    this.screen = new ScreenConfig();
    this.state  = new GameState();
    this.logic  = new DailyChallengeLogic();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Call each time the player enters Daily Challenge (from the lobby). */
  public start(): void {
    this.score            = 0;
    this.comboCount       = 0;
    this.lastElimGameTime = -Infinity;
    this.gameTimeMs       = 0;
    this.selectedIndex    = -1;
    this.playRecorded     = false;
    this.resetHintTimer();

    this.state.reset();
    this.state.addTime(DAILY_DURATION_MS);

    const target = getDailyTarget();
    const rng    = makeRng(getDailySeed());
    this.logic.initializeSeeded(target, rng);

    if (this.initialized) {
      this.resultOverlay.hide();
      this.updateScoreDisplay();
      this.updateTimerDisplay();
      this.rebuildTip(null, null);
      this.syncGrid();
    }
  }

  public resize(windowWidth: number, windowHeight: number): void {
    this.screen.update(windowWidth, windowHeight);
    this.screen.setGridDims(DAILY_GRID_W, DAILY_GRID_H);

    if (!this.initialized) {
      this.buildScene();
      this.initialized = true;
    } else {
      drawBackground(this.bg, this.screen.width, this.screen.height);
      this.gridLayer.reconfigure();
      this.numberLayer.reconfigure(this.logic);
    }

    this.x = 0;
    this.y = 0;
    this.scale.set(this.screen.scale);
  }

  public update(deltaMs: number): void {
    if (!this.initialized) return;

    this.effectLayer.update(deltaMs);
    // Keep hint animations running even when game is over
    this.numberLayer.update(deltaMs);
    this.updateTipResultReset(deltaMs);

    if (this.state.isGameEnd) return;

    this.gameTimeMs += deltaMs;
    this.state.tick(deltaMs);
    this.updateTimerDisplay();

    if (this.state.isTimeUp) {
      this.onTimeUp();
      return;
    }

    // ── Hint timer ────────────────────────────────────────────────────
    if (this.hintTimerMs >= 0 && !this.hintFired) {
      this.hintTimerMs += deltaMs;
      if (this.hintTimerMs >= HINT_DELAY_MS) {
        this.triggerHint();
      }
    }
  }

  // ── Scene construction ─────────────────────────────────────────────────────

  private buildScene(): void {
    this.screen.setGridDims(DAILY_GRID_W, DAILY_GRID_H);

    this.bg = new PIXI.Graphics();
    drawBackground(this.bg, this.screen.width, this.screen.height);
    this.addChild(this.bg);

    this.gridLayer   = new Grid(this.ctx, this.screen, idx => this.onCellClick(idx));
    this.numberLayer = new NumberLayer(this.ctx, this.screen);
    this.effectLayer = new EffectManager(this.ctx, this.screen);

    this.resultOverlay = new DailyChallengeResult(
      this.ctx,
      () => this.start(),
      () => this.onGoLobby(),
    );

    this.addChild(this.gridLayer);
    this.addChild(this.numberLayer);
    this.addChild(this.effectLayer);

    this.buildHeader();
    this.addChild(this.resultOverlay);

    this.syncGrid();
    this.updateScoreDisplay();
    this.updateTimerDisplay();
    this.rebuildTip(null, null);
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  /**
   * Header layout (portrait, GAME_WIDTH = 1080):
   *
   * Row 1 (y ≈ 18–90):  [← daily icon (left)]  [SCORE (centre)]  [TIMER (right)]
   * Row 2 (y ≈ 95–185): [□ + □ = Target  (left, sprite-based)]
   */
  private buildHeader(): void {
    const H = OFFSET_Y - 10;   // 290 px
    const W = GAME_WIDTH;

    this.headerBar = new PIXI.Graphics();
    drawHeaderBar(this.headerBar, W - 40, H - 20);
    this.headerBar.x = 20;
    this.headerBar.y = 10;
    this.addChild(this.headerBar);

    // Daily challenge icon（代替文字标签，row 1, left）
    const ICON_H = 70;
    const icon = new PIXI.Sprite(this.ctx.assets.GetTexture('daily_challenge_icon.png'));
    const iconScale = ICON_H / Math.max(icon.texture.width, icon.texture.height);
    icon.width  = icon.texture.width  * iconScale;
    icon.height = icon.texture.height * iconScale;
    icon.x = 50;
    icon.y = 15;
    this.addChild(icon);

    // Score（row 1, centre）— digit sprites，居中
    const SCORE_DIGIT_H = 72;
    const SCORE_DIGIT_W = Math.round(SCORE_DIGIT_H * 120 / 160);
    this.scoreDisplay = new DigitDisplay(this.ctx, SCORE_DIGIT_W, SCORE_DIGIT_H);
    this.scoreDisplay.y = 18;
    this.addChild(this.scoreDisplay);

    // Timer（row 1, right）— digit sprites，右对齐
    const TIMER_DIGIT_H = 72;
    const TIMER_DIGIT_W = Math.round(TIMER_DIGIT_H * 120 / 160);
    this.timerDisplay = new DigitDisplay(this.ctx, TIMER_DIGIT_W, TIMER_DIGIT_H);
    this.timerDisplay.y = 18;
    this.addChild(this.timerDisplay);

    // Back-to-lobby tap zone（覆盖图标区域）
    this.buildBackButton();
  }

  private buildBackButton(): void {
    const hitArea = new PIXI.Sprite(PIXI.Texture.EMPTY);
    hitArea.width  = 260;
    hitArea.height = 110;
    hitArea.x = 20;
    hitArea.y = 10;
    this.addChild(hitArea);
    this.ctx.input.registerUI(
      new UIElement({ zIndex: 15, sprite: hitArea, onTap: () => this.onGoLobby() }),
    );
  }

  // ── Tip formula (row 2 of header) ─────────────────────────────────────────

  /**
   * Rebuild the sprite-based tip formula in the lower half of the header.
   *
   * Layout (portrait, local y ≈ 115–205):
   *   [Slot1] [+] [Slot2] [=] [Target]
   *
   * Uses the same sprite assets and slot/value helpers as the main game Header.
   */
  private rebuildTip(first: number | null, second: number | null): void {
    if (this.tipContainer) {
      this.removeChild(this.tipContainer);
      this.tipContainer.destroy({ children: true });
    }
    this.tipContainer = new PIXI.Container();

    // Tip row sits in the lower half of the header
    const W = 65, H = 82, Y = 115;

    this.addTipSlotOrValue(this.tipContainer, first,  50,  Y, W, H);

    const plus  = new PIXI.Sprite(this.ctx.assets.GetTexture('plus.png'));
    plus.width  = W; plus.height = H;
    plus.x      = 125; plus.y   = Y;
    this.tipContainer.addChild(plus);

    this.addTipSlotOrValue(this.tipContainer, second, 200, Y, W, H);

    const equa  = new PIXI.Sprite(this.ctx.assets.GetTexture('equa.png'));
    equa.width  = W; equa.height = H;
    equa.x      = 275; equa.y   = Y;
    this.tipContainer.addChild(equa);

    // Target digits
    const target = getDailyTarget();
    target.toString().split('').forEach((ch, i) => {
      const s   = new PIXI.Sprite(this.ctx.assets.GetTexture(`${ch}.png`));
      s.width   = W; s.height = H;
      s.x       = 350 + i * 70; s.y = Y;
      this.tipContainer.addChild(s);
    });

    this.addChild(this.tipContainer);
  }

  /**
   * Draw an empty slot (rounded rect + "?") or a digit sprite at (x, y).
   * Mirrors the equivalent method in header.ts.
   */
  private addTipSlotOrValue(
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
      // 问号：程序绘制，替代原 PIXI.Text('?')
      drawQuestionMark(g, x + w / 2, y + h / 2, h);
      container.addChild(g);
    } else {
      const digits = value.toString().split('');
      if (digits.length === 1) {
        const s   = new PIXI.Sprite(this.ctx.assets.GetTexture(`${digits[0]}.png`));
        s.width   = w; s.height = h;
        s.x       = x; s.y     = y;
        container.addChild(s);
      } else {
        const dw = Math.floor((w - 4) / 2);
        digits.forEach((ch, i) => {
          const s = new PIXI.Sprite(this.ctx.assets.GetTexture(`${ch}.png`));
          s.width = dw; s.height = h;
          s.x     = x + i * (dw + 4); s.y = y;
          container.addChild(s);
        });
      }
    }
  }

  /** Called every frame to auto-reset tip display after a successful match. */
  private updateTipResultReset(deltaMs: number): void {
    if (this.tipResultElapsed < 0) return;
    this.tipResultElapsed += deltaMs;
    if (this.tipResultElapsed >= RESULT_DISPLAY_MS) {
      this.tipResultElapsed = -1;
      this.rebuildTip(null, null);
    }
  }

  // ── Grid sync ──────────────────────────────────────────────────────────────

  private syncGrid(): void {
    this.gridLayer.reconfigure();
    this.numberLayer.reconfigure(this.logic);

    for (let col = 0; col < DAILY_GRID_W; col++) {
      for (let row = 0; row < DAILY_GRID_H; row++) {
        const idx = this.screen.cellIndex(col, row);
        if (this.logic.getNumberByIndex(idx) === 0) {
          this.gridLayer.hideCell(idx);
        }
      }
    }
  }

  // ── Cell click ─────────────────────────────────────────────────────────────

  private onCellClick(index: number): void {
    if (this.state.isGameEnd) return;
    if (this.logic.getNumberByIndex(index) === 0) return;

    if (this.selectedIndex === -1) {
      // First selection
      this.selectedIndex = index;
      this.gridLayer.showSelection(index);
      this.rebuildTip(this.logic.getNumberByIndex(index), null);
      this.startHintTimer();
      return;
    }

    if (this.selectedIndex === index) {
      // Tap same cell again → deselect
      this.selectedIndex = -1;
      this.gridLayer.hideSelection();
      this.rebuildTip(null, null);
      this.resetHintTimer();
      return;
    }

    const a      = this.logic.getNumberByIndex(this.selectedIndex);
    const b      = this.logic.getNumberByIndex(index);
    const target = getDailyTarget();

    if (a + b === target) {
      this.eliminatePair(this.selectedIndex, index, a, b);
    } else {
      // Wrong second choice — switch selection to the newly tapped cell
      this.selectedIndex = index;
      this.gridLayer.showSelection(index);
      this.rebuildTip(b, null);
      this.startHintTimer();
    }
  }

  private eliminatePair(idxA: number, idxB: number, a: number, b: number): void {
    this.resetHintTimer();

    // Show full match result in tip, then auto-reset after 500 ms
    this.rebuildTip(a, b);
    this.tipResultElapsed = 0;

    this.gridLayer.hideSelection();
    this.gridLayer.hideCell(idxA);
    this.gridLayer.hideCell(idxB);
    this.numberLayer.hideNumber(idxA);
    this.numberLayer.hideNumber(idxB);
    this.effectLayer.playEffect(idxA);
    this.effectLayer.playEffect(idxB);
    this.logic.removeNumber(idxA);
    this.logic.removeNumber(idxB);
    this.selectedIndex = -1;

    // ── Combo & scoring ────────────────────────────────────────────────
    const elapsed = this.gameTimeMs - this.lastElimGameTime;
    if (elapsed <= COMBO_WINDOW_MS) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    this.lastElimGameTime = this.gameTimeMs;

    // +2 / +3 / +4 / +5 (capped at 4th consecutive combo)
    const points = this.comboCount === 1 ? 2
                 : this.comboCount === 2 ? 3
                 : this.comboCount === 3 ? 4
                 :                         5;
    this.score += points;
    this.updateScoreDisplay();

    // ── Row collapse ───────────────────────────────────────────────────
    let collapsed = this.logic.checkAndCollapse();
    while (collapsed) {
      this.syncGrid();
      collapsed = this.logic.checkAndCollapse();
    }
  }

  // ── Hint system ────────────────────────────────────────────────────────────

  private resetHintTimer(): void {
    this.hintTimerMs = -1;
    this.hintFired   = false;
  }

  private startHintTimer(): void {
    this.hintTimerMs = 0;
    this.hintFired   = false;
  }

  private triggerHint(): void {
    if (this.selectedIndex === -1 || this.hintFired) return;
    this.hintFired = true;

    const selectedValue = this.logic.getNumberByIndex(this.selectedIndex);
    const target        = getDailyTarget();
    const pairIndices   = this.logic.findPairIndices(selectedValue, target);

    if (pairIndices.length > 0) {
      this.numberLayer.flashHint(pairIndices);
    }
  }

  // ── Display helpers ────────────────────────────────────────────────────────

  private updateScoreDisplay(): void {
    this.scoreDisplay.update(this.score);
    // 居中
    this.scoreDisplay.x = GAME_WIDTH / 2 - this.scoreDisplay.totalWidth / 2;
  }

  private updateTimerDisplay(): void {
    const secs = this.state.remainingSeconds;
    this.timerDisplay.update(secs);
    // 右对齐
    this.timerDisplay.x = GAME_WIDTH - 50 - this.timerDisplay.totalWidth;
    // 低时间警告：tint 变红（前提是 digits.png 为浅色）
    this.timerDisplay.tint = secs <= 10 ? 0xff4444 : 0xFFFFFF;
  }

  // ── Time up ────────────────────────────────────────────────────────────────

  private onTimeUp(): void {
    this.state.isGameEnd = true;
    this.selectedIndex   = -1;
    this.gridLayer.hideSelection();

    if (!this.playRecorded) {
      recordDailyPlay();
      this.playRecorded = true;
    }

    const isNewBest = saveDailyScore(this.score);
    this.resultOverlay.show(this.score, isNewBest);
  }
}
