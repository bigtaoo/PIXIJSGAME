import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { STAGES, StageData } from './stageConfig';
import { StageManager } from './stageManager';
import { StarManager } from './starManager';
import { UIElement } from '../inputSystem/uiElement';
import { GAME_WIDTH, GAME_HEIGHT } from './consts';
import { drawCircleCell, drawCircleCellSelected, makeTexture } from './graphicsFactory';
import { getDailyBestScore, getStreakDays } from './dailyChallengeStore';
import { LOBBY_NODE_POSITIONS, DAILY_CHALLENGE_POS } from './lobbyLayout';
import { Orientation } from './enums';
import { DigitDisplay } from './digitDisplay';

// ── 节点星星尺寸 ──────────────────────────────────────────────────────────────
const STAR_SIZE    = 18;
const STAR_GAP     = 2;
const TOTAL_STAR_W = 3 * STAR_SIZE + 2 * STAR_GAP;

// ── 每日挑战区图标 + 数字行尺寸 ───────────────────────────────────────────────
const DC_ICON_H  = 20;
const DC_ICON_W  = 20;
const DC_DIGIT_H = 20;
const DC_DIGIT_W = Math.round(DC_DIGIT_H * 120 / 160); // ~15
const DC_GAP     = 4;

// ── 节点关卡数字尺寸 ──────────────────────────────────────────────────────────
const NODE_DIGIT_H = 40;
const NODE_DIGIT_W = Math.round(NODE_DIGIT_H * 120 / 160); // 30

// Per-node runtime data for repositioning on resize
interface NodeEntry {
  portraitCX:    number;
  portraitCY:    number;
  card:          PIXI.Sprite;
  numDisplay:    DigitDisplay;
  starContainer: PIXI.Container;
  starSprites:   PIXI.Sprite[];   // always 3
}

// Daily challenge element refs for repositioning on resize
interface DailyChallengeEntry {
  portraitX:     number;
  portraitY:     number;
  circle:        PIXI.Graphics;
  icon:          PIXI.Sprite;
  bestRow:       PIXI.Container;
  bestDisplay:   DigitDisplay;
  streakRow:     PIXI.Container;
  streakDisplay: DigitDisplay;
  hit:           PIXI.Sprite;
}

export class LobbyScene extends PIXI.Container {
  private readonly screen: ScreenConfig;

  private static readonly NODE_SIZE  = 100;
  private static readonly DAILY_SIZE = 130;

  private bg!: PIXI.Sprite;

  private nodeEntries:        NodeEntry[]      = [];
  private dailyEntry!:        DailyChallengeEntry;

  // Parallel arrays kept for refresh()
  private stageCards:         PIXI.Sprite[]    = [];
  private nodeStarContainers: PIXI.Container[] = [];
  private nodeStarSprites:    PIXI.Sprite[][]  = [];

  private cardTexture!:         PIXI.Texture;
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

  // ── Public API ──────────────────────────────────────────────────────────────

  public resize(windowWidth: number, windowHeight: number): void {
    this.screen.update(windowWidth, windowHeight);
    this.x = 0;
    this.y = 0;
    this.scale.set(this.screen.scale);
    this.updateBgSize();
    this.repositionAll();
  }

  public refresh(): void {
    const maxCompleted = StageManager.getMaxCompleted();

    STAGES.forEach((stage, i) => {
      const card      = this.stageCards[i];
      const starCont  = this.nodeStarContainers[i];
      const starSprts = this.nodeStarSprites[i];
      if (!card || !starCont || !starSprts) return;

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
        starCont.visible = stars > 0;
        for (let s = 0; s < 3; s++) {
          const sp = starSprts[s]!;
          if (s < stars) {
            sp.tint  = 0xEAB830;
            sp.alpha = 1.0;
          } else {
            sp.tint  = 0x888888;
            sp.alpha = 0.35;
          }
        }
      } else {
        starCont.visible = false;
      }
    });

