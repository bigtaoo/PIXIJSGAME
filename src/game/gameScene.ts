import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { GameState } from './gameState';
import { Logic } from './logic';
import { Grid } from './grid'; // also provides Grid.tierForValue()
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

  /** Full-screen edge glow shown on combo >= 3 (programmatic vignette). */
  private comboVignette!: PIXI.Graphics;
  /** Tracks vignette fade state: alpha 0-1, decays in update(). */
  private vignetteAlpha = 0;
  /** Combo colour used for the current vignette (gold or green). */
  private vignetteColor = 0xffd700;

  /** Callback invoked when the sub-target celebration finishes. null = not celebrating. */
  private _celebrationDone: (() => void) | null = null;
  /** Elapsed ms since the celebration started. */
  private _celebrationElapsed = 0;
  private static readonly CELEBRATION_DURATION_MS = 1800;

  /** Screen-shake state (programmatic scene offset; cross-platform). */
  private _shakeMs = 0;
  private _shakeDuration = 0;
  private _shakeMag = 0;

  /** How many ms have elapsed since the player selected the first tile. -1 = inactive. */
  private hintTimerMs = -1;
  /** Threshold for the next hint fire: HINT_DELAY_MS on first fire, HINT_REPEAT_MS afterwards. */
  private hintThreshold = 0;

  private static readonly COMBO_WINDOW_MS = 3000;
  /** Initial delay before the first hint flash after a cell is selected. */
  private static readonly HINT_DELAY_MS = 3000;
  /** Repeat interval for subsequent hint flashes if the player still hasn't acted. */
  private static readonly HINT_REPEAT_MS = 2000;

  /**
   * True if at least one life was lost during the current stage attempt.
   * Persists across retryStageAfterGameOver so a player who used all 3 lives
   * cannot earn 2 or 3 stars even after retrying.
   */
  private livesEverLost = false;

  constructor(
    private readonly ctx: AppContext,
    private readonly onStageComplete: (completedStage: StageData) => void,
    private readonly onGoLobby: () => void
  ) {
    super();
    this.screen = new ScreenConfig();
    this.state = new GameState();
    this.logic = new Logic();
  }

  // -- Public API -------------------------------------------------------------

  /**
   * Safety-net: re-persist win progress if the stage was completed but for
   * some reason the saves in onTargetCleared() were not committed (e.g. an
   * exception was thrown after removeNumber but before recordComplete, or the
   * call order was disrupted by an unusual platform event).
   *
   * Safe to call multiple times -- StarManager.saveStars and
   * StageManager.recordComplete are both idempotent.
   */
  public persistWinIfComplete(): void {
    if (!this.initialized) return;
    if (!this.state.isGameEnd) return;
    if (this.currentTargetIdx < this.stage.targets.length) return;

    const stars = StarManager.calculateStars(
      this.stage.stageIndex,
      this.livesEverLost,
      this.state.timeRemainingMs
    );
    StarManager.saveStars(this.stage.stageIndex, stars);
    StageManager.recordComplete(this.stage.stageIndex);
  }

  public loadStage(stage: StageData, windowWidth: number, windowHeight: number): void {
    this.stage = stage;
    // Sync the screen config to the current window dimensions BEFORE
    // startCurrentTarget() locks the layout. The lobby does not forward resize
    // events to the hidden game scene, so without this the freshly entered
    // stage would be laid out (and locked) using the orientation from the
    // previous game session, showing the wrong orientation on first entry.
    this.screen.update(windowWidth, windowHeight);
    this.screen.setGridDims(stage.gridW, stage.gridH);

    this.lives = 3;
    this.currentTargetIdx = 0;
    this.livesEverLost = false;
    this._extraLifeUsed = false;
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
      this.redrawVignette(this.screen.width, this.screen.height);

      if (this.screen.isLocked) {
        // Layout is locked (game in progress) -- do NOT reconfigure the grid.
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
    // Cell bounce + idle shimmer
    this.gridLayer.update(deltaMs);
    // Star reveal animation (runs whenever the result overlay is visible)
    if (this.resultOverlay.visible) this.resultOverlay.update(deltaMs);

    // Fade out combo vignette (~400ms)
    if (this.vignetteAlpha > 0) {
      this.vignetteAlpha = Math.max(0, this.vignetteAlpha - deltaMs / 400);
      this.comboVignette.alpha = this.vignetteAlpha;
    }

    this.updateShake(deltaMs);

    // Tick celebration timer while paused
    if (this._celebrationDone) {
      this._celebrationElapsed += deltaMs;
      if (this._celebrationElapsed >= GameScene.CELEBRATION_DURATION_MS) {
        const done = this._celebrationDone;
        this._celebrationDone = null;
        this._celebrationElapsed = 0;
        this.state.isPause = false;
        done();
      }
    }

    if (this.state.isGameEnd || this.state.isPause) return;

    this.gameTimeMs += deltaMs;

    this.state.tick(deltaMs);
    this.header.updateTime(this.state.remainingSeconds);

    if (this.state.isTimeUp) {
      this.onTimeUp();
    }

    // -- Hint timer -----------------------------------------------------------
    if (this.hintTimerMs >= 0) {
      this.hintTimerMs += deltaMs;
      if (this.hintTimerMs >= this.hintThreshold) {
        this.triggerHint();
        // Reset timer for the next repeat cycle (2 s) without clearing the hint state.
        this.hintTimerMs = 0;
        this.hintThreshold = GameScene.HINT_REPEAT_MS;
      }
    }
  }

  // -- Scene construction -----------------------------------------------------

  private buildScene(): void {
    this.bg = new PIXI.Graphics();
    drawBackground(this.bg, this.screen.width, this.screen.height);
    this.addChild(this.bg);
    this.buildBackgroundDecos();

    this.comboVignette = new PIXI.Graphics();
    this.comboVignette.alpha = 0;
    this.comboVignette.interactiveChildren = false;
    this.redrawVignette(this.screen.width, this.screen.height);

    const audio = this.ctx.audio;

    this.gridLayer = new Grid(this.ctx, this.screen, (idx) => this.onCellClick(idx));
    this.numberLayer = new NumberLayer(this.ctx, this.screen);
    this.effectLayer = new EffectManager(this.ctx, this.screen);
    this.header = new Header(this.ctx, this.screen, this.stage.targets[0], () => {
      audio.playClick();
      this.openSettings();
    });

    this.resultOverlay = new GameResultOverlay(
      this.ctx,
      () => {
        audio.playClick();
        this.retryStageAfterGameOver();
      },
      () => {
        audio.playClick();
        this.onStageComplete(this.stage);
      },
      () => {
        audio.playClick();
        this.onGoLobby();
      }
    );
    this.settingsOverlay = new SettingsOverlay(
      this.ctx,
      () => {
        audio.playClick();
        this.resumeGame();
      },
      () => {
        audio.playClick();
        this.onGoLobby();
      }
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
    this.addChild(this.comboVignette);
    this.addChild(this.resultOverlay);
    this.addChild(this.settingsOverlay);

    // Apply the real screen dimensions now that the scene is fully built.
    // Without this, overlays would use the hardcoded constructor defaults until
    // the next external resize() call (which only hits the else-branch).
    this.resultOverlay.resize(this.screen);
    this.settingsOverlay.resize(this.screen);

    this.startCurrentTarget();
  }

  // -- Target flow ------------------------------------------------------------

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

    // Colour cells by number tier (small=blue / mid=cream / large=coral)
    const { gridCountW: w, gridCountH: h } = this.screen;
    for (let col = 0; col < w; col++) {
      for (let row = 0; row < h; row++) {
        const idx = this.screen.cellIndex(col, row);
        const val = this.logic.getNumberByIndex(idx);
        if (val > 0) {
          this.gridLayer.setCellTier(idx, Grid.tierForValue(val, target));
        }
      }
    }

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
      // All targets cleared -- persist progress and star rating immediately,
      // so the lobby reflects the new unlock even if the player taps "lobby"
      // instead of "next".
      this.state.isGameEnd = true;
      this.selectedIndex = -1;
      this.gridLayer.hideSelection();
      const stars = StarManager.calculateStars(
        this.stage.stageIndex,
        this.livesEverLost,
        this.state.timeRemainingMs
      );
      StarManager.saveStars(this.stage.stageIndex, stars);
      StageManager.recordComplete(this.stage.stageIndex);
      this.ctx.audio.playVictory();
      this.resultOverlay.show(true, stars);
    } else {
      this.showTargetClearCelebration(() => this.startCurrentTarget());
    }
  }

  /**
   * Sub-target cleared celebration.
   *
   * Instead of spraying ~50 identical max-combo bursts as uniform noise, the
   * show is choreographed in two tiers over CELEBRATION_DURATION_MS:
   *
   *  - FOCUS bursts (combo×3, ~19 particles each + ripple + glow): the "stars".
   *    Clustered near the centre and front-loaded for a strong opening punch.
   *  - AMBIENT bursts (plain, ~11 particles each): fill the grid as an outward
   *    shockwave — trigger time grows with each cell's distance from centre, so
   *    the celebration reads as centre → edges rather than random static.
   *
   * Total ≈ FOCUS + AMBIENT bursts (fewer particles than the old flat 50×combo),
   * giving more visual layering at a lower peak particle count.
   */
  private static readonly CELEBRATION_FOCUS_BURSTS = 10; // focus tier (combo×3)
  private static readonly CELEBRATION_OPENING_BURSTS = 4; // focus subset fired together as the opening punch
  private static readonly CELEBRATION_AMBIENT_BURSTS = 34; // ambient shockwave tier (plain)
  private static readonly CELEBRATION_FINALE_BURSTS = 6; // dense closing cluster near centre

  private showTargetClearCelebration(onDone: () => void): void {
    this.state.isPause = true;
    this._celebrationElapsed = 0;
    this._celebrationDone = onDone;
    // Opening punch: a short screen shake synced with the opening salvo below.
    this.triggerShake(this.screen.gridSize * 0.2, 350);

    const cols = this.screen.gridCountW;
    const rows = this.screen.gridCountH;
    const SPREAD_MS = GameScene.CELEBRATION_DURATION_MS - 300;

    const ccol = (cols - 1) / 2;
    const crow = (rows - 1) / 2;
    const maxDist = Math.hypot(ccol, crow) || 1;
    const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

    interface Shot {
      t: number;
      idx: number;
      focus: boolean;
    }
    const schedule: Shot[] = [];

    // Tier 1 — focus bursts near centre. The first OPENING_BURSTS fire together
    // (0–120 ms) as a single opening punch / peak; the rest spread through the
    // first half.
    for (let i = 0; i < GameScene.CELEBRATION_FOCUS_BURSTS; i++) {
      const col = clamp(Math.round(ccol + (Math.random() - 0.5) * cols * 0.5), 0, cols - 1);
      const row = clamp(Math.round(crow + (Math.random() - 0.5) * rows * 0.5), 0, rows - 1);
      const t =
        i < GameScene.CELEBRATION_OPENING_BURSTS
          ? Math.random() * 120
          : 120 + Math.random() * SPREAD_MS * 0.45;
      schedule.push({ t, idx: this.screen.cellIndex(col, row), focus: true });
    }

    // Tier 2 — ambient shockwave: trigger time grows with distance from centre,
    // capped before the finale window so the tail stays clear.
    for (let i = 0; i < GameScene.CELEBRATION_AMBIENT_BURSTS; i++) {
      const col = Math.floor(Math.random() * cols);
      const row = Math.floor(Math.random() * rows);
      const dist = Math.hypot(col - ccol, row - crow) / maxDist; // 0..1
      const jitter = (Math.random() - 0.5) * SPREAD_MS * 0.2;
      schedule.push({
        t: clamp(dist * SPREAD_MS * 0.8 + jitter, 0, SPREAD_MS * 0.82),
        idx: this.screen.cellIndex(col, row),
        focus: false,
      });
    }

    // Tier 3 — finale: a tight cluster near centre in the last ~18 % to close
    // the show with a clear punctuation (the first one is a big focus burst).
    for (let i = 0; i < GameScene.CELEBRATION_FINALE_BURSTS; i++) {
      const col = clamp(Math.round(ccol + (Math.random() - 0.5) * cols * 0.4), 0, cols - 1);
      const row = clamp(Math.round(crow + (Math.random() - 0.5) * rows * 0.4), 0, rows - 1);
      schedule.push({
        t: SPREAD_MS * 0.82 + Math.random() * SPREAD_MS * 0.18,
        idx: this.screen.cellIndex(col, row),
        focus: i === 0,
      });
    }

    schedule.sort((a, b) => a.t - b.t);

    let elapsed = 0;
    let next = 0;
    const fireFn = (): void => {
      elapsed += PIXI.Ticker.shared.elapsedMS;
      while (next < schedule.length && schedule[next].t <= elapsed) {
        const shot = schedule[next];
        if (shot.focus) {
          this.effectLayer.playEffect(shot.idx, true, 3, 1.5); // center focus +50%
        } else {
          this.effectLayer.playEffect(shot.idx, false, 1, 1.3); // ambient +30%
        }
        next++;
      }
      if (next >= schedule.length) {
        PIXI.Ticker.shared.remove(fireFn);
      }
    };
    PIXI.Ticker.shared.add(fireFn);
  }

  /** Trigger a decaying screen shake by offsetting the scene container. */
  private triggerShake(magnitude: number, durationMs: number): void {
    this._shakeMag = magnitude;
    this._shakeDuration = durationMs;
    this._shakeMs = 0;
  }

  /** Advance the active shake; offsets this.x/y with random jitter that decays to 0. */
  private updateShake(deltaMs: number): void {
    if (this._shakeDuration <= 0) return;
    this._shakeMs += deltaMs;
    const k = 1 - this._shakeMs / this._shakeDuration;
    if (k <= 0) {
      this._shakeDuration = 0;
      this.x = 0;
      this.y = 0;
      return;
    }
    const m = this._shakeMag * k;
    this.x = (Math.random() * 2 - 1) * m;
    this.y = (Math.random() * 2 - 1) * m;
  }

  private onTimeUp(): void {
    this.livesEverLost = true;
    const lostIdx = this.lives - 1; // 0-based index of the heart being lost
    this.lives--;
    const livesSnapshot = this.lives;
    this.header.triggerHeartLost(lostIdx, () => this.header.updateLives(livesSnapshot));
    if (this.lives > 0) {
      // Keep the board intact -- just clear the selection and refill the time
      // pool so the player continues from exactly where they were.
      this.selectedIndex = -1;
      this.gridLayer.hideSelection();
      this.header.resetTip();
      this.resetHintTimer();
      this.state.addTime(30_000);
    } else {
      // Freeze the game loop before triggering the rewarded-ad / game-over flow.
      this.state.isGameEnd = true;
      this.selectedIndex = -1;
      this.gridLayer.hideSelection();
      this.tryExtraLife();
    }
  }

  /**
   * Attempt to grant one extra life via a rewarded ad.
   * Limited to one attempt per stage load -- once used the flag is never
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
        // Grant one extra life and resume from the current board state.
        // livesEverLost is already true, so the star penalty stays in effect.
        this.lives = 1;
        this.header.updateLives(this.lives);
        this.state.isGameEnd = false;
        this.selectedIndex = -1;
        this.gridLayer.hideSelection();
        this.header.resetTip();
        this.resetHintTimer();
        this.state.addTime(30_000);
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

  // -- Cell click -------------------------------------------------------------

  private onCellClick(index: number): void {
    if (this.state.isGameEnd || this.state.isPause) return;

    if (this.logic.getNumberByIndex(index) === 0) return;

    this.ctx.audio.playClick();

    if (this.selectedIndex === -1) {
      // First selection -- start the hint countdown
      this.selectedIndex = index;
      this.gridLayer.showSelection(index);
      this.header.setFirstSelected(this.logic.getNumberByIndex(index));
      this.startHintTimer();
      return;
    }

    if (this.selectedIndex === index) {
      // Tap the same cell again -> deselect
      this.selectedIndex = -1;
      this.gridLayer.hideSelection();
      this.header.resetTip();
      this.resetHintTimer();
      return;
    }

    const a = this.logic.getNumberByIndex(this.selectedIndex);
    const b = this.logic.getNumberByIndex(index);
    const target = this.stage.targets[this.currentTargetIdx];

    if (a + b === target) {
      this.eliminatePair(this.selectedIndex, index, a, b);
    } else {
      // Wrong second choice -- switch selection to the newly tapped cell
      this.selectedIndex = index;
      this.gridLayer.showSelection(index);
      this.header.setFirstSelected(b);
      this.startHintTimer(); // restart countdown for the new selection
    }
  }

  private eliminatePair(idxA: number, idxB: number, a: number, b: number): void {
    this.resetHintTimer(); // pair found -- cancel any pending hint
    this.header.showMatchResult(a, b);
    this.gridLayer.hideSelection();
    this.gridLayer.hideCell(idxA);
    this.gridLayer.hideCell(idxB);
    this.numberLayer.hideNumber(idxA);
    this.numberLayer.hideNumber(idxB);

    // -- Combo logic (computed before effects so isCombo is available) --------
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

    if (this.comboCount >= 3) {
      this.triggerComboVignette(this.comboCount);
    }

    this.logic.removeNumber(idxA);
    this.logic.removeNumber(idxB);
    this.selectedIndex = -1;

    // Bonus seconds: 1st (+2 s), 2nd consecutive (+3 s), 3rd+ (+4 s cap)
    const bonusSec = this.comboCount === 1 ? 2 : this.comboCount === 2 ? 3 : 4;

    this.state.addTime(bonusSec * 1000);
    this.ctx.audio.playAddTime();

    // Flying bonus animation -- bursts from the centre of the last-tapped cell (idxB).
    // indexToPos() returns coordinates in gameContainer local space; transform to
    // scene space so the label travels correctly to the clock (which is in scene space).
    const half = this.screen.gridSize / 2;
    const posB = this.screen.indexToPos(idxB);
    const startX = this.gameContainer.x + (posB.x + half) * this.gameContainerScale;
    const startY = this.gameContainer.y + (posB.y + half) * this.gameContainerScale;

    const clockPos = this.header.getClockCenter();

    this.effectLayer.playFlyingBonus(
      startX,
      startY,
      clockPos.x,
      clockPos.y,
      bonusSec,
      isCombo,
      () => this.header.triggerClockBounce()
    );

    if (this.logic.isAllRemoved()) {
      this.onTargetCleared();
    }
  }

  // -- Hint system ------------------------------------------------------------

  private resetHintTimer(): void {
    this.hintTimerMs = -1;
    this.hintThreshold = GameScene.HINT_DELAY_MS;
  }

  private startHintTimer(): void {
    this.hintTimerMs = 0;
    this.hintThreshold = GameScene.HINT_DELAY_MS;
  }

  private triggerHint(): void {
    if (this.selectedIndex === -1) return;

    const selectedValue = this.logic.getNumberByIndex(this.selectedIndex);
    const target = this.stage.targets[this.currentTargetIdx];
    const pairIndices = this.logic.findPairIndices(selectedValue, target);

    if (pairIndices.length > 0) {
      this.numberLayer.flashHint(pairIndices);
    }
  }

  // -- gameContainer transform -----------------------------------------------

  /**
   * Scale and position gameContainer so that the locked play area fits within
   * the current screen while preserving its aspect ratio.
   *
   * When the layout is not locked (scene just built, game not yet started)
   * the container sits at (0, 0) with scale 1 -- the normal state.
   *
   * After lock the play area (everything below the header) is scaled to fill
   * as much of screen.height - OFFSET_Y as possible.  The container is
   * shifted horizontally to remain centered and vertically so that the cell
   * rows (which have OFFSET_Y baked into their y-coordinates) still start
   * immediately below the header.
   *
   *   s = min( screen.width  / lockedLogicalW,
   *            (screen.height - OFFSET_Y) / (lockedLogicalH - OFFSET_Y) )
   *
   *   gameContainer.x = (screen.width - lockedLogicalW * s) / 2
   *   gameContainer.y = OFFSET_Y * (1 - s)   // cancels the scaled offsetY
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
    const availH = height - offsetY;
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

  // -- Background decorations ------------------------------------------------

  private buildBackgroundDecos(): void {
    const w = this.screen.width;
    const h = this.screen.height;
    const ALPHA = 0.35;
    // [key, anchorX, anchorY, x, y, rotation_deg, scale]
    const configs: Array<[string, number, number, number, number, number, number]> = [
      // corners
      ['deco_pencil.png', 0, 0, w * 0.02, h * 0.03, 15, 1.0],
      ['deco_eraser.png', 1, 0, w * 0.94 - 100, h * 0.04, -10, 1.0],
      ['deco_paperclip.png', 1, 1, w * 0.93 - 100, h * 0.95, 20, 1.0],
      ['deco_pencil.png', 0, 1, w * 0.03, h * 0.95, -20, 1.0],
      // left / right mid-edge
      ['deco_paperclip.png', 0, 0.5, w * 0.01, h * 0.48, 85, 0.8],
      ['deco_eraser.png', 1, 0.5, w * 0.95 - 100, h * 0.52, -80, 0.75],
      // extra corner accents
      ['deco_paperclip.png', 0, 0, w * 0.04, h * 0.12, -30, 0.7],
      ['deco_pencil.png', 1, 1, w * 0.92 - 100, h * 0.88, 10, 0.7],
    ];
    for (const [key, ax, ay, x, y, deg, sc] of configs) {
      let tex: PIXI.Texture | null = null;
      try {
        tex = this.ctx.assets.GetTexture(key);
      } catch {
        /* not yet available */
      }
      if (!tex) continue;
      const spr = new PIXI.Sprite(tex);
      spr.anchor.set(ax, ay);
      spr.x = x;
      spr.y = y;
      spr.rotation = (deg * Math.PI) / 180;
      spr.alpha = ALPHA;
      spr.scale.set(sc);
      this.addChildAt(spr, 1);
    }
  }

  // -- Combo vignette --------------------------------------------------------

  private redrawVignette(w: number, h: number): void {
    const g = this.comboVignette;
    g.clear();
    const depth = Math.round(Math.min(w, h) * 0.18);
    g.lineStyle(0);
    g.beginFill(this.vignetteColor, 0.15);
    g.drawRect(0, 0, w, depth);
    g.drawRect(0, h - depth, w, depth);
    g.drawRect(0, 0, depth, h);
    g.drawRect(w - depth, 0, depth, h);
    g.endFill();
  }

  private triggerComboVignette(comboCount: number): void {
    this.vignetteColor = comboCount >= 4 ? 0x76ff03 : 0xffd700;
    this.redrawVignette(this.screen.width, this.screen.height);
    this.vignetteAlpha = 1;
    this.comboVignette.alpha = 1;
  }

  // Settings / pause

  /** Called when the app loses focus (visibilitychange / wx.onHide). */
  public pauseIfPlaying(): void {
    if (this.state.isGameEnd || this.state.isPause) return;
    this.openSettings();
  }

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
