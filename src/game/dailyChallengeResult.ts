/**
 * dailyChallengeResult.ts
 *
 * Result overlay shown when the 90-second Daily Challenge timer expires.
 *
 * Displays:
 *   - Final score
 *   - Today's personal best
 *   - Consecutive-streak count
 *   - "Play Again" and "Lobby" buttons
 *   - CrazyGames leaderboard submission (fire-and-forget, silent on failure)
 */
import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';
import { drawPanel, C } from './graphicsFactory';
import { getDailyBestScore, getStreakDays } from './dailyChallengeStore';
import { GAME_WIDTH } from './consts';

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
  if (!ENCRYPTION_KEY) return;                       // not configured yet
  const sdk = (window as unknown as Record<string, unknown>)['CrazyGames'];
  if (!sdk) return;                                  // SDK not loaded (non-CrazyGames env)

  encryptScore(score, ENCRYPTION_KEY)
    .then(enc => {
      (sdk as { SDK: { user: { submitScore: (o: object) => void } } })
        .SDK.user.submitScore({ encryptedScore: enc });
    })
    .catch(() => { /* silent — CrazyGames always returns true anyway */ });
}

// ── Panel layout constants ─────────────────────────────────────────────────────

const PANEL_W = 720;
const PANEL_H = 580;
const PANEL_X = (GAME_WIDTH - PANEL_W) / 2;
const PANEL_Y = 650;

// ── DailyChallengeResult ───────────────────────────────────────────────────────

export class DailyChallengeResult extends PIXI.Container {
  private scoreText!:     PIXI.Text;
  private bestText!:      PIXI.Text;
  private streakText!:    PIXI.Text;
  private newBestBadge!:  PIXI.Text;

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

  /**
   * Show the overlay with the given final score.
   * Handles personal-best comparison and leaderboard submission internally.
   */
  public show(score: number, isNewBest: boolean): void {
    this.scoreText.text    = score.toString();
    this.bestText.text     = `最佳  ${getDailyBestScore()}`;
    this.streakText.text   = `连续挑战  ${getStreakDays()}  天`;
    this.newBestBadge.visible = isNewBest;

    submitScoreToCrazyGames(score);
    this.visible = true;
  }

  public hide(): void {
    this.visible = false;
  }

  // ── UI construction ────────────────────────────────────────────────────────

  private buildPanel(ctx: AppContext): void {
    // Background panel
    const bg = new PIXI.Graphics();
    drawPanel(bg, PANEL_W, PANEL_H);
    bg.x = PANEL_X;
    bg.y = PANEL_Y;
    this.addChild(bg);

    const cx = PANEL_X + PANEL_W / 2;

    // Title
    const title = new PIXI.Text('每日挑战结束', {
      fontFamily: 'Arial',
      fontSize:   52,
      fontWeight: 'bold',
      fill:       C.icon,
    });
    title.anchor.set(0.5, 0);
    title.x = cx;
    title.y = PANEL_Y + 40;
    this.addChild(title);

    // Score (large)
    this.scoreText = new PIXI.Text('0', {
      fontFamily: 'Arial',
      fontSize:   110,
      fontWeight: 'bold',
      fill:       0x2c6e49,
    });
    this.scoreText.anchor.set(0.5, 0);
    this.scoreText.x = cx;
    this.scoreText.y = PANEL_Y + 110;
    this.addChild(this.scoreText);

    // "NEW BEST" badge
    this.newBestBadge = new PIXI.Text('NEW BEST ★', {
      fontFamily: 'Arial',
      fontSize:   32,
      fontWeight: 'bold',
      fill:       0xEAB830,
    });
    this.newBestBadge.anchor.set(0.5, 0);
    this.newBestBadge.x = cx;
    this.newBestBadge.y = PANEL_Y + 230;
    this.newBestBadge.visible = false;
    this.addChild(this.newBestBadge);

    // Personal best
    this.bestText = new PIXI.Text('最佳  0', {
      fontFamily: 'Arial',
      fontSize:   38,
      fill:       C.icon,
    });
    this.bestText.anchor.set(0.5, 0);
    this.bestText.x = cx;
    this.bestText.y = PANEL_Y + 285;
    this.addChild(this.bestText);

    // Streak
    this.streakText = new PIXI.Text('连续挑战  0  天', {
      fontFamily: 'Arial',
      fontSize:   36,
      fill:       C.icon,
    });
    this.streakText.anchor.set(0.5, 0);
    this.streakText.x = cx;
    this.streakText.y = PANEL_Y + 340;
    this.addChild(this.streakText);

    // Buttons
    this.buildButtons(ctx);
  }

  private buildButtons(ctx: AppContext): void {
    const btnSize  = 160;
    const gap      = 80;
    const totalW   = btnSize * 2 + gap;
    const startX   = PANEL_X + (PANEL_W - totalW) / 2;
    const btnY     = PANEL_Y + PANEL_H - btnSize - 50;

    // "Play Again" — retry icon
    const retryG = new PIXI.Graphics();
    this.drawCircleBtn(retryG, btnSize, 0x2c6e49);
    retryG.x = startX;
    retryG.y = btnY;
    this.addChild(retryG);

    const retryLabel = new PIXI.Text('再玩', { fontFamily: 'Arial', fontSize: 34, fill: 0xffffff, fontWeight: 'bold' });
    retryLabel.anchor.set(0.5, 0.5);
    retryLabel.x = startX + btnSize / 2;
    retryLabel.y = btnY  + btnSize / 2;
    this.addChild(retryLabel);

    const retrySprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    retrySprite.width  = btnSize;
    retrySprite.height = btnSize;
    retrySprite.x = startX;
    retrySprite.y = btnY;
    retrySprite.interactive = false;
    this.addChild(retrySprite);
    ctx.input.registerUI(new UIElement({ zIndex: 25, sprite: retrySprite, onTap: this.onPlayAgain }));

    // "Lobby" — grid icon
    const lobbyX = startX + btnSize + gap;
    const lobbyG = new PIXI.Graphics();
    this.drawCircleBtn(lobbyG, btnSize, C.icon);
    lobbyG.x = lobbyX;
    lobbyG.y = btnY;
    this.addChild(lobbyG);

    const lobbyLabel = new PIXI.Text('大厅', { fontFamily: 'Arial', fontSize: 34, fill: 0xffffff, fontWeight: 'bold' });
    lobbyLabel.anchor.set(0.5, 0.5);
    lobbyLabel.x = lobbyX + btnSize / 2;
    lobbyLabel.y = btnY   + btnSize / 2;
    this.addChild(lobbyLabel);

    const lobbySprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    lobbySprite.width  = btnSize;
    lobbySprite.height = btnSize;
    lobbySprite.x = lobbyX;
    lobbySprite.y = btnY;
    lobbySprite.interactive = false;
    this.addChild(lobbySprite);
    ctx.input.registerUI(new UIElement({ zIndex: 25, sprite: lobbySprite, onTap: this.onLobby }));
  }

  private drawCircleBtn(g: PIXI.Graphics, size: number, color: number): void {
    const r = size / 2;
    g.lineStyle(0);
    g.beginFill(color);
    g.drawCircle(r, r, r);
    g.endFill();
  }
}
