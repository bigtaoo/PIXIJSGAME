/**
 * mobileAudioManager.ts
 *
 * AudioContext-based audio manager for iOS and Android (Capacitor).
 * Unlike HTMLAudioElement, AudioContext respects the iOS silent switch.
 *
 * Usage pattern (same as AudioManager):
 *   - Call playBgMusic() inside a pointerdown handler to satisfy autoplay policy.
 *   - SFX are lazy-loaded on first play and cached as AudioBuffer.
 */

import { IPlayerPrefs } from '../playerPrefs/IPlayerPrefs';
import { IAudioManager } from './IAudioManager';

import musicBgUrl from '../assets/music_bg_web.ogg';
import clickUrl from '../assets/click.ogg';
import addtimeUrl from '../assets/addtime.ogg';
import victoryUrl from '../assets/victory.ogg';
import gameoverUrl from '../assets/gameover.ogg';

const PREF_KEY = 'music_enabled';

type SfxKey = 'click' | 'addtime' | 'victory' | 'gameover' | 'bg';

export class MobileAudioManager implements IAudioManager {
  private actx: AudioContext | null = null;
  private musicEnabled: boolean;

  private readonly buffers = new Map<SfxKey, AudioBuffer>();
  private bgSource: AudioBufferSourceNode | null = null;

  constructor(private readonly prefs: IPlayerPrefs) {
    this.musicEnabled = prefs.getInt(PREF_KEY, 1) === 1;
  }

  // ── AudioContext (lazy, created on first user gesture) ──────────────────────

  private context(): AudioContext {
    if (!this.actx) {
      this.actx = new AudioContext();
    }
    return this.actx;
  }

  private async resume(): Promise<void> {
    const ctx = this.context();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  // ── Buffer loading ──────────────────────────────────────────────────────────

  private async fetchBuffer(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    const raw = await res.arrayBuffer();
    return this.context().decodeAudioData(raw);
  }

  private async ensureBuffer(key: SfxKey, url: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(key)) return this.buffers.get(key)!;
    try {
      const buf = await this.fetchBuffer(url);
      this.buffers.set(key, buf);
      return buf;
    } catch (e) {
      console.warn(`[MobileAudioManager] failed to load ${key}:`, e);
      return null;
    }
  }

  // ── Background music ────────────────────────────────────────────────────────

  public playBgMusic(): void {
    this.resume()
      .then(() => this.ensureBuffer('bg', musicBgUrl))
      .then((buf) => {
        if (!buf || !this.musicEnabled) return;
        this.startBgLoop(buf);
      });
  }

  public stopBgMusic(): void {
    try {
      this.bgSource?.stop();
    } catch {
      /* already stopped */
    }
    this.bgSource = null;
  }

  private startBgLoop(buf: AudioBuffer): void {
    this.stopBgMusic();
    const ctx = this.context();
    const gain = ctx.createGain();
    gain.gain.value = 0.6;
    gain.connect(ctx.destination);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(gain);
    src.start();
    this.bgSource = src;
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

  // ── Sound effects ───────────────────────────────────────────────────────────

  public playClick(): void {
    this.playSfx('click', clickUrl, 0.8);
  }
  public playAddTime(): void {
    this.playSfx('addtime', addtimeUrl, 0.8);
  }
  public playVictory(): void {
    this.playSfx('victory', victoryUrl, 0.8);
  }
  public playGameOver(): void {
    this.playSfx('gameover', gameoverUrl, 0.8);
  }

  private playSfx(key: SfxKey, url: string, volume: number): void {
    this.ensureBuffer(key, url).then((buf) => {
      if (!buf) return;
      const ctx = this.context();
      if (ctx.state !== 'running') return;

      const gain = ctx.createGain();
      gain.gain.value = volume;
      gain.connect(ctx.destination);

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(gain);
      src.start();
    });
  }
}
