/**
 * dailyChallengeResult.ts
 *
 * Result overlay shown when the 90-second Daily Challenge timer expires.
 */
import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';
import { drawPanel } from './graphicsFactory';
import { getDailyBestScore, getStreakDays } from './dailyChallengeStore';
import { GAME_WIDTH } from './consts';
import { DigitDisplay } from './digitDisplay';
import { ScreenConfig } from './screenConfig';

// ── CrazyGames leaderboard (optional) ─────────────────────────────────────────
const ENCRYPTION_KEY = '';   // TODO: set before going live

async function encryptScore(score: number, key: string): Promise<string> {
  const iv       = window.crypto.getRandomValues(new Uint8Array(12));
  const alg: AesGcmParams = { name: 'AES-GCM', iv };
  const keyBytes = Uint8Array.from(atob(key), c => c.charCodeAt(0));
  const cryptoKey = await window.crypto.subtle.importKey('raw', keyBytes, alg, false, ['encrypt']);
  const data      = new TextEncoder().encode(score.toString());
  const encrypted = await window.crypto.subtle.encrypt(alg, cryptoKey, data);
  const combined  = new Uint8Array(12 + encrypted.byteLength);
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

// ── Layout ────────────────────────────────────────────────────────────────────

interface DailyChallengeResultLayout {
  panelW: number; panelH: number; panelX: number; panelY: number;
  scoreDigitW: number; scoreDigitH: number; scoreY: number;
  rowIconW: number; rowIconH: number;
  rowDigitW: number; rowDigitH: number; rowGap: number;
  bestRowY: number; streakRowY: number;
  btnSize: number; btnGap: number; btnY: number;
}

function buildLayout(screenW: number, screenH: number): DailyChallengeResultLayout {
  const panelW = 720, panelH = 520;
  const panelX = Math.round((screenW - panelW) / 2);
  const panelY = Math.round((screenH - panelH) / 2);
  const scoreDigitH = 110;
  const btnSize = 160;
  return {
    panelW, panelH, panelX, panelY,
    scoreDigitW: Math.round(scoreDigitH * 120 / 160), scoreDigitH,
    scoreY: panelY + 60,
    rowIconW: 36, rowIconH: 36,
    rowDigitW: Math.round(36 * 120 / 160), rowDigitH: 36, rowGap: 8,
    bestRowY: panelY + 220, streakRowY: panelY + 270,
    btnSize, btnGap: 80, btnY: panelY + panelH - btnSize - 40,
  };
}

function getLayout(screen: ScreenConfig): DailyChallengeResultLayout {
  return buildLayout(screen.width, screen.height);
}

// ── DailyChallengeResult ───────────────────────────────────────────────────────

export class DailyChallengeResult extends PIXI.Container {
  private readonly bg:           PIXI.Graphics;
  private readonly scoreDisplay: DigitDisplay;
  private readonly retryBtn:     PIXI.Sprite;
  private readonly lobbyBtn:     PIXI.Sprite;

  // Assigned during buildIconRows() called in constructor — non-readonly intentionally
  private bestDisplay!:   DigitDisplay;
  private streakDisplay!: DigitDisplay;
  private bestRow!:       PIXI.Container;
  private streakRow!:     PIXI.Container;

  private layout:     DailyChallengeResultLayout;
  private lastPanelW = 0;
  private lastPanelH = 0;

  constructor(
    private readonly ctx: AppContext,
    private readonly onPlayAgain: () => void,
    private readonly onLobby:     () => void,
  ) {
    super();
    this.visible = false;

    const L = buildLayout(GAME_WIDTH, Math.round(GAME_WIDTH * 16 / 9));
    this.layout = L;

    this.bg = new PIXI.Graphics();
    this.addChild(this.bg);

    this.scoreDisplay = new DigitDisplay(ctx, L.scoreDigitW, L.scoreDigitH);
    this.scoreDisplay.update(0);
    this.addChild(this.scoreDisplay);

    this.buildIconRows(L);

    this.retryBtn = new PIXI.Sprite(ctx.assets.GetTexture('retry.png'));
    this.addChild(this.retryBtn);
    ctx.input.registerUI(new UIElement({ zIndex: 25, sprite: this.retryBtn, onTap: this.onPlayAgain }));

    this.lobbyBtn = new PIXI.Sprite(ctx.assets.GetTexture('lobby.png'));
    this.addChild(this.lobbyBtn);
    ctx.input.registerUI(new UIElement({ zIndex: 25, sprite: this.lobbyBtn, onTap: this.onLobby }));

    this.applyLayout(L);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public resize(screen: ScreenConfig): void {
    this.layout = getLayout(screen);
    this.applyLayout(this.layout);
  }

  public show(score: number, _isNewBest: boolean): void {
    const L  = this.layout;
    const cx = L.panelX + L.panelW / 2;

    this.scoreDisplay.digitW = L.scoreDigitW;
    this.scoreDisplay.digitH = L.scoreDigitH;
    this.scoreDisplay.update(score);
    this.scoreDisplay.x = cx - this.scoreDisplay.totalWidth / 2;

    const best = getDailyBestScore();
    if (best > 0) {
      this.bestDisplay.update(best);
      const rowW = L.rowIconW + L.rowGap + this.bestDisplay.totalWidth;
      this.bestRow.x       = cx - rowW / 2;
      this.bestRow.visible = true;
    } else {
      this.bestRow.visible = false;
    }

    const streak = getStreakDays();
    this.streakDisplay.update(streak);
    const streakW = L.rowIconW + L.rowGap + this.streakDisplay.totalWidth;
    this.streakRow.x       = cx - streakW / 2;
    this.streakRow.visible = true;

    submitScoreToCrazyGames(score);
    this.visible = true;
  }

  public hide(): void { this.visible = false; }

  // ── Private ────────────────────────────────────────────────────────────────

  /** Build the trophy row + fire row and assign to bestRow / streakRow / bestDisplay / streakDisplay. */
  private buildIconRows(L: DailyChallengeResultLayout): void {
    // Best score row
    const bestCont  = new PIXI.Container();
    const bestIcon  = new PIXI.Sprite(this.ctx.assets.GetTexture('trophy.png'));
    bestIcon.width  = L.rowIconW; bestIcon.height = L.rowIconH;
    bestIcon.x = 0; bestIcon.y = (L.rowDigitH - L.rowIconH) / 2;
    bestCont.addChild(bestIcon);
    this.bestDisplay   = new DigitDisplay(this.ctx, L.rowDigitW, L.rowDigitH);
    this.bestDisplay.x = L.rowIconW + L.rowGap;
    bestCont.addChild(this.bestDisplay);
    this.bestRow = bestCont;
    this.addChild(this.bestRow);

    // Consecutive days (streak) row
    const streakCont  = new PIXI.Container();
    const streakIcon  = new PIXI.Sprite(this.ctx.assets.GetTexture('fire.png'));
    streakIcon.width  = L.rowIconW; streakIcon.height = L.rowIconH;
    streakIcon.x = 0; streakIcon.y = (L.rowDigitH - L.rowIconH) / 2;
    streakCont.addChild(streakIcon);
    this.streakDisplay   = new DigitDisplay(this.ctx, L.rowDigitW, L.rowDigitH);
    this.streakDisplay.x = L.rowIconW + L.rowGap;
    streakCont.addChild(this.streakDisplay);
    this.streakRow = streakCont;
    this.addChild(this.streakRow);
  }

  private applyLayout(L: DailyChallengeResultLayout): void {
    if (L.panelW !== this.lastPanelW || L.panelH !== this.lastPanelH) {
      this.bg.clear();
      drawPanel(this.bg, L.panelW, L.panelH);
      this.lastPanelW = L.panelW; this.lastPanelH = L.panelH;
    }
    this.bg.x = L.panelX; this.bg.y = L.panelY;

    this.scoreDisplay.y = L.scoreY;
    // scoreDisplay.x is set in show() based on content width

    this.bestRow.y   = L.bestRowY;
    this.streakRow.y = L.streakRowY;

    const totalW = L.btnSize * 2 + L.btnGap;
    const startX = L.panelX + (L.panelW - totalW) / 2;

    this.retryBtn.width  = L.btnSize; this.retryBtn.height = L.btnSize;
    this.retryBtn.x = startX;         this.retryBtn.y = L.btnY;

    this.lobbyBtn.width  = L.btnSize; this.lobbyBtn.height = L.btnSize;
    this.lobbyBtn.x = startX + L.btnSize + L.btnGap;
    this.lobbyBtn.y = L.btnY;
  }
}
