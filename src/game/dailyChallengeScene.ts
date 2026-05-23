/**
 * dailyChallengeScene.ts
 *
 * The Daily Challenge scene — a 90-second timed sprint on a fixed 6×8 board.
 *
 * Key differences from GameScene:
 *   - No lives, no target progression: one board, one timer.
 *   - Scoring: +2 per elimination; combo multiplies: +3 / +4 / +5 (cap).
 *   - Tetris-style row collapse: when a full row is cleared the rows above
 *     fall down and a fresh self-paired row is inserted at the top.
 *   - Board is seeded by today's date so every player faces the same layout.
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
import { drawBackground, drawHeaderBar, C } from './graphicsFactory';
import { GAME_WIDTH, OFFSET_Y } from './consts';
import { getDailyTarget, getDailySeed, DAILY_GRID_W, DAILY_GRID_H, DAILY_DURATION_MS } from './dailyChallengeConfig';
import { saveDailyScore, getDailyBestScore, recordDailyPlay } from './dailyChallengeStore';
import { makeRng } from './seededRng';
import { UIElement } from '../inputSystem/uiElement';

const COMBO_WINDOW_MS = 3_000;

export class DailyChallengeScene extends PIXI.Container {
  private readonly screen: ScreenConfig;
  private readonly state:  GameState;
  private readonly logic:  DailyChallengeLogic;

  private bg!:           PIXI.Graphics;
  private gridLayer!:    Grid;
  private numberLayer!:  NumberLayer;
  private effectLayer!:  EffectManager;
  private resultOverlay!: DailyChallengeResult;

  // Header elements (programmatic, no external assets needed)
  private headerBar!:   PIXI.Graphics;
  private timerText!:   PIXI.Text;
  private scoreLabel!:  PIXI.Text;
  private targetLabel!: PIXI.Text;

  // Runtime
  private selectedIndex   = -1;
  private score           = 0;
  private comboCount      = 0;
  private lastElimGameTime = -Infinity;
  private gameTimeMs      = 0;
  private initialized     = false;
  private playRecorded    = false; // streak recorded once per session

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
    this.score         = 0;
    this.comboCount    = 0;
    this.lastElimGameTime = -Infinity;
    this.gameTimeMs    = 0;
    this.selectedIndex = -1;
    this.playRecorded  = false;

    // Reset timer to full 90 s
    this.state.reset();
    this.state.addTime(DAILY_DURATION_MS);

    // Regenerate the seeded board
    const target = getDailyTarget();
    const rng    = makeRng(getDailySeed());
    this.logic.initializeSeeded(target, rng);

    if (this.initialized) {
      this.resultOverlay.hide();
      this.updateHeaderDisplay();
      this.syncGrid();
    }
    // else: buildScene() will be called on first resize()
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
      this.repositionHeader();
    }

    this.x = 0;
    this.y = 0;
    this.scale.set(this.screen.scale);
  }

  public update(deltaMs: number): void {
    if (!this.initialized) return;

    this.effectLayer.update(deltaMs);

    if (this.state.isGameEnd) return;

    this.gameTimeMs += deltaMs;
    this.state.tick(deltaMs);
    this.updateTimerDisplay();

    if (this.state.isTimeUp) {
      this.onTimeUp();
    }
  }

  // ── Scene construction ─────────────────────────────────────────────────────

  private buildScene(): void {
    // Ensure grid dims are set before anything uses ScreenConfig
    this.screen.setGridDims(DAILY_GRID_W, DAILY_GRID_H);

    this.bg = new PIXI.Graphics();
    drawBackground(this.bg, this.screen.width, this.screen.height);
    this.addChild(this.bg);

    this.gridLayer   = new Grid(this.ctx, this.screen, idx => this.onCellClick(idx));
    this.numberLayer = new NumberLayer(this.ctx, this.screen);
    this.effectLayer = new EffectManager(this.ctx, this.screen);

    this.resultOverlay = new DailyChallengeResult(
      this.ctx,
      () => this.start(),          // play again
      () => this.onGoLobby(),
    );

    this.addChild(this.gridLayer);
    this.addChild(this.numberLayer);
    this.addChild(this.effectLayer);

    this.buildHeader();
    this.addChild(this.resultOverlay);

    // Populate board (start() has already seeded logic before first resize)
    this.syncGrid();
    this.updateHeaderDisplay();
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  private buildHeader(): void {
    const H = OFFSET_Y - 10;
    const W = GAME_WIDTH;

    this.headerBar = new PIXI.Graphics();
    drawHeaderBar(this.headerBar, W - 40, H - 20);
    this.headerBar.x = 20;
    this.headerBar.y = 10;
    this.addChild(this.headerBar);

    // "每日挑战" label (top-left)
    const modeLabel = new PIXI.Text('每日挑战', {
      fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold', fill: C.icon,
    });
    modeLabel.x = 50;
    modeLabel.y = 20;
    this.addChild(modeLabel);

    // Target label (centre-left)
    this.targetLabel = new PIXI.Text('', {
      fontFamily: 'Arial', fontSize: 34, fill: C.icon,
    });
    this.targetLabel.x = 50;
    this.targetLabel.y = 75;
    this.addChild(this.targetLabel);

    // Score (centre)
    this.scoreLabel = new PIXI.Text('0', {
      fontFamily: 'Arial', fontSize: 72, fontWeight: 'bold', fill: 0x2c6e49,
    });
    this.scoreLabel.anchor.set(0.5, 0);
    this.scoreLabel.x = GAME_WIDTH / 2;
    this.scoreLabel.y = 18;
    this.addChild(this.scoreLabel);

    // Timer (right)
    this.timerText = new PIXI.Text('90', {
      fontFamily: 'Arial', fontSize: 72, fontWeight: 'bold', fill: C.clockBorder,
    });
    this.timerText.anchor.set(1, 0);
    this.timerText.x = GAME_WIDTH - 50;
    this.timerText.y = 18;
    this.addChild(this.timerText);

    // Back-to-lobby tap zone (top-left corner)
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

  private repositionHeader(): void {
    /* Header is in logical-pixel space and doesn't need repositioning
       on resize — it is anchored to the top of the logical canvas. */
  }

  private updateHeaderDisplay(): void {
    const target = getDailyTarget();
    this.targetLabel.text = `目标 ${target}`;
    this.scoreLabel.text  = this.score.toString();
    this.updateTimerDisplay();
  }

  private updateTimerDisplay(): void {
    const secs = this.state.remainingSeconds;
    this.timerText.text  = secs.toString();
    this.timerText.style.fill = secs <= 10 ? 0xcc0000 : C.clockBorder;
  }

  // ── Grid sync ──────────────────────────────────────────────────────────────

  /**
   * Sync Grid and NumberLayer to the current logic state.
   * Used after collapse (cells that previously had holes may now be filled)
   * and after start() resets the board.
   */
  private syncGrid(): void {
    this.gridLayer.reconfigure();       // make all active-dim cells visible
    this.numberLayer.reconfigure(this.logic);

    // Re-hide cells where the logic value is 0 (eliminated holes)
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
      this.selectedIndex = index;
      this.gridLayer.showSelection(index);
      return;
    }

    if (this.selectedIndex === index) {
      this.selectedIndex = -1;
      this.gridLayer.hideSelection();
      return;
    }

    const a      = this.logic.getNumberByIndex(this.selectedIndex);
    const b      = this.logic.getNumberByIndex(index);
    const target = getDailyTarget();

    if (a + b === target) {
      this.eliminatePair(this.selectedIndex, index);
    } else {
      this.selectedIndex = index;
      this.gridLayer.showSelection(index);
    }
  }

  private eliminatePair(idxA: number, idxB: number): void {
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

    const points = this.comboCount === 1 ? 2
                 : this.comboCount === 2 ? 3
                 : this.comboCount === 3 ? 4
                 :                         5; // cap at 5
    this.score += points;
    this.scoreLabel.text = this.score.toString();

    // ── Row collapse ───────────────────────────────────────────────────
    // Keep collapsing until no more empty rows remain (shouldn't chain,
    // but the loop guards against edge cases).
    let collapsed = this.logic.checkAndCollapse();
    while (collapsed) {
      this.syncGrid();
      collapsed = this.logic.checkAndCollapse();
    }
  }

  // ── Time up ────────────────────────────────────────────────────────────────

  private onTimeUp(): void {
    this.state.isGameEnd = true;
    this.selectedIndex   = -1;
    this.gridLayer.hideSelection();

    // Record streak once per session (first time time runs out)
    if (!this.playRecorded) {
      recordDailyPlay();
      this.playRecorded = true;
    }

    const isNewBest = saveDailyScore(this.score);
    this.resultOverlay.show(this.score, isNewBest);
  }
}
