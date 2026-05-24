import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { GameState } from './gameState';
import { Logic } from './logic';
import { Grid } from './grid';
import { NumberLayer } from './numbers';
import { EffectManager } from './effectManager';
import { Header } from './header';
import { GameResultOverlay } from './gameResult';
import { SettingsOverlay } from './settings';
import { StageData } from './stageConfig';
import { drawBackground } from './graphicsFactory';
import { StarManager } from './starManager';
import { StageManager } from './stageManager';

export class GameScene extends PIXI.Container {
  private readonly screen: ScreenConfig;
  private readonly state: GameState;
  private readonly logic: Logic;

  private bg!: PIXI.Graphics;
  private gridLayer!: Grid;
  private numberLayer!: NumberLayer;
  private effectLayer!: EffectManager;
  private header!: Header;
  private resultOverlay!: GameResultOverlay;
  private settingsOverlay!: SettingsOverlay;

  private stage!: StageData;
  private currentTargetIdx = 0;
  private lives = 3;
  private selectedIndex = -1;
  private initialized = false;

  private comboCount = 0;
  private lastEliminationGameTime = -Infinity;
  private gameTimeMs = 0;

  /** How many ms have elapsed since the player selected the first tile. −1 = inactive. */
  private hintTimerMs = -1;
  /** True once the hint has fired for the current selection (prevents repeat). */
  private hintFired = false;

  private static readonly COMBO_WINDOW_MS = 3000;
  /** Delay before the hint flash fires after the player selects the first tile. */
  private static readonly HINT_DELAY_MS = 3000;

  /**
   * True if at least one life was lost during the current stage attempt.
   * Persists across retryStageAfterGameOver so a player who used all 3 lives
   * cannot earn 2 or 3 stars even after retrying.
   */
  private livesEverLost = false;

  constructor(
    private readonly ctx: AppContext,
    private readonly onStageComplete: (completedStage: StageData) => void,
    private readonly onGoLobby: () => void,
  ) {
    super();
    this.screen = new ScreenConfig();
    this.state  = new GameState();
    this.logic  = new Logic();
  }

  // ── Public API ─────────────────────────────────────────────────────

  public loadStage(stage: StageData): void {
    this.stage = stage;
    this.screen.setGridDims(stage.gridW, stage.gridH);

    this.lives            = 3;
    this.currentTargetIdx = 0;
    this.livesEverLost    = false;
    this.state.reset();
    this.gameTimeMs = 0;

    if (this.initialized) {
      this.resultOverlay.hide();
      this.settingsOverlay.hide();
      this.startCurrentTarget();
    }
  }

  public resize(windowWidth: number, windowHeight: number): void {
    this.screen.update(windowWidth, windowHeight);

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
    this.header.update(deltaMs);
    // Keep hint flash animations running even while paused/ended
    this.numberLayer.update(deltaMs);

    if (this.state.isGameEnd || this.state.isPause) return;

    this.gameTimeMs += deltaMs;

    this.state.tick(deltaMs);
    this.header.updateTime(this.state.remainingSeconds);

    if (this.state.isTimeUp) {
      this.onTimeUp();
    }

    // ── Hint timer ──────────────────────────────────────────────────────
    if (this.hintTimerMs >= 0 && !this.hintFired) {
      this.hintTimerMs += deltaMs;
      if (this.hintTimerMs >= GameScene.HINT_DELAY_MS) {
        this.triggerHint();
      }
    }
  }

  // ── Scene construction ─────────────────────────────────────────────

  private buildScene(): void {
    this.bg = new PIXI.Graphics();
    drawBackground(this.bg, this.screen.width, this.screen.height);
    this.addChild(this.bg);

    this.gridLayer   = new Grid(this.ctx, this.screen, (idx) => this.onCellClick(idx));
    this.numberLayer = new NumberLayer(this.ctx, this.screen);
    this.effectLayer = new EffectManager(this.ctx, this.screen);
    this.header      = new Header(
      this.ctx, this.screen,
      this.stage.targets[0],
      () => this.openSettings(),
    );

    this.resultOverlay = new GameResultOverlay(
      this.ctx,
      () => this.retryStageAfterGameOver(),
      () => this.onStageComplete(this.stage),
      () => this.onGoLobby(),
    );
    this.settingsOverlay = new SettingsOverlay(
      this.ctx,
      () => this.resumeGame(),
      () => this.onGoLobby(),
    );

    this.addChild(this.gridLayer);
    this.addChild(this.numberLayer);
    this.addChild(this.effectLayer);
    this.addChild(this.header);
    // flyingLayer must sit ABOVE the header so bonus labels are never obscured
    this.addChild(this.effectLayer.flyingLayer);
    this.addChild(this.resultOverlay);
    this.addChild(this.settingsOverlay);

    this.startCurrentTarget();
  }

  // ── Target flow ────────────────────────────────────────────────────

  private startCurrentTarget(): void {
    const target = this.stage.targets[this.currentTargetIdx];

    this.state.isGameEnd = false;
    this.state.addTime(30_000);

    this.logic.initialize(this.screen, target);
    this.header.updateTarget(target);
    this.header.updateLives(this.lives);

    this.gridLayer.reconfigure();
    this.numberLayer.reconfigure(this.logic);

    this.selectedIndex = -1;
    this.gridLayer.hideSelection();

    this.comboCount = 0;
    this.lastEliminationGameTime = -Infinity;
    this.resetHintTimer();
  }

