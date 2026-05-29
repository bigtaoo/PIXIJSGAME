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
import { DailyChallengeHeader } from './dailyChallengeHeader';
import { drawBackground } from './graphicsFactory';
import { getDailyTarget, getDailySeed, DAILY_GRID_W, DAILY_GRID_H, DAILY_DURATION_MS } from './dailyChallengeConfig';
import { Orientation } from './enums';
import { saveDailyScore, recordDailyPlay } from './dailyChallengeStore';
import { makeRng } from './seededRng';

const COMBO_WINDOW_MS = 3_000;
const HINT_DELAY_MS   = 3_000;

export class DailyChallengeScene extends PIXI.Container {
  private readonly screen: ScreenConfig;
  private readonly state:  GameState;
  private readonly logic:  DailyChallengeLogic;

  private bg!:            PIXI.Graphics;
  private gridLayer!:     Grid;
  private numberLayer!:   NumberLayer;
  private effectLayer!:   EffectManager;
  private header!:        DailyChallengeHeader;
  private resultOverlay!: DailyChallengeResult;

  private selectedIndex    = -1;
  private score            = 0;
  private comboCount       = 0;
  private lastElimGameTime = -Infinity;
  private gameTimeMs       = 0;
  private initialized      = false;
  private playRecorded     = false;

  private hintTimerMs = -1;
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

    const rng = makeRng(getDailySeed());
    this.logic.initializeSeeded(getDailyTarget(), rng);

