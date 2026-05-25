/**
 * dailyChallengeScene.ts
 *
 * The Daily Challenge scene — a 90-second timed sprint on a fixed 6×8 board.
 *
 * Key differences from GameScene:
 *   - No lives, no target progression: one board, one timer.
 *   - Scoring: +2 per elimination; combo multiplier: +3 / +4 / +5 (cap at 4th+).
 *   - Tetris-style row collapse: when a full row is cleared the rows above
 *     fall down and a fresh self-paired row is inserted at the top.
 *   - Board is seeded by today's date so every player faces the same layout.
 *
 * Header matches main GameScene conventions:
 *   - Sprite-based tip formula (□ + □ = Target) in the bottom row of the header.
 *   - Hint system: 3 s after selecting the first tile, matching tiles flash once.
 *   - Wrong second click: switches selection to the newly tapped cell (same as
 *     GameScene — does not reset to empty).
 *
 * Lifecycle:
 *   SceneCoordinator creates this once and calls start() each time the
 *   player enters. Call resize() whenever the window changes.
 */
import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { GameState } from './gameState';
import { Grid } from './grid';
import { NumberLayer } from './numbers';
import { EffectManager } from './effectManager';
import { DailyChallengeLogic } from './dailyChallengeLogic';
import { DailyChallengeResult } from './dailyChallengeResult';
import { drawBackground, drawHeaderBar, drawQuestionMark } from './graphicsFactory';
import { DigitDisplay } from './digitDisplay';
import { GAME_WIDTH, OFFSET_Y } from './consts';
import { getDailyTarget, getDailySeed, DAILY_GRID_W, DAILY_GRID_H, DAILY_DURATION_MS } from './dailyChallengeConfig';
import { saveDailyScore, getDailyBestScore, recordDailyPlay } from './dailyChallengeStore';
import { makeRng } from './seededRng';
import { UIElement } from '../inputSystem/uiElement';
import { Orientation } from './enums';

const COMBO_WINDOW_MS   = 3_000;
const HINT_DELAY_MS     = 3_000;
const RESULT_DISPLAY_MS = 500;

// ── Daily Challenge Header Layout ─────────────────────────────────────────────
//
// 内联 header 的所有元素均相对于 DailyChallengeScene 容器（场景坐标）定位，
// 而非相对于某个子容器。scoreCenterX / timerRightX 用于动态计算数字 x 位置。

interface DCHeaderLayout {
  // 背景条
  barX:        number;
  barY:        number;
  barW:        number;
  barH:        number;
  // 图标
  iconX:       number;
  iconY:       number;
  iconH:       number;
  // 返回按钮 hit area
  hitX:        number;
  hitY:        number;
  hitW:        number;
  hitH:        number;
  // 得分数字
  scoreCenterX: number;   // 分数显示区水平中心
  scoreY:       number;
  scoreDigitH:  number;
  // 倒计时数字
  timerRightX:  number;   // 倒计时右对齐基准 x
  timerY:       number;
  timerDigitH:  number;
  // 提示公式
  tipY:         number;
  tipSlotW:     number;
  tipSlotH:     number;
  tipSlot1X:    number;
  tipPlusX:     number;
  tipSlot2X:    number;
  tipEquaX:     number;
  tipTargetX:   number;
  tipTargetStep:number;
}

/** 竖屏布局（canvas 宽 = GAME_WIDTH = 1080）。 */
function portraitDCLayout(): DCHeaderLayout {
  return {
    barX: 20,   barY: 10,  barW: GAME_WIDTH - 40, barH: OFFSET_Y - 20,
    iconX: 50,  iconY: 15, iconH: 70,
    hitX: 20,   hitY: 10,  hitW: 260, hitH: 110,
    scoreCenterX: GAME_WIDTH / 2,
    scoreY: 18, scoreDigitH: 72,
    timerRightX: GAME_WIDTH - 50,
    timerY: 18, timerDigitH: 72,
    tipY: 115, tipSlotW: 65, tipSlotH: 82,
    tipSlot1X: 50,  tipPlusX: 125, tipSlot2X: 200,
    tipEquaX: 275,  tipTargetX: 350, tipTargetStep: 70,
  };
}