  private onTargetCleared(): void {
    this.currentTargetIdx++;
    if (this.currentTargetIdx >= this.stage.targets.length) {
      // All targets cleared — persist progress and star rating immediately,
      // so the lobby reflects the new unlock even if the player taps "lobby"
      // instead of "next".
      this.state.isGameEnd = true;
      this.selectedIndex   = -1;
      this.gridLayer.hideSelection();
      const stars = StarManager.calculateStars(this.livesEverLost, this.state.timeRemainingMs);
      StarManager.saveStars(this.stage.stageIndex, stars);
      StageManager.recordComplete(this.stage.stageIndex);
      this.resultOverlay.show(true, stars);
    } else {
      this.startCurrentTarget();
    }
  }

  private onTimeUp(): void {
    this.livesEverLost = true;
    this.lives--;
    this.header.updateLives(this.lives);
    if (this.lives > 0) {
      this.retryStage();
    } else {
      this.state.isGameEnd = true;
      this.selectedIndex   = -1;
      this.gridLayer.hideSelection();
      this.resultOverlay.show(false);
    }
  }

  private retryStageAfterGameOver(): void {
    this.lives = 3;
    this.header.updateLives(this.lives);
    this.resultOverlay.hide();
    this.retryStage();
  }

  private retryStage(): void {
    this.currentTargetIdx = 0;
    this.state.reset();
    this.resultOverlay.hide();

    this.comboCount = 0;
    this.lastEliminationGameTime = -Infinity;

    this.startCurrentTarget();
  }

  // ── Cell click ─────────────────────────────────────────────────────

  private onCellClick(index: number): void {
    if (this.state.isGameEnd || this.state.isPause) return;

    if (this.logic.getNumberByIndex(index) === 0) return;

    if (this.selectedIndex === -1) {
      // First selection — start the hint countdown
      this.selectedIndex = index;
      this.gridLayer.showSelection(index);
      this.header.setFirstSelected(this.logic.getNumberByIndex(index));
      this.startHintTimer();
      return;
    }

    if (this.selectedIndex === index) {
      // Tap the same cell again → deselect
      this.selectedIndex = -1;
      this.gridLayer.hideSelection();
      this.header.resetTip();
      this.resetHintTimer();
      return;
    }

    const a      = this.logic.getNumberByIndex(this.selectedIndex);
    const b      = this.logic.getNumberByIndex(index);
    const target = this.stage.targets[this.currentTargetIdx];

    if (a + b === target) {
      this.eliminatePair(this.selectedIndex, index, a, b);
    } else {
      // Wrong second choice — switch selection to the newly tapped cell
      this.selectedIndex = index;
      this.gridLayer.showSelection(index);
      this.header.setFirstSelected(b);
      this.startHintTimer();   // restart countdown for the new selection
    }
  }

  private eliminatePair(idxA: number, idxB: number, a: number, b: number): void {
    this.resetHintTimer();   // pair found — cancel any pending hint
    this.header.showMatchResult(a, b);
    this.gridLayer.hideSelection();
    this.gridLayer.hideCell(idxA);
    this.gridLayer.hideCell(idxB);
    this.numberLayer.hideNumber(idxA);
    this.numberLayer.hideNumber(idxB);

    // ── Combo logic (computed before effects so isCombo is available) ─
    const elapsed = this.gameTimeMs - this.lastEliminationGameTime;
    if (elapsed <= GameScene.COMBO_WINDOW_MS) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    this.lastEliminationGameTime = this.gameTimeMs;

    const isCombo = this.comboCount > 1;
    this.effectLayer.playEffect(idxA, isCombo);
    this.effectLayer.playEffect(idxB, isCombo);

    this.logic.removeNumber(idxA);
    this.logic.removeNumber(idxB);
    this.selectedIndex = -1;

    // Bonus seconds: 1st (+2 s), 2nd consecutive (+3 s), 3rd+ (+4 s cap)
    const bonusSec = this.comboCount === 1 ? 2
                   : this.comboCount === 2 ? 3
                   :                         4;

    this.state.addTime(bonusSec * 1000);

    // Flying bonus animation — bursts from the centre of the last-tapped cell (idxB)
    const half  = this.screen.gridSize / 2;
    const posB  = this.screen.indexToPos(idxB);
    const startX = posB.x + half;
    const startY = posB.y + half;

    const clockPos = this.header.getClockCenter();

    this.effectLayer.playFlyingBonus(
      startX, startY,
      clockPos.x, clockPos.y,
      bonusSec, isCombo,
      () => this.header.triggerClockBounce(),
    );

    if (this.logic.isAllRemoved()) {
      this.onTargetCleared();
    }
  }

  // ── Hint system ────────────────────────────────────────────────────────

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
    const target        = this.stage.targets[this.currentTargetIdx];
    const pairIndices   = this.logic.findPairIndices(selectedValue, target);

    if (pairIndices.length > 0) {
      this.numberLayer.flashHint(pairIndices);
    }
  }

  // Settings / pause

  private openSettings(): void {
    if (this.state.isGameEnd) return;
    this.state.isPause = true;
    this.settingsOverlay.show();
  }

  private resumeGame(): void {
    this.state.isPause = false;
    this.settingsOverlay.hide();
  }
}
