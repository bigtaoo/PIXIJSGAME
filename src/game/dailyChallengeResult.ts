/**
 * dailyChallengeResult.ts
 *
 * Result overlay shown when the 90-second Daily Challenge timer expires.
 *
 * Displays:
 *   - Final score（digit sprites）
 *   - Today's personal best（trophy icon + digit sprites）
 *   - Consecutive-streak count（fire icon + digit sprites）
 *   - "Play Again" and "Lobby" icon buttons（retry.png / lobby.png）
 *   - CrazyGames leaderboard submission (fire-and-forget, silent on failure)
 */
import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';
import { drawPanel } from './graphicsFactory';
import { getDailyBestScore, getStreakDays } from './dailyChallengeStore';
import { GAME_WIDTH } from './consts';
import { DigitDisplay } from './digitDisplay';

// ── CrazyGames leaderboard (optional integration) ──────────────────────────────
// Replace ENCRYPTION_KEY with the 32-byte base64 key agreed with CrazyGames.
const ENCRYPTION_KEY = '';   // TODO: set before going live

async function encryptScore(score: number, key: string): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const alg: AesGcmParams = { name: 'AES-GCM', iv };
  const keyBytes = Uint8Array.from(atob(key), c => c.charCodeAt(0));
  const cryptoKey = await window.crypto.subtle.importKey('raw', keyBytes, alg, false, ['encrypt']);
  const data = new TextEncoder().encode(score.toString());
  const encrypted = await window.crypto.subtle.encrypt(alg, cryptoKey, data);
  const combined = new Uint8Array(12 + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), 12);
  return btoa(String.fromCharCode(...combined));
}

function submitScoreToCrazyGames(score: number): void {
  if (!ENCRYPTION_KEY) return;
  const sdk = (window as unknown as Record<string, unknown>)['CrazyGames'];
  if (!sdk) return;
  encryptScore(score, ENCRYPTION_KEY)
    .then(enc => {
      (sdk as { SDK: { user: { submitScore: (o: object) => void } } })
        .SDK.user.submitScore({ encryptedScore: enc });
    })
    .catch(() => { /* silent */ });
}

// ── Panel layout constants ─────────────────────────────────────────────────────

const PANEL_W = 720;
const PANEL_H = 520;
const PANEL_X = (GAME_WIDTH - PANEL_W) / 2;
const PANEL_Y = 680;

// 得分 digit 尺寸
const SCORE_DIGIT_H = 110;
const SCORE_DIGIT_W = Math.round(SCORE_DIGIT_H * 120 / 160); // ~82

// 图标行 icon / digit 尺寸
const ROW_ICON_H  = 36;
const ROW_ICON_W  = 36;
const ROW_DIGIT_H = 36;
const ROW_DIGIT_W = Math.round(ROW_DIGIT_H * 120 / 160); // ~27
const ROW_GAP     = 8;

// ── DailyChallengeResult ───────────────────────────────────────────────────────

export class DailyChallengeResult extends PIXI.Container {
  private scoreDisplay!:  DigitDisplay;
  private bestDisplay!:   DigitDisplay;
  private streakDisplay!: DigitDisplay;
  private bestRow!:       PIXI.Container;
  private streakRow!:     PIXI.Container;

