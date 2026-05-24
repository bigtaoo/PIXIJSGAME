import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { STAGES, StageData } from './stageConfig';
import { StageManager } from './stageManager';
import { StarManager } from './starManager';
import { UIElement } from '../inputSystem/uiElement';
import { GAME_WIDTH, GAME_HEIGHT } from './consts';
import { drawCircleCell, drawCircleCellSelected, makeTexture, C } from './graphicsFactory';
import { getDailyBestScore, getStreakDays } from './dailyChallengeStore';
import { LOBBY_NODE_POSITIONS, DAILY_CHALLENGE_POS } from './lobbyLayout';

/**
 * 关卡大厅 — 探险地图布局
 *
 * 背景图 bg.png（1024×1024）拉伸铺满整个画布（GAME_WIDTH × GAME_HEIGHT）。
 * 19 个关卡节点沿 lobbyLayout.ts 中定义的蜿蜒路径坐标排布。
 * 每日挑战图标固定在地图左侧中部，使用 daily.png。
 *
 * 如需微调位置，只需修改 lobbyLayout.ts 中的坐标，本文件无需改动。
 */
export class LobbyScene extends PIXI.Container {
  private readonly screen: ScreenConfig;

  /** 节点直径（逻辑像素），对应设计规范 100px */
  private static readonly NODE_SIZE = 100;

  /** 每日挑战图标直径（逻辑像素），对应设计规范 130px */
  private static readonly DAILY_SIZE = 130;

  /** 关卡卡片 Sprite，与 STAGES 数组平行，由 refresh() 更新 */
  private stageCards: PIXI.Sprite[] = [];

  /** 每个节点下方的星级文字 */
  private starLabels: PIXI.Text[] = [];

  /** 每日挑战面板文字（refresh 时更新） */
  private dcBestText!: PIXI.Text;
  private dcStreakText!: PIXI.Text;

  /** 普通 / 选中描边 圆形节点纹理 */
  private cardTexture!: PIXI.Texture;
  private cardSelectedTexture!: PIXI.Texture;

  constructor(
    private readonly ctx: AppContext,
    private readonly onSelectStage: (stage: StageData) => void,
    private readonly onDailyChallenge: () => void,
  ) {
    super();
    this.screen = new ScreenConfig();
    this.screen.update(GAME_WIDTH, GAME_HEIGHT);
    this.buildUI();
  }

  // ── Public API ────────────────────────────────────────────────────────

  public resize(windowWidth: number, windowHeight: number): void {
    this.screen.update(windowWidth, windowHeight);
    this.x = 0;
    this.y = 0;
    this.scale.set(this.screen.scale);
  }

  /**
   * 刷新所有节点的视觉状态（已通关 / 当前关 / 未解锁 / 星级）。
   * 不重新构建场景，仅更新现有对象的属性。
   */
  public refresh(): void {
    const maxCompleted = StageManager.getMaxCompleted();

    STAGES.forEach((stage, i) => {
      const card      = this.stageCards[i];
      const starLabel = this.starLabels[i];
      if (!card) return;

      const completed = stage.stageIndex <= maxCompleted;
      const isCurrent = stage.stageIndex === maxCompleted + 1;

      if (isCurrent) {
        card.texture = this.cardSelectedTexture;
        card.tint    = 0xFFFFFF;
        card.alpha   = 1;
      } else if (completed) {
        card.texture = this.cardTexture;
        card.tint    = 0xFFFFFF;
        card.alpha   = 1;
      } else {
        card.texture = this.cardTexture;
        card.tint    = 0x888888;
        card.alpha   = 0.5;
      }

      if (completed || isCurrent) {
        const stars = StarManager.getStars(stage.stageIndex);
        if (stars > 0) {
          starLabel.text    = '★'.repeat(stars) + '☆'.repeat(3 - stars);
          starLabel.visible = true;
        } else {
          starLabel.visible = false;
        }
      } else {
        starLabel.visible = false;
      }
    });

    // 每日挑战统计文字
    if (this.dcBestText) {
      const best = getDailyBestScore();
      this.dcBestText.text  = best > 0 ? `最佳 ${best}` : `最佳 --`;
      this.dcStreakText.text = `${getStreakDays()}天`;
    }
  }

  // ── UI 构建 ──────────────────────────────────────────────────────────

  private buildUI(): void {
    this.buildBackground();
    this.buildAdventureMap();
    this.buildDailyChallenge();
  }

  /**
   * 将 bg.png 拉伸铺满整个画布（GAME_WIDTH × GAME_HEIGHT = 1080 × 1920）。
   */
  private buildBackground(): void {
    const bg = new PIXI.Sprite(this.ctx.assets.GetTexture('lobby_bg.png'));
    bg.width  = GAME_WIDTH;
    bg.height = GAME_HEIGHT;
    bg.x = 0;
    bg.y = 0;
    this.addChild(bg);
  }