/**
 * 横屏布局（canvas 高 = GAME_WIDTH = 1080；bar 从 x=350 开始，宽 1350）。
 * 与主游戏 Header 横屏偏移一致，避免与网格区域重叠。
 */
function landscapeDCLayout(screenW: number): DCHeaderLayout {
  const barX = 350;
  const barW = screenW - barX - 20;
  const cx   = barX + barW / 2;
  return {
    barX,  barY: 10, barW, barH: OFFSET_Y - 20,
    iconX: barX + 30, iconY: 15, iconH: 70,
    hitX:  barX,      hitY: 10,  hitW: 260, hitH: 110,
    scoreCenterX: cx,
    scoreY: 18, scoreDigitH: 72,
    timerRightX: barX + barW - 20,
    timerY: 18, timerDigitH: 72,
    tipY: 115, tipSlotW: 65, tipSlotH: 82,
    tipSlot1X: barX + 30, tipPlusX: barX + 105, tipSlot2X: barX + 180,
    tipEquaX:  barX + 255, tipTargetX: barX + 330, tipTargetStep: 70,
  };
}

function getDCLayout(screen: ScreenConfig): DCHeaderLayout {
  return screen.orientation === Orientation.Landscape
    ? landscapeDCLayout(screen.width)
    : portraitDCLayout();
}

// ── DailyChallengeScene ───────────────────────────────────────────────────────

export class DailyChallengeScene extends PIXI.Container {
  private readonly screen: ScreenConfig;
  private readonly state:  GameState;
  private readonly logic:  DailyChallengeLogic;

  private bg!:           PIXI.Graphics;
  private gridLayer!:    Grid;
  private numberLayer!:  NumberLayer;
  private effectLayer!:  EffectManager;
  private resultOverlay!: DailyChallengeResult;

  // ── Header 元素 ───────────────────────────────────────────────────────────
  private headerBar!:    PIXI.Graphics;
  private headerIcon!:   PIXI.Sprite;
  private headerHit!:    PIXI.Sprite;
  private scoreDisplay!: DigitDisplay;
  private timerDisplay!: DigitDisplay;

  // ── Header tip formula ────────────────────────────────────────────────────
  private tipContainer!: PIXI.Container;
  private tipResultElapsed = -1;

  // ── 当前 header 布局（resize / updateScore / updateTimer 共用）────────────
  private dcLayout!: DCHeaderLayout;

  // ── Runtime ───────────────────────────────────────────────────────────────
  private selectedIndex    = -1;
  private score            = 0;
  private comboCount       = 0;
  private lastElimGameTime = -Infinity;
  private gameTimeMs       = 0;
  private initialized      = false;
  private playRecorded     = false;

  // ── Hint system ───────────────────────────────────────────────────────────
  private hintTimerMs = -1;
  private hintFired   = false;

