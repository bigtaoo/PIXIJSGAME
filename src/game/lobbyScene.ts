import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { STAGES, StageData } from './stageConfig';
import { StageManager } from './stageManager';
import { StarManager } from './starManager';
import { UIElement } from '../inputSystem/uiElement';
import { GAME_WIDTH } from './consts';
import { drawCircleCell, drawCircleCellSelected, makeTexture, C } from './graphicsFactory';
import { getDailyBestScore, getStreakDays } from './dailyChallengeStore';

/**
 * 关卡大厅。
 *
 * 场景创建一次后全程复用。每次大厅可见时调用 refresh() 刷新各关卡的视觉状态。
 *
 * 布局：4 列 × 5 行 = 20 格（19 关填满）。
 * 节点视觉规则：
 *   已通关  → 暖白底色（无色调）
 *   当前关  → 金色描边卡片（cell_selected 纹理）
 *   未解锁  → 灰色半透明（tint 0x888888，alpha 0.5）
 *
 * TODO: 后期替换为探险小路布局（纵向滚动地图）。
 */
export class LobbyScene extends PIXI.Container {
  private readonly screen: ScreenConfig;

  /** 关卡卡片 Sprite，与 STAGES 数组平行，由 refresh() 更新。 */
  private stageCards: PIXI.Sprite[] = [];

  /** Star labels per stage card (updated by refresh()). */
  private starLabels: PIXI.Text[] = [];

  /** Daily challenge panel texts (updated by refresh()). */
  private dcBestText!:   PIXI.Text;
  private dcStreakText!:  PIXI.Text;

  /** 两种卡片纹理（普通 / 选中描边），在 buildUI 时按 btnSize 生成。 */
  private cardTexture!:         PIXI.Texture;
  private cardSelectedTexture!: PIXI.Texture;

  constructor(
    private readonly ctx: AppContext,
    private readonly onSelectStage: (stage: StageData) => void,
    private readonly onDailyChallenge: () => void,
  ) {
    super();
    this.screen = new ScreenConfig();
    this.screen.update(GAME_WIDTH, GAME_WIDTH * 16 / 9); // default portrait ratio
    this.buildUI();
  }

  // ── Public API ────────────────────────────────────────────────────────

  public resize(windowWidth: number, windowHeight: number): void {
    this.screen.update(windowWidth, windowHeight);
    // Logical canvas fills the window exactly — no centering offset needed.
    this.x = 0;
    this.y = 0;
    this.scale.set(this.screen.scale);
  }