    this.refreshDailyRows();
  }

  // ── Build helpers ───────────────────────────────────────────────────────────

  private buildUI(): void {
    this.buildBackground();
    this.buildAdventureMap();
    this.buildDailyChallenge();
  }

  private buildBackground(): void {
    this.bg = new PIXI.Sprite(this.ctx.assets.GetTexture('lobby_bg.png'));
    this.bg.x      = 0;
    this.bg.y      = 0;
    this.bg.width  = GAME_WIDTH;
    this.bg.height = GAME_HEIGHT;
    this.addChild(this.bg);
  }

  private buildAdventureMap(): void {
    const sz = LobbyScene.NODE_SIZE;
    const r  = sz / 2;

    this.cardTexture         = makeTexture(this.ctx.renderer, g => drawCircleCell(g, sz), sz);
    this.cardSelectedTexture = makeTexture(this.ctx.renderer, g => drawCircleCellSelected(g, sz), sz);

    STAGES.forEach((stage, i) => {
      const pos = LOBBY_NODE_POSITIONS[i];
      if (!pos) return;
      const cx = pos.x;
      const cy = pos.y;

      const card = this.buildStageButton(stage, cx - r, cy - r, sz);
      this.stageCards.push(card);

      // Digit sprites for stage number
      const numDisplay = new DigitDisplay(this.ctx, NODE_DIGIT_W, NODE_DIGIT_H);
      numDisplay.update(stage.stageIndex);
      numDisplay.x = cx - numDisplay.totalWidth / 2;
      numDisplay.y = cy - NODE_DIGIT_H / 2;
      this.addChild(numDisplay);

      // 3 star sprites
      const { container: starContainer, sprites: starSprites } = this.buildStarRow();
      starContainer.x       = cx - TOTAL_STAR_W / 2;
      starContainer.y       = cy + r + 4;
      starContainer.visible = false;
      this.addChild(starContainer);
      this.nodeStarContainers.push(starContainer);
      this.nodeStarSprites.push(starSprites);

      this.nodeEntries.push({
        portraitCX: cx, portraitCY: cy,
        card, numDisplay, starContainer, starSprites,
      });
    });

    this.refresh();
  }

  /** 构建 3 颗星的水平行。 */
  private buildStarRow(): { container: PIXI.Container; sprites: PIXI.Sprite[] } {
    const container = new PIXI.Container();
    const sprites: PIXI.Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const s    = new PIXI.Sprite(this.ctx.assets.GetTexture('star.png'));
      s.width    = STAR_SIZE;
      s.height   = STAR_SIZE;
      s.x        = i * (STAR_SIZE + STAR_GAP);
      s.y        = 0;
      s.tint     = 0xEAB830;
      container.addChild(s);
      sprites.push(s);
    }
    return { container, sprites };
  }

  private buildDailyChallenge(): void {
    const { x, y } = DAILY_CHALLENGE_POS;
    const sz = LobbyScene.DAILY_SIZE;
    const r  = sz / 2;

    const circle = new PIXI.Graphics();
    circle.lineStyle(4, 0x6D4C41, 1);
    circle.beginFill(0xC8862A);
    circle.drawCircle(0, 0, r);
    circle.endFill();
    circle.x = x;
    circle.y = y;
    this.addChild(circle);

    const icon = new PIXI.Sprite(this.ctx.assets.GetTexture('daily_challenge_icon.png'));
    const targetPx  = sz * 0.7;
    const iconScale = targetPx / Math.max(icon.texture.width, icon.texture.height);
    icon.width  = icon.texture.width  * iconScale;
    icon.height = icon.texture.height * iconScale;
    icon.anchor.set(0.5, 0.5);
    icon.x = x;
    icon.y = y;
    this.addChild(icon);

    // 最佳分数行：奖杯图标 + 数字
    const best = this.buildIconDigitRow('trophy.png');
    this.addChild(best.container);

    // 连续天数行：火焰图标 + 数字
    const streak = this.buildIconDigitRow('fire.png');
    this.addChild(streak.container);

    const hit = new PIXI.Sprite(PIXI.Texture.EMPTY);
    hit.width  = sz;
    hit.height = sz;
    hit.x      = x - r;
    hit.y      = y - r;
    this.addChild(hit);
    this.ctx.input.registerUI(
      new UIElement({ zIndex: 5, sprite: hit, onTap: () => this.onDailyChallenge() }),
    );

    this.dailyEntry = {
      portraitX: x, portraitY: y,
      circle, icon,
      bestRow:       best.container,   bestDisplay:   best.display,
      streakRow:     streak.container, streakDisplay: streak.display,
      hit,
    };

    this.refreshDailyRows();
  }

  /** 构建 [小图标 + DigitDisplay] 行，返回 container 和 display 的引用。 */
  private buildIconDigitRow(iconKey: string): { container: PIXI.Container; display: DigitDisplay } {
    const container  = new PIXI.Container();
    const iconSprite = new PIXI.Sprite(this.ctx.assets.GetTexture(iconKey));
    iconSprite.width  = DC_ICON_W;
    iconSprite.height = DC_ICON_H;
    iconSprite.x      = 0;
    iconSprite.y      = (DC_DIGIT_H - DC_ICON_H) / 2;
    container.addChild(iconSprite);

    const display = new DigitDisplay(this.ctx, DC_DIGIT_W, DC_DIGIT_H, 0x5D4037);
    display.x = DC_ICON_W + DC_GAP;
    display.y = 0;
    container.addChild(display);

    return { container, display };
  }

  /**
   * 更新每日挑战区数字内容并重新居中两行。
   * 同时被 refresh() 和 repositionAll() 调用，以 toLogicalPos 获取当前坐标。
   */
  private refreshDailyRows(): void {
    if (!this.dailyEntry) return;
    const pos = this.toLogicalPos(this.dailyEntry.portraitX, this.dailyEntry.portraitY);
    const dr  = LobbyScene.DAILY_SIZE / 2;

    // 最佳分数行
    const best = getDailyBestScore();
    if (best > 0) {
      this.dailyEntry.bestDisplay.update(best);
      const rowW = DC_ICON_W + DC_GAP + this.dailyEntry.bestDisplay.totalWidth;
      this.dailyEntry.bestRow.x       = pos.x - rowW / 2;
      this.dailyEntry.bestRow.y       = pos.y + dr + 8;
      this.dailyEntry.bestRow.visible = true;
    } else {
      this.dailyEntry.bestRow.visible = false;
    }

    // 连续天数行
    const streakDays = getStreakDays();
    this.dailyEntry.streakDisplay.update(streakDays);
    const streakW = DC_ICON_W + DC_GAP + this.dailyEntry.streakDisplay.totalWidth;
    this.dailyEntry.streakRow.x       = pos.x - streakW / 2;
    this.dailyEntry.streakRow.y       = pos.y + dr + (best > 0 ? 32 : 8);
    this.dailyEntry.streakRow.visible = true;
  }

  // ── Resize helpers ──────────────────────────────────────────────────────────

  private updateBgSize(): void {
    if (!this.bg) return;
    if (this.screen.orientation === Orientation.Landscape) {
      this.bg.width  = this.screen.width;
      this.bg.height = this.screen.width;
    } else {
      this.bg.width  = GAME_WIDTH;
      this.bg.height = GAME_HEIGHT;
    }
  }

  private toLogicalPos(portraitX: number, portraitY: number): { x: number; y: number } {
    if (this.screen.orientation !== Orientation.Landscape) {
      return { x: portraitX, y: portraitY };
    }
    return {
      x: (portraitX / GAME_WIDTH)  * this.screen.width,
      y: (portraitY / GAME_HEIGHT) * GAME_WIDTH,
    };
  }

  private repositionAll(): void {
    const sz = LobbyScene.NODE_SIZE;
    const r  = sz / 2;

    for (const entry of this.nodeEntries) {
      const pos = this.toLogicalPos(entry.portraitCX, entry.portraitCY);
      entry.card.x          = pos.x - r;
      entry.card.y          = pos.y - r;
      entry.numDisplay.x    = pos.x - entry.numDisplay.totalWidth / 2;
      entry.numDisplay.y    = pos.y - NODE_DIGIT_H / 2;
      entry.starContainer.x = pos.x - TOTAL_STAR_W / 2;
      entry.starContainer.y = pos.y + r + 4;
    }

    if (this.dailyEntry) {
      const pos = this.toLogicalPos(this.dailyEntry.portraitX, this.dailyEntry.portraitY);
      const dr  = LobbyScene.DAILY_SIZE / 2;
      this.dailyEntry.circle.x = pos.x;
      this.dailyEntry.circle.y = pos.y;
      this.dailyEntry.icon.x   = pos.x;
      this.dailyEntry.icon.y   = pos.y;
      this.dailyEntry.hit.x    = pos.x - dr;
      this.dailyEntry.hit.y    = pos.y - dr;
      // 重新居中数字行（含最新数值）
      this.refreshDailyRows();
    }
  }

  // ── Internal builders ───────────────────────────────────────────────────────

  private buildStageButton(stage: StageData, x: number, y: number, size: number): PIXI.Sprite {
    const card  = new PIXI.Sprite(this.cardTexture);
    card.width  = size;
    card.height = size;
    card.x      = x;
    card.y      = y;
    this.addChild(card);
    this.ctx.input.registerUI(
      new UIElement({
        zIndex: 5,
        sprite: card,
        onTap: () => { if (StageManager.isUnlocked(stage.stageIndex)) this.onSelectStage(stage); },
      }),
    );
    return card;
  }
}
