import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { GameScene } from './gameScene';
import { LobbyScene } from './lobbyScene';
import { DailyChallengeScene } from './dailyChallengeScene';
import { StageData, STAGES } from './stageConfig';
import { StageManager } from './stageManager';

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
 * Scene switch procedure:
 *   1. Hide the outgoing scene (visible=false, UIElements deactivate via worldVisible)
 *   2. Show the incoming scene and call its load/refresh method
 *   3. Forward the current window dimensions via resize()
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
  }

  // ── Public API ────────────────────────────────────────────────────

  public resize(w: number, h: number): void {
    this.windowWidth  = w;
    this.windowHeight = h;

    if (!this.started) {
      this.started = true;
      this.start();
    } else {
      this.activeScene?.resize(w, h);
    }
  }

  public update(deltaMs: number): void {
    if (this.activeScene instanceof GameScene) {
      this.activeScene.update(deltaMs);
    } else if (this.activeScene instanceof DailyChallengeScene) {
      this.activeScene.update(deltaMs);
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
    this.ctx.platform?.gameplayStop();
    this.gameScene.visible           = false;
    this.dailyChallengeScene.visible = false;
    this.lobbyScene.visible          = true;
    this.activeScene                 = this.lobbyScene;
    this.lobbyScene.refresh();
    this.lobbyScene.resize(this.windowWidth, this.windowHeight);
  }

  /** Show the Daily Challenge scene. */
  public showDailyChallenge(): void {
    this.navGeneration++;           // cancel any in-flight showGame() awaiting an ad
    this.ctx.platform?.gameplayStop();
    this.lobbyScene.visible          = false;
    this.gameScene.visible           = false;
    this.dailyChallengeScene.visible = true;
    this.activeScene                 = this.dailyChallengeScene;
    this.dailyChallengeScene.start();
    this.dailyChallengeScene.resize(this.windowWidth, this.windowHeight);
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
    this.ctx.platform?.gameplayStop();

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

    this.lobbyScene.visible          = false;
    this.dailyChallengeScene.visible = false;
    this.gameScene.visible           = true;
    this.activeScene                 = this.gameScene;
    this.gameScene.loadStage(stage);
    this.gameScene.resize(this.windowWidth, this.windowHeight);
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
