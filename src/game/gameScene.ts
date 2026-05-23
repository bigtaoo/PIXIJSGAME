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

  private static readonly COMBO_WINDOW_MS = 3000;

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

    if (this.state.isGameEnd || this.state.isPause) return;

    this.gameTimeMs += deltaMs;

    this.state.tick(deltaMs);
    this.header.updateTime(this.state.remainingSeconds);

    if (this.state.isTimeUp) {
      this.onTimeUp();
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
  }

  private onTargetCleared(): void {
    this.currentTargetIdx++;
    if (this.currentTargetIdx >= this.stage.targets.length) {
      // All targets cleared — calculate and persist star rating
      this.state.isGameEnd = true;
      this.selectedIndex   = -1;
      this.gridLayer.hideSelection();
      const stars = StarManager.calculateStars(this.livesEverLost, this.state.timeRemainingMs);
      StarManager.saveStars(this.stage.stageIndex, stars);
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
    const target = this.stage.targets[this.currentTargetIdx];

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

    // ── Combo logic ──────────────────────────────────────────────────
    const elapsed = this.gameTimeMs - this.lastEliminationGameTime;
    if (elapsed <= GameScene.COMBO_WINDOW_MS) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    this.lastEliminationGameTime = this.gameTimeMs;

    // Bonus seconds: 1st (+2 s), 2nd consecutive (+3 s), 3rd+ (+4 s cap)
    const bonusSec = this.comboCount === 1 ? 2
                   : this.comboCount === 2 ? 3
                   :                         4;
    const isCombo = this.comboCount > 1;

    this.state.addTime(bonusSec * 1000);

    // Flying bonus animation
    const posA = this.screen.indexToPos(idxA);
    const posB = this.screen.indexToPos(idxB);
    const half = this.screen.gridSize / 2;

    const startX = (posA.x + posB.x) / 2 + half;
    const startY = (posA.y + posB.y) / 2 + half;

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
