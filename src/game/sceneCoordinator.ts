import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { GameScene } from './gameScene';
import { LobbyScene } from './lobbyScene';
import { DailyChallengeScene } from './dailyChallengeScene';
import { StageData, STAGES } from './stageConfig';
import { StageManager } from './stageManager';

// ── Transition overlay constants ──────────────────────────────────────────────
/** Alpha at peak of the flash (warm parchment overlay). */
const TRANS_PEAK_ALPHA  = 0.55;
/** Duration of the fade-in phase (ms). */
const TRANS_FADE_IN_MS  = 80;
/** Duration of the fade-out phase (ms). */
const TRANS_FADE_OUT_MS = 150;
/** Warm beige flash colour — matches the parchment theme. */
const TRANS_COLOR       = 0xF5EDD6;

type TransPhase = 'idle' | 'fade_in' | 'fade_out';

/**
 * SceneCoordinator — top-level container that owns scene transitions.
 *
 * Both scenes are created once in the constructor and kept alive for the
 * entire session. Switching scenes is a simple show/hide — no objects are
 * created or destroyed at transition time.
 *
 * Mount rules:
 *   New player  (maxCompleted = 0) -> go straight into Stage 1
 *   Returning player (maxCompleted >= 1) -> show lobby, let player choose
 *
 * Scene switch procedure (with transition overlay):
 *   1. Fade-in the warm overlay (80ms)
 *   2. At peak: hide outgoing scene, show incoming scene + resize
 *   3. Fade-out the overlay (150ms)
 *
 * update / resize are forwarded to the active scene only.
 */
export class SceneCoordinator extends PIXI.Container {
  private readonly lobbyScene:          LobbyScene;
  private readonly gameScene:           GameScene;
  private readonly dailyChallengeScene: DailyChallengeScene;

  private activeScene: LobbyScene | GameScene | DailyChallengeScene | null = null;
  private windowWidth  = 0;
  private windowHeight = 0;
  private started = false;
  /** Skip the interstitial on the very first showGame call (initial load). */
  private firstGameShow = true;
  /**
   * Incremented whenever a navigation away from the game scene occurs
   * (showLobby / showDailyChallenge).  showGame() compares this value after
   * awaiting the interstitial to detect whether the user navigated away during
   * the ad and cancels the transition if so.
   */
  private navGeneration = 0;
  /** True after the first gameplayStart() has been called. Prevents a spurious
   *  gameplayStop() from being sent before gameplay has ever begun. */
  private gameplayStarted = false;

  // ── Transition overlay ────────────────────────────────────────────────────
  private readonly transOverlay: PIXI.Graphics;
  private transPhase:   TransPhase = 'idle';
  private transElapsed  = 0;
  /** Called once at the peak of the overlay (when the scene switch executes). */
  private transSwitchFn: (() => void) | null = null;
  private transSwitchFired = false;

  constructor(private readonly ctx: AppContext) {
    super();

    this.gameScene = new GameScene(
      ctx,
      (completedStage) => this.onStageComplete(completedStage),
      () => this.showLobby(),
    );
    this.lobbyScene = new LobbyScene(
      ctx,
      (stage) => this.showGame(stage),
      () => this.showDailyChallenge(),
    );
    this.dailyChallengeScene = new DailyChallengeScene(
      ctx,
      () => this.showLobby(),
    );

    // Add all scenes to the display tree; visibility controls which is active.
    this.gameScene.visible           = false;
    this.lobbyScene.visible          = false;
    this.dailyChallengeScene.visible = false;
    this.addChild(this.gameScene);
    this.addChild(this.lobbyScene);
    this.addChild(this.dailyChallengeScene);

    // Transition overlay — always on top, initially invisible.
    this.transOverlay = new PIXI.Graphics();
    this.transOverlay.alpha = 0;
    this.transOverlay.interactiveChildren = false;
    this.addChild(this.transOverlay);
  }

  // ── Public API ────────────────────────────────────────────────────

  public resize(w: number, h: number): void {
    this.windowWidth  = w;
    this.windowHeight = h;

    // Resize the overlay to cover the full window.
    this.transOverlay.clear();
    this.transOverlay.beginFill(TRANS_COLOR, 1);
    this.transOverlay.drawRect(0, 0, w, h);
    this.transOverlay.endFill();

    if (!this.started) {
      this.started = true;
      this.start();
    } else {
      this.activeScene?.resize(w, h);
    }
  }

  /** Pause the game if a game scene is currently active and running. */
  public pauseIfPlaying(): void {
    if (this.activeScene instanceof GameScene) {
      this.activeScene.pauseIfPlaying();
    }
  }

  public update(deltaMs: number): void {
    this.updateTransition(deltaMs);

    if (this.activeScene instanceof GameScene) {
      this.activeScene.update(deltaMs);
    } else if (this.activeScene instanceof DailyChallengeScene) {
      this.activeScene.update(deltaMs);
    }
  }

