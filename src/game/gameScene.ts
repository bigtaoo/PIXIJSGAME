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

/**
 * GameScene 是场景树的唯一所有者。
 *
 * 重构要点：
 * - 所有子节点由本类创建并 addChild，不再委托给外部协调者（原 Display 类）
 * - 点击逻辑、游戏流程控制全部内聚在此
 * - 通过 AppContext 注入依赖，不引用任何全局单例（除 assets/input 基础设施外）
 * - 子节点构造需要屏幕方向信息，因此在首次 resize() 时统一初始化
 */
export class GameScene extends PIXI.Container {
  private readonly ctx: AppContext;
  private readonly screen: ScreenConfig;
  private readonly state: GameState;
  private readonly logic: Logic;

  // 子节点（首次 resize 后初始化）
  private gridLayer!: Grid;
  private numberLayer!: NumberLayer;
  private effectLayer!: EffectManager;
  private header!: Header;
  private resultOverlay!: GameResultOverlay;
  private settingsOverlay!: SettingsOverlay;

  /** 当前选中格子的索引，-1 表示未选中 */
  private selectedIndex = -1;
  private initialized = false;

  constructor(ctx: AppContext, target = 10, initialTimeMs = 30_000) {
    super();
    this.ctx = ctx;
    this.screen = new ScreenConfig();
    this.state = new GameState(target, initialTimeMs);
    this.logic = new Logic();
  }

  // ── 公开接口 ────────────────────────────────────────────────────────

  /**
   * 设置屏幕尺寸并更新 PIXI 变换。
   * 首次调用时完成场景内容的初始化（此时方向信息才确定）。
   */
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

  /** 每帧由 App ticker 调用 */
  public update(deltaMs: number): void {
    if (!this.initialized) return;

    this.effectLayer.update(deltaMs);

    if (this.state.isGameEnd || this.state.isPause) return;

    this.state.tick(deltaMs);
    this.header.updateTime(this.state.remainingSeconds);

    if (this.state.isTimeUp) {
      this.endGame(false);
    }
  }

  // ── 场景构建 ─────────────────────────────────────────────────────────

  private buildScene(): void {
    // 背景
    const bg = new PIXI.Sprite(this.ctx.assets.GetTexture('background.png'));
    bg.width = this.screen.width;
    bg.height = this.screen.height;
    this.addChild(bg);

    // 初始化逻辑层
    this.logic.initialize(this.screen, this.state.target);

    // 游戏层（依赖屏幕方向）
    this.gridLayer = new Grid(this.ctx, this.screen, (idx) => this.onCellClick(idx));
    this.numberLayer = new NumberLayer(this.ctx, this.screen);
    this.numberLayer.draw(this.logic);
    this.effectLayer = new EffectManager(this.ctx, this.screen);
    this.header = new Header(this.ctx, this.screen, this.state.target, () => this.openSettings());

    // 浮层（构造时创建，visible 控制显示，始终存在于场景树中）
    this.resultOverlay = new GameResultOverlay(
      this.ctx,
      () => this.startNewGame(),
      () => this.startNewGame(),
    );
    this.settingsOverlay = new SettingsOverlay(this.ctx, () => this.resumeGame());

    // 按 z 顺序 addChild，所有节点归 GameScene 所有
    this.addChild(this.gridLayer);
    this.addChild(this.numberLayer);
    this.addChild(this.effectLayer);
    this.addChild(this.header);
    this.addChild(this.resultOverlay);
    this.addChild(this.settingsOverlay);
  }

  // ── 游戏逻辑 ─────────────────────────────────────────────────────────

  /**
   * 格子点击处理。
   *
   * Bug 修复：
   * ❶ 忽略已消除格子（原代码未校验，可选中空格子）
   * ❷ 点击已选中格子 → 取消选中（原代码直接 return，高亮残留）
   */
  private onCellClick(index: number): void {
    if (this.state.isGameEnd || this.state.isPause) return;

    // ❶ 忽略已消除的格子
    if (this.logic.getNumberByIndex(index) === 0) return;

    if (this.selectedIndex === -1) {
      // 第一次选中
      this.selectedIndex = index;
      this.gridLayer.showSelection(index);
      return;
    }

    if (this.selectedIndex === index) {
      // ❷ 再次点击同一格子 → 取消选中
      this.selectedIndex = -1;
      this.gridLayer.hideSelection();
      return;
    }

    const a = this.logic.getNumberByIndex(this.selectedIndex);
    const b = this.logic.getNumberByIndex(index);

    if (a + b === this.state.target) {
      this.eliminatePair(this.selectedIndex, index);
    } else {
      // 切换选中到新格子
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
    this.state.addTimeBonus(1_000);

    if (this.logic.isAllRemoved()) {
      this.endGame(true);
    }
  }

  private endGame(win: boolean): void {
    this.state.isGameEnd = true;
    // Bug 修复：结束时清除选中状态
    this.selectedIndex = -1;
    this.gridLayer.hideSelection();
    this.resultOverlay.show(win);
  }

  /**
   * 重置并开始新一局。
   *
   * Bug 修复：原 NewGame 未重置 selectedIndex 和选中高亮
   */
  private startNewGame(): void {
    this.state.reset();
    this.selectedIndex = -1;
    this.logic.initialize(this.screen, this.state.target);
    this.gridLayer.reset();
    this.numberLayer.reset(this.logic);
    this.resultOverlay.hide();
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
