import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { GameScene } from './gameScene';
import { LobbyScene } from './lobbyScene';
import { StageData, STAGES } from './stageConfig';
import { StageManager } from './stageManager';

/**
 * SceneCoordinator — 场景切换的顶层容器。
 *
 * 挂载规则：
 *   新玩家（maxCompleted = 0）→ 直接进入第 1 关
 *   老玩家（maxCompleted ≥ 1）→ 显示大厅，由玩家选关
 *
 * 切换场景时：
 *   1. 隐藏旧场景（visible=false 使 UIElement 通过 worldVisible 自动失效）
 *   2. 从容器移除旧场景
 *   3. 创建并挂载新场景
 *
 * update / resize 透传给当前活跃场景。
 */
export class SceneCoordinator extends PIXI.Container {
  private currentScene: GameScene | LobbyScene | null = null;
  private windowWidth = 0;
  private windowHeight = 0;
  private started = false;

  constructor(private readonly ctx: AppContext) {
    super();
  }

  // ── 公开接口 ──────────────────────────────────────────────────────

  public resize(w: number, h: number): void {
    this.windowWidth = w;
    this.windowHeight = h;

    if (!this.started) {
      this.started = true;
      this.start();
    } else {
      this.currentScene?.resize(w, h);
    }
  }

  public update(deltaMs: number): void {
    if (this.currentScene instanceof GameScene) {
      this.currentScene.update(deltaMs);
    }
  }

  // ── 场景跳转 ──────────────────────────────────────────────────────

  private start(): void {
    if (StageManager.hasCompletedAnyStage()) {
      this.showLobby();
    } else {
      this.showGame(StageManager.getDefaultStage());
    }
  }

  /** 显示大厅（老玩家选关入口） */
  public showLobby(): void {
    this.disposeCurrentScene();
    const lobby = new LobbyScene(this.ctx, (stage) => this.showGame(stage));
    this.addChild(lobby);
    this.currentScene = lobby;
    lobby.resize(this.windowWidth, this.windowHeight);
  }

  /** 显示指定关卡的游戏场景 */
  public showGame(stage: StageData): void {
    this.disposeCurrentScene();
    const scene = new GameScene(
      this.ctx,
      stage,
      () => this.onStageComplete(stage),  // 通关回调
      () => this.showLobby(),              // 返回大厅回调
    );
    this.addChild(scene);
    this.currentScene = scene;
    scene.resize(this.windowWidth, this.windowHeight);
  }

  // ── 通关处理 ──────────────────────────────────────────────────────

  private onStageComplete(stage: StageData): void {
    StageManager.recordComplete(stage.stageIndex);

    const nextIndex = stage.stageIndex + 1;
    if (nextIndex <= STAGES.length) {
      // 自动进入下一关
      this.showGame(STAGES[nextIndex - 1]);
    } else {
      // 全部通关，回到大厅
      this.showLobby();
    }
  }

  // ── 内部清理 ──────────────────────────────────────────────────────

  /**
   * 安全销毁当前场景：
   *   先设 visible=false（UIElement 通过 worldVisible 立即失效），
   *   再从容器移除。PIXI 对象本身由 GC 回收。
   */
  private disposeCurrentScene(): void {
    if (!this.currentScene) return;
    this.currentScene.visible = false;
    this.removeChild(this.currentScene);
    this.currentScene = null;
  }
}