  // ── Transition overlay ────────────────────────────────────────────────────

  /**
   * Begin a scene transition: fade the warm overlay in, fire switchFn at the
   * peak (so the old scene disappears behind the opaque overlay), then fade out.
   * If a transition is already in flight it is allowed to finish first; the new
   * switch fires immediately at the next peak.
   */
  private startTransition(switchFn: () => void): void {
    this.transSwitchFn    = switchFn;
    this.transSwitchFired = false;
    this.transElapsed     = 0;
    this.transPhase       = 'fade_in';
  }

  private updateTransition(deltaMs: number): void {
    if (this.transPhase === 'idle') return;

    this.transElapsed += deltaMs;

    if (this.transPhase === 'fade_in') {
      const t = Math.min(this.transElapsed / TRANS_FADE_IN_MS, 1);
      this.transOverlay.alpha = TRANS_PEAK_ALPHA * t;

      if (!this.transSwitchFired && t >= 1) {
        // Peak reached — execute the scene switch while the overlay is opaque.
        this.transSwitchFired = true;
        this.transSwitchFn?.();
        this.transSwitchFn = null;
        // Begin fade-out.
        this.transPhase   = 'fade_out';
        this.transElapsed = 0;
      }
    } else if (this.transPhase === 'fade_out') {
      const t = Math.min(this.transElapsed / TRANS_FADE_OUT_MS, 1);
      this.transOverlay.alpha = TRANS_PEAK_ALPHA * (1 - t);

      if (t >= 1) {
        this.transOverlay.alpha = 0;
        this.transPhase = 'idle';
      }
    }
  }

  // ── Scene transitions ─────────────────────────────────────────────

  private start(): void {
    if (StageManager.hasCompletedAnyStage()) {
      this.showLobby();
    } else {
      this.showGame(StageManager.getDefaultStage());
    }
  }

  /** Show the stage lobby. Refreshes button states to reflect current progress. */
  public showLobby(): void {
    this.navGeneration++;           // cancel any in-flight showGame() awaiting an ad
    this.gameScene.persistWinIfComplete(); // safety-net: ensure win data is saved
    if (this.gameplayStarted) this.ctx.platform?.gameplayStop();
    this.startTransition(() => {
      this.gameScene.visible           = false;
      this.dailyChallengeScene.visible = false;
      this.lobbyScene.visible          = true;
      this.activeScene                 = this.lobbyScene;
      this.lobbyScene.refresh();
      this.lobbyScene.resize(this.windowWidth, this.windowHeight);
    });
  }

  /** Show the Daily Challenge scene. */
  public showDailyChallenge(): void {
    this.navGeneration++;           // cancel any in-flight showGame() awaiting an ad
    if (this.gameplayStarted) this.ctx.platform?.gameplayStop();
    this.startTransition(() => {
      this.lobbyScene.visible          = false;
      this.gameScene.visible           = false;
      this.dailyChallengeScene.visible = true;
      this.activeScene                 = this.dailyChallengeScene;
      this.dailyChallengeScene.start();
      this.dailyChallengeScene.resize(this.windowWidth, this.windowHeight);
    });
    this.gameplayStarted = true;
    this.ctx.platform?.gameplayStart();
  }

  /**
   * Load and show the game scene for the given stage.
   *
   * On all calls except the very first (initial load) an interstitial ad
   * is requested before the scene becomes visible.  The ad is throttled to
   * at most once every 10 minutes inside `requestInterstitialAd`, so
   * rapid stage transitions are not penalised.
   */
  public async showGame(stage: StageData): Promise<void> {
    if (this.gameplayStarted) this.ctx.platform?.gameplayStop();

    if (this.firstGameShow) {
      this.firstGameShow = false;
    } else {
      // Snapshot the navigation generation before the async gap so we can
      // detect if the player navigated away (lobby / daily challenge) while
      // the interstitial was playing.
      const gen = this.navGeneration;
      await this.ctx.platform?.requestInterstitialAd();
      if (this.navGeneration !== gen) return; // user navigated away during ad
    }

    this.startTransition(() => {
      this.lobbyScene.visible          = false;
      this.dailyChallengeScene.visible = false;
      this.gameScene.visible           = true;
      this.activeScene                 = this.gameScene;
      this.gameScene.loadStage(stage);
      this.gameScene.resize(this.windowWidth, this.windowHeight);
    });
    this.gameplayStarted = true;
    this.ctx.platform?.gameplayStart();
  }

  // ── Stage completion ──────────────────────────────────────────────

  private async onStageComplete(stage: StageData): Promise<void> {
    StageManager.recordComplete(stage.stageIndex);

    // STAGES is 0-indexed; stageIndex is 1-based, so STAGES[stageIndex]
    // is exactly the next stage (or undefined when all stages are done).
    const nextStage = STAGES[stage.stageIndex];
    if (nextStage) {
      await this.showGame(nextStage);
    } else {
      this.showLobby();
    }
  }
}
