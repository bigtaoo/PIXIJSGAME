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

/**
 * GameScene 负责单个关卡（StageData）的完整流程：
 *
 *   ┌─ 关卡开始 ─────────────────────────────────────────────────────┐
 *   │  lives = 3，timePool = 0，currentTargetIdx = 0               │
 *   │                                                               │
 *   │  startCurrentTarget()                                        │
 *   │    addTime(30_000)  — 每个目标 +30 秒                         │
 *   │    初始化棋盘                                                  │
 *   │                                                               │
 *   │  玩家消除所有格子 → onTargetCleared()                          │
 *   │    还有下一个目标 → startCurrentTarget()（循环）               │
 *   │    全部通关       → show(win) → onStageComplete 回调          │
 *   │                                                               │
 *   │  时间耗尽 → lives--                                           │
 *   │    lives > 0 → retryStage()（重置 time/idx，重新开始本关）     │
 *   │    lives = 0 → show(fail) → retry / 大厅                     │
 *   └──────────────────────────────────────────────────────────────┘
 */
export class GameScene extends PIXI.Container {
  private readonly screen: ScreenConfig;
  private readonly state: GameState;
  private readonly logic: Logic;

  private gridLayer!: Grid;
  private numberLayer!: NumberLayer;
  private effectLayer!: EffectManager;
  private header!: Header;
  private resultOverlay!: GameResultOverlay;
  private settingsOverlay!: SettingsOverlay;

  // ── 关卡运行时状态 ──────────────────────────────────────────────────
  private currentTargetIdx = 0;
  private lives = 3;
  private selectedIndex = -1;
  private initialized = false;

  constructor(
    private readonly ctx: AppContext,
    private readonly stage: StageData,
    private readonly onStageComplete: () => void,
    private readonly onGoLobby: () => void,
  ) {
    super();
    this.screen = new ScreenConfig();
    this.screen.setGridDims(stage.gridW, stage.gridH);
    this.state = new GameState();
    this.logic = new Logic();
  }

  // ── 公开接口 ──────────────────────────────────────────────────────

  public resize(windowWidth: number, windowHeight: number): void {
    this.screen.update(windowWidth, windowHeight);

    if (!this.initialized) {
      this.buildScene();
      this.initialized = true;
    }

    const { width, height, scale } = this.screen;
    this.x = (windowWidth - width * scale) / 2;
    this.y = (windowHeight - height * scale) / 2;
    this.scale.set(scale);
  }

  public update(deltaMs: number): void {
    if (!this.initialized) return;

    this.effectLayer.update(deltaMs);

    if (this.state.isGameEnd || this.state.isPause) return;

    this.state.tick(deltaMs);
    this.header.updateTime(this.state.remainingSeconds);

    if (this.state.isTimeUp) {
      this.onTimeUp();
    }
  }

  // ── 场景构建 ────────────────────────────────────────────────────────

  private buildScene(): void {
    const bg = new PIXI.Sprite(this.ctx.assets.GetTexture('background.png'));
    bg.width = this.screen.width;
    bg.height = this.screen.height;
    this.addChild(bg);

    const firstTarget = this.stage.targets[0];

    this.gridLayer = new Grid(this.ctx, this.screen, (idx) => this.onCellClick(idx));
    this.numberLayer = new NumberLayer(this.ctx, this.screen);
    this.effectLayer = new EffectManager(this.ctx, this.screen);
    this.header = new Header(this.ctx, this.screen, firstTarget, () => this.openSettings());

    this.resultOverlay = new GameResultOverlay(
      this.ctx,
      () => this.retryStageAfterGameOver(), // 失败后重试（重置命数）
      () => this.onStageComplete(),           // 胜利后进入下一关
      () => this.onGoLobby(),                 // 返回大厅
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

    // 开始第一个目标（不经过 resize 后的再次调用）
    this.startCurrentTarget();
  }

  // ── 目标流程 ────────────────────────────────────────────────────────

  /**
   * 启动 currentTargetIdx 对应的目标：
   *   1. 向时间池注入 30 秒
   *   2. 更新 Header 提示
   *   3. 重新生成棋盘
   */
  private startCurrentTarget(): void {
    const target = this.stage.targets[this.currentTargetIdx];

    this.state.isGameEnd = false;
    this.state.addTime(30_000);   // 每个目标 +30 秒

    this.logic.initialize(this.screen, target);
    this.header.updateTarget(target);
    this.gridLayer.reset();
    this.numberLayer.reset(this.logic);

    this.selectedIndex = -1;
    this.gridLayer.hideSelection();
  }

  /** 当前目标全部消除后调用 */
  private onTargetCleared(): void {
    this.currentTargetIdx++;
    if (this.currentTargetIdx >= this.stage.targets.length) {
      // 本关所有目标完成
      this.state.isGameEnd = true;
      this.selectedIndex = -1;
      this.gridLayer.hideSelection();
      this.resultOverlay.show(true);
    } else {
      // 无缝进入下一个目标
      this.startCurrentTarget();
    }
  }

  /** 时间耗尽时调用 */
  private onTimeUp(): void {
    this.lives--;
    this.header.updateLives(this.lives);
    if (this.lives > 0) {
      // 还有命：重置时间与进度，从本关第一个目标重来
      this.retryStage();
    } else {
      // 命数耗尽：显示失败浮层
      this.state.isGameEnd = true;
      this.selectedIndex = -1;
      this.gridLayer.hideSelection();
      this.resultOverlay.show(false);
    }
  }

  /**
   * 命数耗尽后玩家选择"重试"时调用。
   * 重置命数（3条）并重开本关。
   */
  private retryStageAfterGameOver(): void {
    this.lives = 3;
    this.header.updateLives(this.lives);
    this.resultOverlay.hide();
    this.retryStage();
  }

  /**
   * 丢失一条命后的内部重置：
   * 时间池归零，从第 0 个目标重新开始，棋盘重置。
   */
  private retryStage(): void {
    this.currentTargetIdx = 0;
    this.state.reset();       // timeRemainingMs = 0, isGameEnd = false
    this.resultOverlay.hide();
    this.startCurrentTarget();
  }

  // ── 格子点击 ────────────────────────────────────────────────────────

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

    const a = this.logic.getNumberByIndex(this.selectedIndex);
    const b = this.logic.getNumberByIndex(index);
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
    this.state.addTime(1_000);  // 消除奖励 +1 秒

    if (this.logic.isAllRemoved()) {
      this.onTargetCleared();
    }
  }

  // ── 设置/暂停 ────────────────────────────────────────────────────────

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
