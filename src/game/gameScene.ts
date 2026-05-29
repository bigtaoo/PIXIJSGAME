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
  /** Wraps gridLayer / numberLayer / effectLayer. Scaled uniformly after layout lock. */
  private gameContainer!: PIXI.Container;
  private gridLayer!: Grid;
  private numberLayer!: NumberLayer;
  private effectLayer!: EffectManager;
  private header!: Header;
  private resultOverlay!: GameResultOverlay;
  private settingsOverlay!: SettingsOverlay;

  /** Scale factor applied to gameContainer on the last updateGameContainerTransform(). */
  private gameContainerScale = 1;

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
    this._extraLifeUsed   = false;
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

      if (this.screen.isLocked) {
        // Layout is locked (game in progress) — do NOT reconfigure the grid.
        // Instead, scale gameContainer to fit the available area proportionally.
        this.updateGameContainerTransform();
      } else {
        this.gridLayer.reconfigure();
        this.numberLayer.reconfigure(this.logic);
      }

      this.header.resize(this.screen);
      this.resultOverlay.resize(this.screen);
      this.settingsOverlay.resize(this.screen);
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

    const audio = this.ctx.audio;

    this.gridLayer   = new Grid(this.ctx, this.screen, (idx) => this.onCellClick(idx));
    this.numberLayer = new NumberLayer(this.ctx, this.screen);
    this.effectLayer = new EffectManager(this.ctx, this.screen);
    this.header      = new Header(
      this.ctx, this.screen,
      this.stage.targets[0],
      () => { audio.playClick(); this.openSettings(); },
    );

    this.resultOverlay = new GameResultOverlay(
      this.ctx,
      () => { audio.playClick(); this.retryStageAfterGameOver(); },
      () => { audio.playClick(); this.onStageComplete(this.stage); },
      () => { audio.playClick(); this.onGoLobby(); },
    );
    this.settingsOverlay = new SettingsOverlay(
      this.ctx,
      () => { audio.playClick(); this.resumeGame(); },
      () => { audio.playClick(); this.onGoLobby(); },
    );

    // gameContainer holds the three game-content layers so they can be
    // scaled as a unit when the screen rotates mid-game.
    this.gameContainer = new PIXI.Container();
    this.gameContainer.addChild(this.gridLayer);
    this.gameContainer.addChild(this.numberLayer);
    this.gameContainer.addChild(this.effectLayer);

    this.addChild(this.gameContainer);
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

    // Unlock so logic.initialize() and reconfigure() use the live screen dims,
    // then lock again once numbers are assigned to freeze the layout.
    this.screen.unlockLayout();
    this.logic.initialize(this.screen, target);
    this.header.updateTarget(target);
    this.header.updateLives(this.lives);

    this.gridLayer.reconfigure();
    this.numberLayer.reconfigure(this.logic);
    this.screen.lockLayout();
    this.updateGameContainerTransform();

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
      const stars = StarManager.calculateStars(this.stage.stageIndex, this.livesEverLost, this.state.timeRemainingMs);
      StarManager.saveStars(this.stage.stageIndex, stars);
      StageManager.recordComplete(this.stage.stageIndex);
      this.ctx.audio.playVictory();
      this.resultOverlay.show(true, stars);
    } else {
      this.startCurrentTarget();
    }
  }

  private onTimeUp(): void {
    this.livesEverLost = true;
    const lostIdx = this.lives - 1; // 0-based index of the heart being lost
    this.lives--;
    const livesSnapshot = this.lives;
    this.header.triggerHeartLost(lostIdx, () => this.header.updateLives(livesSnapshot));
    if (this.lives > 0) {
      this.retryStage();
    } else {
      // Freeze the game loop before triggering the rewarded-ad / game-over flow.
      this.state.isGameEnd = true;
      this.selectedIndex   = -1;
      this.gridLayer.hideSelection();
      this.tryExtraLife();
    }
  }

  /**
   * Attempt to grant one extra life via a rewarded ad.
   * Limited to one attempt per stage load — once used the flag is never
   * reset within the same attempt, preventing infinite chaining.
   * If the platform doesn't support rewarded ads, or the player declines /
   * the ad errors, the normal game-over overlay is shown instead.
   */
  private _extraLifeUsed = false;

  private tryExtraLife(): void {
    if (this._extraLifeUsed || !this.ctx.platform) {
      this.ctx.audio.playGameOver();
      this.resultOverlay.show(false);
      return;
    }
    this._extraLifeUsed = true;

    this.ctx.platform.requestExtraLife().then((watched) => {
      if (watched) {
        // Grant one extra life and resume.
        // livesEverLost is already true, so the star penalty stays in effect.
        this.lives = 1;
        this.header.updateLives(this.lives);
        this.state.isGameEnd = false;
        this.retryStage();
      } else {
        this.ctx.audio.playGameOver();
        this.resultOverlay.show(false);
      }
    });
  }

  private retryStageAfterGameOver(): void {
    this.lives = 3;
    this._extraLifeUsed = false;
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

    this.ctx.audio.playClick();

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
    this.effectLayer.playEffect(idxA, isCombo, this.comboCount);
    this.effectLayer.playEffect(idxB, isCombo, this.comboCount);

    this.logic.removeNumber(idxA);
    this.logic.removeNumber(idxB);
    this.selectedIndex = -1;

    // Bonus seconds: 1st (+2 s), 2nd consecutive (+3 s), 3rd+ (+4 s cap)
    const bonusSec = this.comboCount === 1 ? 2
                   : this.comboCount === 2 ? 3
                   :                         4;

    this.state.addTime(bonusSec * 1000);
    this.ctx.audio.playAddTime();

    // Flying bonus animation — bursts from the centre of the last-tapped cell (idxB).
    // indexToPos() returns coordinates in gameContainer local space; transform to
    // scene space so the label travels correctly to the clock (which is in scene space).
    const half  = this.screen.gridSize / 2;
    const posB  = this.screen.indexToPos(idxB);
    const startX = this.gameContainer.x + (posB.x + half) * this.gameContainerScale;
    const startY = this.gameContainer.y + (posB.y + half) * this.gameContainerScale;

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

  // ── gameContainer transform ────────────────────────────────────────────

  /**
   * Scale and position gameContainer so that the locked play area fits within
   * the current screen while preserving its aspect ratio.
   *
   * When the layout is not locked (scene just built, game not yet started)
   * the container sits at (0, 0) with scale 1 — the normal state.
   *
   * After lock the play area (everything below the header) is scaled to fill
   * as much of screen.height − OFFSET_Y as possible.  The container is
   * shifted horizontally to remain centered and vertically so that the cell
   * rows (which have OFFSET_Y baked into their y-coordinates) still start
   * immediately below the header.
   *
   *   s = min( screen.width  / lockedLogicalW,
   *            (screen.height − OFFSET_Y) / (lockedLogicalH − OFFSET_Y) )
   *
   *   gameContainer.x = (screen.width − lockedLogicalW · s) / 2
   *   gameContainer.y = OFFSET_Y · (1 − s)   // cancels the scaled offsetY
   */
  private updateGameContainerTransform(): void {
    if (!this.screen.isLocked) {
      this.gameContainerScale = 1;
      this.gameContainer.scale.set(1);
      this.gameContainer.x = 0;
      this.gameContainer.y = 0;
      return;
    }

    const { width, height, offsetY, lockedLogicalW, lockedLogicalH } = this.screen;
    const availH     = height - offsetY;
    const lockedPlayH = lockedLogicalH - offsetY;

    const s = Math.min(width / lockedLogicalW, availH / lockedPlayH);

    this.gameContainerScale = s;
    this.gameContainer.scale.set(s);
    this.gameContainer.x = (width - lockedLogicalW * s) / 2;
    // Grid cells have offsetY baked into their y; after scaling that becomes
    // offsetY * s.  Shift the container up by the difference so cells stay
    // flush below the header.
    this.gameContainer.y = offsetY * (1 - s);
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
