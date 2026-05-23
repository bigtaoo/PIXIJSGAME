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
    this.gameScene.visible           = false;
    this.dailyChallengeScene.visible = false;
    this.lobbyScene.visible          = true;
    this.activeScene                 = this.lobbyScene;
    this.lobbyScene.refresh();
    this.lobbyScene.resize(this.windowWidth, this.windowHeight);
  }

  /** Show the Daily Challenge scene. */
  public showDailyChallenge(): void {
    this.lobbyScene.visible          = false;
    this.gameScene.visible           = false;
    this.dailyChallengeScene.visible = true;
    this.activeScene                 = this.dailyChallengeScene;
    this.dailyChallengeScene.start();
    this.dailyChallengeScene.resize(this.windowWidth, this.windowHeight);
  }

  /** Load and show the game scene for the given stage. */
  public showGame(stage: StageData): void {
    this.lobbyScene.visible          = false;
    this.dailyChallengeScene.visible = false;
    this.gameScene.visible           = true;
    this.activeScene                 = this.gameScene;
    this.gameScene.loadStage(stage);
    this.gameScene.resize(this.windowWidth, this.windowHeight);
  }

  // ── Stage completion ──────────────────────────────────────────────

  private onStageComplete(stage: StageData): void {
    StageManager.recordComplete(stage.stageIndex);

    // STAGES is 0-indexed; stageIndex is 1-based, so STAGES[stageIndex]
    // is exactly the next stage (or undefined when all stages are done).
    const nextStage = STAGES[stage.stageIndex];
    if (nextStage) {
      this.showGame(nextStage);
    } else {
      this.showLobby();
    }
  }
}
