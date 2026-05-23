import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { STAGES, StageData } from './stageConfig';
import { StageManager } from './stageManager';
import { UIElement } from '../inputSystem/uiElement';
import { GAME_WIDTH, GAME_HEIGHT } from './consts';

/**
 * 关卡大厅 — 仅在玩家通关第 1 关后显示。
 *
 * 布局：4 列 × 5 行 = 20 格（填入 19 关）
 * 状态着色：
 *   已通关  → 正常色调（tint = 0xffffff）
 *   当前关  → 金色高亮（tint = 0xffd700）
 *   未解锁  → 灰色半透明（tint = 0x888888, alpha = 0.5）
 */
export class LobbyScene extends PIXI.Container {
  private readonly screen: ScreenConfig;

  constructor(
    private readonly ctx: AppContext,
    private readonly onSelectStage: (stage: StageData) => void,
  ) {
    super();
    this.screen = new ScreenConfig();
    // 大厅使用固定逻辑尺寸，不依赖格子配置
    this.screen.update(GAME_WIDTH, GAME_HEIGHT);
    this.buildUI();
  }

  public resize(windowWidth: number, windowHeight: number): void {
    this.screen.update(windowWidth, windowHeight);
    const { scale } = this.screen;
    this.x = (windowWidth - GAME_WIDTH * scale) / 2;
    this.y = (windowHeight - GAME_HEIGHT * scale) / 2;
    this.scale.set(scale);
  }

  // ── 构建 UI ──────────────────────────────────────────────────────────

  private buildUI(): void {
    this.buildBackground();
    this.buildTitle();
    this.buildStageGrid();
  }

  private buildBackground(): void {
    const bg = new PIXI.Sprite(this.ctx.assets.GetTexture('background.png'));
    bg.width = GAME_WIDTH;
    bg.height = GAME_HEIGHT;
    this.addChild(bg);
  }

  /** 顶部标题占位（用 note.png 横幅代替文字） */
  private buildTitle(): void {
    const banner = this.ctx.assets.GetSpriteFromNumberAtlas('note.png');
    banner.width = 800;
    banner.height = 180;
    banner.x = (GAME_WIDTH - 800) / 2;
    banner.y = 60;
    this.addChild(banner);
  }

  /**
   * 4 列 × 5 行的关卡按钮网格。
   * 按钮大小 200×200，间距 40，整体水平居中。
   */
  private buildStageGrid(): void {
    const cols = 4;
    const btnSize = 200;
    const gap = 40;
    const totalW = cols * btnSize + (cols - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2;
    const startY = 310;

    const maxCompleted = StageManager.getMaxCompleted();

    STAGES.forEach((stage, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (btnSize + gap);
      const y = startY + row * (btnSize + gap);

      this.buildStageButton(stage, x, y, btnSize, maxCompleted);
    });
  }

  private buildStageButton(
    stage: StageData,
    x: number,
    y: number,
    size: number,
    maxCompleted: number,
  ): void {
    const unlocked = stage.stageIndex <= maxCompleted + 1;
    const completed = stage.stageIndex <= maxCompleted;
    const isCurrent = stage.stageIndex === maxCompleted + 1;

    // 背景卡片
    const card = this.ctx.assets.GetSpriteFromNumberAtlas('note.png');
    card.width = size;
    card.height = size;
    card.x = x;
    card.y = y;

    if (isCurrent) {
      card.tint = 0xffd700;   // 金色：当前关
    } else if (completed) {
      card.tint = 0xaaffaa;   // 浅绿：已通关
    } else {
      card.tint = 0x888888;   // 灰色：未解锁
      card.alpha = 0.5;
    }
    this.addChild(card);

    // 关卡数字（居中显示在卡片上）
    this.buildStageNumber(stage.stageIndex, x, y, size);

    // 可交互区域（仅解锁关卡注册点击）
    if (unlocked) {
      const capturedStage = stage;
      this.ctx.input.registerUI(
        new UIElement({
          zIndex: 5,
          sprite: card,
          onTap: () => this.onSelectStage(capturedStage),
        }),
      );
    }
  }

  /**
   * 在卡片中央绘制关卡序号（1–19）。
   * 单位数居中，两位数左右各半。
   */
  private buildStageNumber(n: number, cardX: number, cardY: number, cardSize: number): void {
    const str = n.toString();
    const digitW = 70;
    const digitH = 90;
    const totalW = str.length * digitW;
    const startX = cardX + (cardSize - totalW) / 2;
    const digitY = cardY + (cardSize - digitH) / 2;

    for (let i = 0; i < str.length; i++) {
      const d = this.ctx.assets.GetSpriteFromNumberAtlas(`${str[i]}.png`);
      d.width = digitW;
      d.height = digitH;
      d.x = startX + i * digitW;
      d.y = digitY;
      this.addChild(d);
    }
  }
}