  /**
   * 按 lobbyLayout.ts 中定义的坐标，沿蜿蜒路径放置 19 个关卡圆形节点。
   */
  private buildAdventureMap(): void {
    const sz = LobbyScene.NODE_SIZE;
    const r  = sz / 2;

    // 生成节点纹理（普通 / 选中）
    this.cardTexture = makeTexture(
      this.ctx.renderer,
      g => drawCircleCell(g, sz),
      sz,
    );
    this.cardSelectedTexture = makeTexture(
      this.ctx.renderer,
      g => drawCircleCellSelected(g, sz),
      sz,
    );

    STAGES.forEach((stage, i) => {
      const pos = LOBBY_NODE_POSITIONS[i];
      if (!pos) return;

      // 节点左上角坐标（Sprite anchor 默认 (0,0)）
      const nodeX = pos.x - r;
      const nodeY = pos.y - r;

      const card = this.buildStageButton(stage, nodeX, nodeY, sz);
      this.stageCards.push(card);

      // 星级标签（节点正下方）
      const starLabel = new PIXI.Text('', {
        fontFamily: 'Arial',
        fontSize:   20,
        fill:       0xEAB830,
      });
      starLabel.anchor.set(0.5, 0);
      starLabel.x = pos.x;
      starLabel.y = pos.y + r + 4;
      starLabel.visible = false;
      this.addChild(starLabel);
      this.starLabels.push(starLabel);
    });

    this.refresh();
  }

  /**
   * 每日挑战入口图标。
   * 位置来自 lobbyLayout.ts：DAILY_CHALLENGE_POS。
   * 图标使用 daily.png（深琥珀金底，排行榜柱图），直径 130px。
   */
  private buildDailyChallenge(): void {
    const { x, y } = DAILY_CHALLENGE_POS;
    const sz  = LobbyScene.DAILY_SIZE;
    const r   = sz / 2;

    // ── 底色圆形（程序绘制）──────────────────────────────────────────
    const circle = new PIXI.Graphics();
    circle.lineStyle(4, 0x6D4C41, 1);
    circle.beginFill(0xC8862A);
    circle.drawCircle(0, 0, r);
    circle.endFill();
    circle.x = x;
    circle.y = y;
    this.addChild(circle);

    // ── daily.png 图标（居中，70% 缩放填充圆内）─────────────────────
    const icon = new PIXI.Sprite(this.ctx.assets.GetTexture('daily_challenge_icon.png'));
    const targetPx = sz * 0.7;
    const scale    = targetPx / Math.max(icon.texture.width, icon.texture.height);
    icon.width  = icon.texture.width  * scale;
    icon.height = icon.texture.height * scale;
    icon.anchor.set(0.5, 0.5);
    icon.x = x;
    icon.y = y;
    this.addChild(icon);

    // ── "每日挑战" 文字标签（圆正下方）─────────────────────────────
    const title = new PIXI.Text('每日挑战', {
      fontFamily: 'Arial',
      fontSize:   22,
      fontWeight: 'bold',
      fill:       0x5D4037,
      stroke:     0xFFFFFF,
      strokeThickness: 2,
    });
    title.anchor.set(0.5, 0);
    title.x = x;
    title.y = y + r + 8;
    this.addChild(title);

    // ── 今日最佳 & 连续天数（小字，标题下方）────────────────────────
    this.dcBestText = new PIXI.Text('最佳 --', {
      fontFamily: 'Arial', fontSize: 18, fill: 0x5D4037,
    });
    this.dcBestText.anchor.set(0.5, 0);
    this.dcBestText.x = x;
    this.dcBestText.y = y + r + 36;
    this.addChild(this.dcBestText);

    this.dcStreakText = new PIXI.Text('0天', {
      fontFamily: 'Arial', fontSize: 18, fill: 0x5D4037,
    });
    this.dcStreakText.anchor.set(0.5, 0);
    this.dcStreakText.x = x;
    this.dcStreakText.y = y + r + 60;
    this.addChild(this.dcStreakText);

    // ── 点击区域 ─────────────────────────────────────────────────────
    const hit = new PIXI.Sprite(PIXI.Texture.EMPTY);
    hit.width  = sz;
    hit.height = sz;
    hit.x = x - r;
    hit.y = y - r;
    this.addChild(hit);
    this.ctx.input.registerUI(
      new UIElement({ zIndex: 5, sprite: hit, onTap: () => this.onDailyChallenge() }),
    );
  }

  // ── 内部工具方法 ──────────────────────────────────────────────────────

  /** 构建单个关卡节点 Sprite 并注册点击事件。 */
  private buildStageButton(
    stage: StageData,
    x: number,
    y: number,
    size: number,
  ): PIXI.Sprite {
    const card  = new PIXI.Sprite(this.cardTexture);
    card.width  = size;
    card.height = size;
    card.x      = x;
    card.y      = y;
    this.addChild(card);

    this.buildStageNumber(stage.stageIndex, x, y, size);

    this.ctx.input.registerUI(
      new UIElement({
        zIndex: 5,
        sprite: card,
        onTap: () => {
          if (StageManager.isUnlocked(stage.stageIndex)) {
            this.onSelectStage(stage);
          }
        },
      }),
    );

    return card;
  }

  /** 将关卡编号数字精灵居中绘制在节点圆内。 */
  private buildStageNumber(n: number, cardX: number, cardY: number, cardSize: number): void {
    const str    = n.toString();
    const digitW = Math.round(cardSize * 0.38);   // 单个数字宽度
    const digitH = Math.round(cardSize * 0.5);    // 数字高度
    const totalW = str.length * digitW;
    const startX = cardX + (cardSize - totalW) / 2;
    const digitY = cardY + (cardSize - digitH) / 2;

    for (let i = 0; i < str.length; i++) {
      const s  = new PIXI.Sprite(this.ctx.assets.GetTexture(`${str[i]}.png`));
      s.width  = digitW;
      s.height = digitH;
      s.x      = startX + i * digitW;
      s.y      = digitY;
      this.addChild(s);
    }
  }
}