  /**
   * 刷新所有关卡节点的视觉状态。
   * 不新建任何对象，仅修改 tint / alpha / texture / stars。
   */
  public refresh(): void {
    const maxCompleted = StageManager.getMaxCompleted();

    STAGES.forEach((stage, i) => {
      const card      = this.stageCards[i];
      const starLabel = this.starLabels[i];
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

      // Update star display
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

    // Daily challenge panel
    if (this.dcBestText) {
      const best = getDailyBestScore();
      this.dcBestText.text   = best > 0 ? `今日最佳  ${best}` : '今日最佳  --';
      this.dcStreakText.text  = `连续挑战  ${getStreakDays()}  天`;
    }
  }

  // ── UI 构建 ──────────────────────────────────────────────────────────

  private buildUI(): void {
    this.buildBackground();
    this.buildTitle();
    this.buildStageGrid();
    this.buildDailyChallengePanel();
  }

  /** 用 bg.png 图片铺满整个关卡选择场景背景。 */
  private buildBackground(): void {
    const h  = GAME_WIDTH * 16 / 9;
    const bg = new PIXI.Sprite(this.ctx.assets.GetTexture('bg.png'));
    bg.width  = GAME_WIDTH;
    bg.height = h;
    bg.x = 0;
    bg.y = 0;
    this.addChild(bg);
  }

  /**
   * 标题区域：程序绘制的面板条，作为 Logo 占位。
   * 后期可替换为游戏 Logo 图片。
   */
  private buildTitle(): void {
    const W = 800, H = 120;
    const banner = new PIXI.Graphics();
    banner.lineStyle(1.5, 0xE0DAD0, 0.8);
    banner.beginFill(0xFAFAF8);
    banner.drawRoundedRect(0, 0, W, H, 16);
    banner.endFill();
    banner.x = (GAME_WIDTH - W) / 2;
    banner.y = 80;
    this.addChild(banner);
  }

  /**
   * 4 列 × 5 行关卡节点格。
   * 节点 Sprite 全部从同一纹理创建（状态通过 tint / texture 切换）。
   */
  private buildStageGrid(): void {
    const cols    = 4;
    const btnSize = 200;
    const gap     = 40;
    const totalW  = cols * btnSize + (cols - 1) * gap;
    const startX  = (GAME_WIDTH - totalW) / 2;
    const startY  = 280;

    // 生成两种圆形卡片纹理（普通 / 选中）
    this.cardTexture = makeTexture(
      this.ctx.renderer,
      g => drawCircleCell(g, btnSize),
      btnSize,
    );
    this.cardSelectedTexture = makeTexture(
      this.ctx.renderer,
      g => drawCircleCellSelected(g, btnSize),
      btnSize,
    );

    STAGES.forEach((stage, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = startX + col * (btnSize + gap);
      const y   = startY + row * (btnSize + gap);

      const card = this.buildStageButton(stage, x, y, btnSize);
      this.stageCards.push(card);

      // Star label (bottom-centre of the card)
      const starLabel = new PIXI.Text('', {
        fontFamily: 'Arial',
        fontSize:   28,
        fill:       0xEAB830,
      });
      starLabel.anchor.set(0.5, 1);
      starLabel.x = x + btnSize / 2;
      starLabel.y = y + btnSize - 8;
      starLabel.visible = false;
      this.addChild(starLabel);
      this.starLabels.push(starLabel);
    });

    this.refresh();
  }

  /** Daily Challenge entry panel at the bottom of the lobby. */
  private buildDailyChallengePanel(): void {
    const W      = 840;
    const H      = 160;
    const startX = (GAME_WIDTH - W) / 2;
    // Place below the 5-row stage grid (startY=280, 5 rows × 240px gap)
    const startY = 280 + 5 * (200 + 40) + 20;

    // Panel background
    const panel = new PIXI.Graphics();
    panel.lineStyle(2, C.cellSelBorder, 1);
    panel.beginFill(0xFBF8EE);
    panel.drawRoundedRect(0, 0, W, H, 16);
    panel.endFill();
    panel.x = startX;
    panel.y = startY;
    this.addChild(panel);

    // "每日挑战" title
    const title = new PIXI.Text('⚡ 每日挑战', {
      fontFamily: 'Arial', fontSize: 40, fontWeight: 'bold', fill: C.icon,
    });
    title.x = startX + 30;
    title.y = startY + 20;
    this.addChild(title);

    // Best score
    this.dcBestText = new PIXI.Text('今日最佳  --', {
      fontFamily: 'Arial', fontSize: 30, fill: C.icon,
    });
    this.dcBestText.x = startX + 30;
    this.dcBestText.y = startY + 80;
    this.addChild(this.dcBestText);

    // Streak
    this.dcStreakText = new PIXI.Text('连续挑战  0  天', {
      fontFamily: 'Arial', fontSize: 30, fill: C.icon,
    });
    this.dcStreakText.x = startX + 340;
    this.dcStreakText.y = startY + 80;
    this.addChild(this.dcStreakText);

    // Tap zone
    const hitSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    hitSprite.width  = W;
    hitSprite.height = H;
    hitSprite.x = startX;
    hitSprite.y = startY;
    this.addChild(hitSprite);
    this.ctx.input.registerUI(
      new UIElement({ zIndex: 5, sprite: hitSprite, onTap: () => this.onDailyChallenge() }),
    );
  }

  /** 构建单个关卡节点并注册点击事件。返回卡片 Sprite 以供状态管理使用。 */
  private buildStageButton(
    stage: StageData,
    x: number,
    y: number,
    size: number,
  ): PIXI.Sprite {
    // 初始用普通纹理，refresh() 会根据进度覆盖
    const card   = new PIXI.Sprite(this.cardTexture);
    card.width   = size;
    card.height  = size;
    card.x       = x;
    card.y       = y;
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

  /** 将关卡编号数字居中绘制在卡片上。 */
  private buildStageNumber(n: number, cardX: number, cardY: number, cardSize: number): void {
    const str    = n.toString();
    const digitW = 70;
    const digitH = 90;
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