  constructor(
    private readonly ctx: AppContext,
    private readonly onGoLobby: () => void,
  ) {
    super();
    this.screen = new ScreenConfig();
    this.state  = new GameState();
    this.logic  = new DailyChallengeLogic();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public start(): void {
    this.score            = 0;
    this.comboCount       = 0;
    this.lastElimGameTime = -Infinity;
    this.gameTimeMs       = 0;
    this.selectedIndex    = -1;
    this.playRecorded     = false;
    this.resetHintTimer();

    this.state.reset();
    this.state.addTime(DAILY_DURATION_MS);

    const target = getDailyTarget();
    const rng    = makeRng(getDailySeed());
    this.logic.initializeSeeded(target, rng);

    if (this.initialized) {
      this.resultOverlay.hide();
      this.updateScoreDisplay();
      this.updateTimerDisplay();
      this.rebuildTip(null, null);
      this.syncGrid();
    }
  }

  public resize(windowWidth: number, windowHeight: number): void {
    this.screen.update(windowWidth, windowHeight);
    this.screen.setGridDims(DAILY_GRID_W, DAILY_GRID_H);
    this.dcLayout = getDCLayout(this.screen);

    if (!this.initialized) {
      this.buildScene();
      this.initialized = true;
    } else {
      drawBackground(this.bg, this.screen.width, this.screen.height);
      this.gridLayer.reconfigure();
      this.numberLayer.reconfigure(this.logic);
      this.repositionHeader();
      this.updateScoreDisplay();
      this.updateTimerDisplay();
      this.rebuildTip(null, null);
      this.resultOverlay.resize(this.screen);
    }

    this.x = 0;
    this.y = 0;
    this.scale.set(this.screen.scale);
  }

  public update(deltaMs: number): void {
    if (!this.initialized) return;

    this.effectLayer.update(deltaMs);
    this.numberLayer.update(deltaMs);
    this.updateTipResultReset(deltaMs);

    if (this.state.isGameEnd) return;

    this.gameTimeMs += deltaMs;
    this.state.tick(deltaMs);
    this.updateTimerDisplay();

    if (this.state.isTimeUp) {
      this.onTimeUp();
      return;
    }

    if (this.hintTimerMs >= 0 && !this.hintFired) {
      this.hintTimerMs += deltaMs;
      if (this.hintTimerMs >= HINT_DELAY_MS) {
        this.triggerHint();
      }
    }
  }

  // ── Scene construction ─────────────────────────────────────────────────────

  private buildScene(): void {
    this.screen.setGridDims(DAILY_GRID_W, DAILY_GRID_H);

    this.bg = new PIXI.Graphics();
    drawBackground(this.bg, this.screen.width, this.screen.height);
    this.addChild(this.bg);

    this.gridLayer   = new Grid(this.ctx, this.screen, idx => this.onCellClick(idx));
    this.numberLayer = new NumberLayer(this.ctx, this.screen);
    this.effectLayer = new EffectManager(this.ctx, this.screen);

    this.resultOverlay = new DailyChallengeResult(
      this.ctx,
      () => this.start(),
      () => this.onGoLobby(),
    );

    this.addChild(this.gridLayer);
    this.addChild(this.numberLayer);
    this.addChild(this.effectLayer);

    this.buildHeader();
    this.addChild(this.resultOverlay);

    this.syncGrid();
    this.updateScoreDisplay();
    this.updateTimerDisplay();
    this.rebuildTip(null, null);
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  private buildHeader(): void {
    const L = this.dcLayout;

    // 背景条
    this.headerBar = new PIXI.Graphics();
    drawHeaderBar(this.headerBar, L.barW, L.barH);
    this.headerBar.x = L.barX;
    this.headerBar.y = L.barY;
    this.addChild(this.headerBar);

    // Daily challenge 图标
    this.headerIcon = new PIXI.Sprite(this.ctx.assets.GetTexture('daily_challenge_icon.png'));
    const iconScale = L.iconH / Math.max(this.headerIcon.texture.width, this.headerIcon.texture.height);
    this.headerIcon.width  = this.headerIcon.texture.width  * iconScale;
    this.headerIcon.height = this.headerIcon.texture.height * iconScale;
    this.headerIcon.x = L.iconX;
    this.headerIcon.y = L.iconY;
    this.addChild(this.headerIcon);

    // 得分数字
    const scoreDigitW = Math.round(L.scoreDigitH * 120 / 160);
    this.scoreDisplay = new DigitDisplay(this.ctx, scoreDigitW, L.scoreDigitH);
    this.scoreDisplay.y = L.scoreY;
    this.addChild(this.scoreDisplay);

    // 倒计时数字
    const timerDigitW = Math.round(L.timerDigitH * 120 / 160);
    this.timerDisplay = new DigitDisplay(this.ctx, timerDigitW, L.timerDigitH);
    this.timerDisplay.y = L.timerY;
    this.addChild(this.timerDisplay);

    // 返回大厅点击区（覆盖图标）
    this.headerHit = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.headerHit.width  = L.hitW;
    this.headerHit.height = L.hitH;
    this.headerHit.x = L.hitX;
    this.headerHit.y = L.hitY;
    this.addChild(this.headerHit);
    this.ctx.input.registerUI(
      new UIElement({ zIndex: 15, sprite: this.headerHit, onTap: () => this.onGoLobby() }),
    );
  }

  /**
   * 在 resize 时重新定位 header 的固定元素（背景条、图标、hit area）。
   * 得分 / 倒计时由 updateScoreDisplay / updateTimerDisplay 处理。
   */
  private repositionHeader(): void {
    const L = this.dcLayout;

    // 背景条：尺寸变化则重绘
    this.headerBar.clear();
    drawHeaderBar(this.headerBar, L.barW, L.barH);
    this.headerBar.x = L.barX;
    this.headerBar.y = L.barY;

    // 图标
    const iconScale = L.iconH / Math.max(this.headerIcon.texture.width, this.headerIcon.texture.height);
    this.headerIcon.width  = this.headerIcon.texture.width  * iconScale;
    this.headerIcon.height = this.headerIcon.texture.height * iconScale;
    this.headerIcon.x = L.iconX;
    this.headerIcon.y = L.iconY;

    // 得分 / 倒计时数字尺寸更新（内容由 update 方法刷新）
    this.scoreDisplay.digitW = Math.round(L.scoreDigitH * 120 / 160);
    this.scoreDisplay.digitH = L.scoreDigitH;
    this.scoreDisplay.y      = L.scoreY;

    this.timerDisplay.digitW = Math.round(L.timerDigitH * 120 / 160);
    this.timerDisplay.digitH = L.timerDigitH;
    this.timerDisplay.y      = L.timerY;

    // Hit area
    this.headerHit.x = L.hitX;
    this.headerHit.y = L.hitY;
    this.headerHit.width  = L.hitW;
    this.headerHit.height = L.hitH;
  }

  // ── Tip formula ────────────────────────────────────────────────────────────

  private rebuildTip(first: number | null, second: number | null): void {
    if (this.tipContainer) {
      this.removeChild(this.tipContainer);
      this.tipContainer.destroy({ children: true });
    }
    this.tipContainer = new PIXI.Container();

    const L = this.dcLayout;
    const { tipY: Y, tipSlotW: W, tipSlotH: H } = L;

    this.addTipSlotOrValue(this.tipContainer, first,  L.tipSlot1X, Y, W, H);

    const plus  = new PIXI.Sprite(this.ctx.assets.GetTexture('plus.png'));
    plus.width  = W; plus.height = H;
    plus.x      = L.tipPlusX; plus.y = Y;
    this.tipContainer.addChild(plus);

    this.addTipSlotOrValue(this.tipContainer, second, L.tipSlot2X, Y, W, H);

    const equa  = new PIXI.Sprite(this.ctx.assets.GetTexture('equa.png'));
    equa.width  = W; equa.height = H;
    equa.x      = L.tipEquaX; equa.y = Y;
    this.tipContainer.addChild(equa);

    getDailyTarget().toString().split('').forEach((ch, i) => {
      const s   = new PIXI.Sprite(this.ctx.assets.GetTexture(`${ch}.png`));
      s.width   = W; s.height = H;
      s.x       = L.tipTargetX + i * L.tipTargetStep; s.y = Y;
      this.tipContainer.addChild(s);
    });

    this.addChild(this.tipContainer);
  }

  private addTipSlotOrValue(
    container: PIXI.Container,
    value: number | null,
    x: number, y: number, w: number, h: number,
  ): void {
    if (value === null) {
      const g = new PIXI.Graphics();
      g.lineStyle(3, 0xBBBBBB, 1);
      g.beginFill(0xF0F0F0, 1);
      g.drawRoundedRect(x, y, w, h, 10);
      g.endFill();
      drawQuestionMark(g, x + w / 2, y + h / 2, h);
      container.addChild(g);
    } else {
      const digits = value.toString().split('');
      if (digits.length === 1) {
        const s   = new PIXI.Sprite(this.ctx.assets.GetTexture(`${digits[0]}.png`));
        s.width   = w; s.height = h;
        s.x       = x; s.y     = y;
        container.addChild(s);
      } else {
        const dw = Math.floor((w - 4) / 2);
        digits.forEach((ch, i) => {
          const s = new PIXI.Sprite(this.ctx.assets.GetTexture(`${ch}.png`));
          s.width = dw; s.height = h;
          s.x     = x + i * (dw + 4); s.y = y;
          container.addChild(s);
        });
      }
    }
  }

  private updateTipResultReset(deltaMs: number): void {
    if (this.tipResultElapsed < 0) return;
    this.tipResultElapsed += deltaMs;
    if (this.tipResultElapsed >= RESULT_DISPLAY_MS) {
      this.tipResultElapsed = -1;
      this.rebuildTip(null, null);
    }
  }

  // ── Grid sync ──────────────────────────────────────────────────────────────

  private syncGrid(): void {
    this.gridLayer.reconfigure();
    this.numberLayer.reconfigure(this.logic);

    for (let col = 0; col < DAILY_GRID_W; col++) {
      for (let row = 0; row < DAILY_GRID_H; row++) {
        const idx = this.screen.cellIndex(col, row);
        if (this.logic.getNumberByIndex(idx) === 0) {
          this.gridLayer.hideCell(idx);
        }
      }
    }
  }

  // ── Cell click ─────────────────────────────────────────────────────────────

  private onCellClick(index: number): void {
    if (this.state.isGameEnd) return;
    if (this.logic.getNumberByIndex(index) === 0) return;

    if (this.selectedIndex === -1) {
      this.selectedIndex = index;
      this.gridLayer.showSelection(index);
      this.rebuildTip(this.logic.getNumberByIndex(index), null);
      this.startHintTimer();
      return;
    }

    if (this.selectedIndex === index) {
      this.selectedIndex = -1;
      this.gridLayer.hideSelection();
      this.rebuildTip(null, null);
      this.resetHintTimer();
      return;
    }

    const a      = this.logic.getNumberByIndex(this.selectedIndex);
    const b      = this.logic.getNumberByIndex(index);
    const target = getDailyTarget();

    if (a + b === target) {
      this.eliminatePair(this.selectedIndex, index, a, b);
    } else {
      this.selectedIndex = index;
      this.gridLayer.showSelection(index);
      this.rebuildTip(b, null);
      this.startHintTimer();
    }
  }

  private eliminatePair(idxA: number, idxB: number, a: number, b: number): void {
    this.resetHintTimer();

    this.rebuildTip(a, b);
    this.tipResultElapsed = 0;

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

    const elapsed = this.gameTimeMs - this.lastElimGameTime;
    if (elapsed <= COMBO_WINDOW_MS) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    this.lastElimGameTime = this.gameTimeMs;

    const points = this.comboCount === 1 ? 2
                 : this.comboCount === 2 ? 3
                 : this.comboCount === 3 ? 4
                 :                         5;
    this.score += points;
    this.updateScoreDisplay();

    let collapsed = this.logic.checkAndCollapse();
    while (collapsed) {
      this.syncGrid();
      collapsed = this.logic.checkAndCollapse();
    }
  }

  // ── Hint system ────────────────────────────────────────────────────────────

  private resetHintTimer(): void {
    this.hintTimerMs = -1;
    this.hintFired   = false;
  }

  private startHintTimer(): void {
    this.hintTimerMs = 0;
    this.hintFired   = false;
  }

  private triggerHint(): void {
    if (this.selectedIndex === -1 || this.hintFired) return;
    this.hintFired = true;

    const selectedValue = this.logic.getNumberByIndex(this.selectedIndex);
    const target        = getDailyTarget();
    const pairIndices   = this.logic.findPairIndices(selectedValue, target);

    if (pairIndices.length > 0) {
      this.numberLayer.flashHint(pairIndices);
    }
  }

  // ── Display helpers ────────────────────────────────────────────────────────

  private updateScoreDisplay(): void {
    this.scoreDisplay.update(this.score);
    this.scoreDisplay.x = this.dcLayout.scoreCenterX - this.scoreDisplay.totalWidth / 2;
  }

  private updateTimerDisplay(): void {
    const secs = this.state.remainingSeconds;
    this.timerDisplay.update(secs);
    this.timerDisplay.x    = this.dcLayout.timerRightX - this.timerDisplay.totalWidth;
    this.timerDisplay.tint = secs <= 10 ? 0xff4444 : 0xFFFFFF;
  }

  // ── Time up ────────────────────────────────────────────────────────────────

  private onTimeUp(): void {
    this.state.isGameEnd = true;
    this.selectedIndex   = -1;
    this.gridLayer.hideSelection();

    if (!this.playRecorded) {
      recordDailyPlay();
      this.playRecorded = true;
    }

    const isNewBest = saveDailyScore(this.score);
    this.resultOverlay.show(this.score, isNewBest);
  }
}