  constructor(
    ctx: AppContext,
    private readonly onPlayAgain: () => void,
    private readonly onLobby:     () => void,
  ) {
    super();
    this.visible = false;
    this.buildPanel(ctx);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public show(score: number, _isNewBest: boolean): void {
    const cx = PANEL_X + PANEL_W / 2;

    // 得分（大数字，居中）
    this.scoreDisplay.update(score);
    this.scoreDisplay.x = cx - this.scoreDisplay.totalWidth / 2;

    // 最佳分数行
    const best = getDailyBestScore();
    if (best > 0) {
      this.bestDisplay.update(best);
      const rowW = ROW_ICON_W + ROW_GAP + this.bestDisplay.totalWidth;
      this.bestRow.x       = cx - rowW / 2;
      this.bestRow.visible = true;
    } else {
      this.bestRow.visible = false;
    }

    // 连续天数行
    const streak = getStreakDays();
    this.streakDisplay.update(streak);
    const streakW = ROW_ICON_W + ROW_GAP + this.streakDisplay.totalWidth;
    this.streakRow.x       = cx - streakW / 2;
    this.streakRow.visible = true;

    submitScoreToCrazyGames(score);
    this.visible = true;
  }

  public hide(): void {
    this.visible = false;
  }

  // ── UI construction ────────────────────────────────────────────────────────

  private buildPanel(ctx: AppContext): void {
    const bg = new PIXI.Graphics();
    drawPanel(bg, PANEL_W, PANEL_H);
    bg.x = PANEL_X;
    bg.y = PANEL_Y;
    this.addChild(bg);

    const cx = PANEL_X + PANEL_W / 2;

    // 得分（大数字，初始 "0"）
    this.scoreDisplay = new DigitDisplay(ctx, SCORE_DIGIT_W, SCORE_DIGIT_H);
    this.scoreDisplay.update(0);
    this.scoreDisplay.x = cx - this.scoreDisplay.totalWidth / 2;
    this.scoreDisplay.y = PANEL_Y + 60;
    this.addChild(this.scoreDisplay);

    // 最佳分数行：奖杯 + 数字
    this.bestRow = this.buildIconRow(ctx, 'trophy.png', 'best');
    this.bestRow.y = PANEL_Y + 220;
    this.addChild(this.bestRow);

    // 连续天数行：火焰 + 数字
    this.streakRow = this.buildIconRow(ctx, 'fire.png', 'streak');
    this.streakRow.y = PANEL_Y + 270;
    this.addChild(this.streakRow);

    // 按钮
    this.buildButtons(ctx);
  }

  /** 构建 [图标 + DigitDisplay] 水平行。role 决定将 display 引用存到哪个字段。 */
  private buildIconRow(ctx: AppContext, iconKey: string, role: 'best' | 'streak'): PIXI.Container {
    const container  = new PIXI.Container();

    const iconSprite = new PIXI.Sprite(ctx.assets.GetTexture(iconKey));
    iconSprite.width  = ROW_ICON_W;
    iconSprite.height = ROW_ICON_H;
    iconSprite.x      = 0;
    iconSprite.y      = (ROW_DIGIT_H - ROW_ICON_H) / 2;
    container.addChild(iconSprite);

    const display = new DigitDisplay(ctx, ROW_DIGIT_W, ROW_DIGIT_H);
    display.x = ROW_ICON_W + ROW_GAP;
    display.y = 0;
    container.addChild(display);

    if (role === 'best')   this.bestDisplay   = display;
    if (role === 'streak') this.streakDisplay = display;

    return container;
  }

  private buildButtons(ctx: AppContext): void {
    const btnSize = 160;
    const gap     = 80;
    const totalW  = btnSize * 2 + gap;
    const startX  = PANEL_X + (PANEL_W - totalW) / 2;
    const btnY    = PANEL_Y + PANEL_H - btnSize - 40;

    // "再玩"——复用 retry.png（程序化生成的图标）
    const retrySprite = new PIXI.Sprite(ctx.assets.GetTexture('retry.png'));
    retrySprite.width  = btnSize;
    retrySprite.height = btnSize;
    retrySprite.x      = startX;
    retrySprite.y      = btnY;
    this.addChild(retrySprite);
    ctx.input.registerUI(new UIElement({ zIndex: 25, sprite: retrySprite, onTap: this.onPlayAgain }));

    // "大厅"——复用 lobby.png（程序化生成的图标）
    const lobbySprite = new PIXI.Sprite(ctx.assets.GetTexture('lobby.png'));
    lobbySprite.width  = btnSize;
    lobbySprite.height = btnSize;
    lobbySprite.x      = startX + btnSize + gap;
    lobbySprite.y      = btnY;
    this.addChild(lobbySprite);
    ctx.input.registerUI(new UIElement({ zIndex: 25, sprite: lobbySprite, onTap: this.onLobby }));
  }
}