    if (this.initialized) {
      this.resultOverlay.hide();
      this.header.setScore(0);
      this.header.setTimer(this.state.remainingSeconds);
      this.header.rebuildTip(null, null);
      this.syncGrid();
    }
  }

  /**
   * Daily challenge always uses a fixed 6-col × 10-row grid in portrait
   * coordinate space.  ScreenConfig swaps W/H in landscape, so we pass the
   * transposed values to ensure gridCountW=6, gridCountH=10 in both
   * orientations.
   */
  private applyGridDims(): void {
    const landscape = this.screen.orientation === Orientation.Landscape;
    this.screen.setGridDims(
      landscape ? DAILY_GRID_H : DAILY_GRID_W,
      landscape ? DAILY_GRID_W : DAILY_GRID_H,
    );
  }

  public resize(windowWidth: number, windowHeight: number): void {
    this.screen.update(windowWidth, windowHeight);
    this.applyGridDims();

    if (!this.initialized) {
      this.buildScene();
      this.initialized = true;
    } else {
      drawBackground(this.bg, this.screen.width, this.screen.height);
      // Use syncGrid() instead of bare reconfigure() so that already-eliminated
      // cells (value == 0) are hidden again after the grid is rebuilt.
      this.syncGrid();
      this.header.resize(this.screen);
      this.header.setScore(this.score);
      this.header.setTimer(this.state.remainingSeconds);
      this.resultOverlay.resize(this.screen);
    }

    this.x = 0;
    this.y = 0;
    this.scale.set(this.screen.scale);
  }

  public update(deltaMs: number): void {
    if (!this.initialized) return;

    this.effectLayer.update(deltaMs);
    this.numberLayer.update(deltaMs);
    this.header.tickTipReset(deltaMs);

    if (this.state.isGameEnd) return;

    this.gameTimeMs += deltaMs;
    this.state.tick(deltaMs);
    this.header.setTimer(this.state.remainingSeconds);

    if (this.state.isTimeUp) {
      this.onTimeUp();
      return;
    }

    if (this.hintTimerMs >= 0 && !this.hintFired) {
      this.hintTimerMs += deltaMs;
      if (this.hintTimerMs >= HINT_DELAY_MS) {
        this.triggerHint();
      }
    }
  }

  // ── Scene construction ─────────────────────────────────────────────────────

  private buildScene(): void {
    this.applyGridDims();

    this.bg = new PIXI.Graphics();
    drawBackground(this.bg, this.screen.width, this.screen.height);
    this.addChild(this.bg);

    this.gridLayer   = new Grid(this.ctx, this.screen, idx => this.onCellClick(idx));
    this.numberLayer = new NumberLayer(this.ctx, this.screen);
    this.effectLayer = new EffectManager(this.ctx, this.screen);
    const audio = this.ctx.audio;
    this.header      = new DailyChallengeHeader(this.ctx, () => { audio.playClick(); this.onGoLobby(); }, this.screen);

    this.resultOverlay = new DailyChallengeResult(
      this.ctx,
      () => { audio.playClick(); this.start(); },
      () => { audio.playClick(); this.onGoLobby(); },
    );

    this.addChild(this.gridLayer);
    this.addChild(this.numberLayer);
    this.addChild(this.effectLayer);
    this.addChild(this.header);
    // flyingLayer must be above the header so score labels are never obscured
    this.addChild(this.effectLayer.flyingLayer);
    this.addChild(this.resultOverlay);

    this.syncGrid();
    this.header.setScore(0);
    this.header.setTimer(this.state.remainingSeconds);
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

    this.ctx.audio.playClick();

    if (this.selectedIndex === -1) {
      this.selectedIndex = index;
      this.gridLayer.showSelection(index);
      this.header.rebuildTip(this.logic.getNumberByIndex(index), null);
      this.startHintTimer();
      return;
    }

    if (this.selectedIndex === index) {
      this.selectedIndex = -1;
      this.gridLayer.hideSelection();
      this.header.rebuildTip(null, null);
      this.resetHintTimer();
      return;
    }

    const a      = this.logic.getNumberByIndex(this.selectedIndex);
    const b      = this.logic.getNumberByIndex(index);
    const target = getDailyTarget();

    if (a + b === target) {
      this.eliminatePair(this.selectedIndex, index, a, b);
    } else {
      this.selectedIndex = index;
      this.gridLayer.showSelection(index);
      this.header.rebuildTip(b, null);
      this.startHintTimer();
    }
  }

  private eliminatePair(idxA: number, idxB: number, a: number, b: number): void {
    this.resetHintTimer();

    // 显示完整等式，500 ms 后自动复位
    this.header.rebuildTip(a, b);
    this.header.startTipResultTimer();

    this.gridLayer.hideSelection();
    this.gridLayer.hideCell(idxA);
    this.gridLayer.hideCell(idxB);
    this.numberLayer.hideNumber(idxA);
    this.numberLayer.hideNumber(idxB);

    // ── Combo & scoring ─────────────────────────────────────────────────────
    const elapsed = this.gameTimeMs - this.lastElimGameTime;
    if (elapsed <= COMBO_WINDOW_MS) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    this.lastElimGameTime = this.gameTimeMs;

    const isCombo = this.comboCount > 1;
    this.effectLayer.playEffect(idxA, isCombo, this.comboCount);
    this.effectLayer.playEffect(idxB, isCombo, this.comboCount);
    this.logic.removeNumber(idxA);
    this.logic.removeNumber(idxB);
    this.selectedIndex = -1;

    // +2 / +3 / +4 / +5 (capped at 4th combo)
    const points = this.comboCount === 1 ? 2
                 : this.comboCount === 2 ? 3
                 : this.comboCount === 3 ? 4
                 :                         5;
    this.score += points;
    this.header.setScore(this.score);

    // Flying score animation: "+N" pops from the last-tapped cell and flies
    // to the score display area in the header.
    const half     = this.screen.gridSize / 2;
    const posB     = this.screen.indexToPos(idxB);
    const scorePos = this.header.getScoreCenterPos();
    this.effectLayer.playFlyingScore(
      posB.x + half, posB.y + half,
      scorePos.x, scorePos.y,
      points, this.comboCount > 1,
    );

    // ── Row collapse ────────────────────────────────────────────────────────
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
    const pairIndices   = this.logic.findPairIndices(selectedValue, getDailyTarget());
    if (pairIndices.length > 0) {
      this.numberLayer.flashHint(pairIndices);
    }
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

    if (this.score > 0) {
      this.ctx.audio.playVictory();
    } else {
      this.ctx.audio.playGameOver();
    }

    const isNewBest = saveDailyScore(this.score);
    this.resultOverlay.show(this.score, isNewBest);
  }
}
