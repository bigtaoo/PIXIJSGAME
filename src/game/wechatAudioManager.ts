/**
 * wechatAudioManager.ts
 *
 * WeChat mini-game audio manager.
 * Uses wx.createInnerAudioContext() instead of HTMLAudioElement.
 *
 * Background music loops indefinitely; SFX contexts are created per-play
 * and destroyed on completion to avoid accumulating stale contexts.
 */
import { IPlayerPrefs } from '../playerPrefs/IPlayerPrefs';
import { IAudioManager } from './IAudioManager';

const PREF_KEY = 'music_enabled';

// Asset paths relative to the mini-game package root.
const SRC_MUSIC    = 'assets/music_bg_web.ogg';
const SRC_CLICK    = 'assets/click.ogg';
const SRC_ADDTIME  = 'assets/addtime.ogg';
const SRC_VICTORY  = 'assets/victory.ogg';
const SRC_GAMEOVER = 'assets/gameover.ogg';

export class WechatAudioManager implements IAudioManager {
  private bgCtx: WechatMinigame.InnerAudioContext | null = null;
  private musicEnabled: boolean;

  constructor(private readonly prefs: IPlayerPrefs) {
    this.musicEnabled = prefs.getInt(PREF_KEY, 1) === 1;
  }

  // ── Background music ──────────────────────────────────────────────────────

  public playBgMusic(): void {
    this.ensureBgCtx();
    if (this.musicEnabled && this.bgCtx) {
      this.bgCtx.play();
    }
  }

  public stopBgMusic(): void {
    this.bgCtx?.pause();
  }

  public toggleMusic(): boolean {
    this.musicEnabled = !this.musicEnabled;
    this.prefs.setInt(PREF_KEY, this.musicEnabled ? 1 : 0);
    if (this.musicEnabled) {
      this.playBgMusic();
    } else {
      this.stopBgMusic();
    }
    return this.musicEnabled;
  }

  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  // ── Sound effects ─────────────────────────────────────────────────────────

  public playClick(): void    { this.playSfx(SRC_CLICK);    }
  public playAddTime(): void  { this.playSfx(SRC_ADDTIME);  }
  public playVictory(): void  { this.playSfx(SRC_VICTORY);  }
  public playGameOver(): void { this.playSfx(SRC_GAMEOVER); }

  // ── Private ───────────────────────────────────────────────────────────────

  private ensureBgCtx(): void {
    if (this.bgCtx) return;
    const ctx  = wx.createInnerAudioContext();
    ctx.src    = SRC_MUSIC;
    ctx.loop   = true;
    ctx.volume = 0.6;
    this.bgCtx = ctx;
  }

  /**
   * Create a one-shot context, play it, then destroy it when done.
   * WeChat limits the number of concurrent InnerAudioContexts (~10),
   * so we must release them promptly.
   */
  private playSfx(src: string): void {
    const ctx  = wx.createInnerAudioContext();
    ctx.src    = src;
    ctx.volume = 0.8;
    ctx.play();
    const cleanup = (): void => {
      ctx.offEnded(cleanup);
      ctx.offError(cleanup);
      ctx.destroy();
    };
    ctx.onEnded(cleanup);
    ctx.onError(cleanup);
  }
}
