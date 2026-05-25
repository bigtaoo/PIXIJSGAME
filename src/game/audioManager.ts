/**
 * audioManager.ts
 *
 * Centralised audio for the game.
 *
 * Background music
 *   - Lazy-loaded on first call to ensureBgMusic() / playBgMusic()
 *   - Loops indefinitely
 *   - Enabled state persisted via IPlayerPrefs (key "music_enabled")
 *
 * Sound effects (fire-and-forget)
 *   - click    : any button or cell tap
 *   - addtime  : bonus seconds awarded (eliminatePair)
 *   - victory  : all targets cleared / daily challenge ends with score > 0
 *   - gameover : time-up with no lives left
 */

import { IPlayerPrefs } from '../playerPrefs/IPlayerPrefs';

import musicBgUrl   from '../assets/music_bg_web.ogg';
import clickUrl     from '../assets/click.ogg';
import addtimeUrl   from '../assets/addtime.ogg';
import victoryUrl   from '../assets/victory.ogg';
import gameoverUrl  from '../assets/gameover.ogg';

const PREF_KEY = 'music_enabled';

export class AudioManager {
  // ── Background music ────────────────────────────────────────────────────────
  private bgAudio: HTMLAudioElement | null = null;
  private musicEnabled: boolean;

  // ── SFX pool (simple single-instance; fine for short clips) ─────────────────
  private readonly sfx: Record<string, HTMLAudioElement> = {};

  constructor(private readonly prefs: IPlayerPrefs) {
    this.musicEnabled = prefs.getInt(PREF_KEY, 1) === 1;
  }

  // ── Public: music control ───────────────────────────────────────────────────

  /** Call once the browser has received a user gesture so autoplay is allowed. */
  public playBgMusic(): void {
    this.ensureBgMusic();
    if (this.musicEnabled && this.bgAudio) {
      this.bgAudio.play().catch(() => {/* autoplay blocked — silent */});
    }
  }

  public stopBgMusic(): void {
    this.bgAudio?.pause();
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

  // ── Public: sound effects ───────────────────────────────────────────────────

  public playClick(): void   { this.playSfx('click',   clickUrl);   }
  public playAddTime(): void { this.playSfx('addtime', addtimeUrl); }
  public playVictory(): void { this.playSfx('victory', victoryUrl); }
  public playGameOver(): void { this.playSfx('gameover', gameoverUrl); }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private ensureBgMusic(): void {
    if (this.bgAudio) return;
    const audio   = new Audio(musicBgUrl);
    audio.loop    = true;
    audio.preload = 'none'; // lazy — browser won't fetch until play() is called
    audio.volume  = 0.6;
    this.bgAudio  = audio;
  }

  private playSfx(key: string, url: string): void {
    let audio = this.sfx[key];
    if (!audio) {
      audio = new Audio(url);
      audio.preload = 'auto';
      this.sfx[key] = audio;
    }
    // Clone and play so overlapping calls don't conflict
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = 0.8;
    clone.play().catch(() => {/* autoplay blocked — silent */});
  }
}
