/**
 * IAudioManager
 *
 * Platform-agnostic audio interface. Both WebAudioManager (wraps HTMLAudioElement)
 * and WechatAudioManager (wraps wx.createInnerAudioContext) implement this.
 */
export interface IAudioManager {
  /** Start background music (requires prior user gesture on web). */
  playBgMusic(): void;
  /** Pause background music. */
  stopBgMusic(): void;
  /** Toggle music on/off; persists the setting. Returns new enabled state. */
  toggleMusic(): boolean;
  /** Whether background music is currently enabled. */
  isMusicEnabled(): boolean;

  playClick(): void;
  playAddTime(): void;
  playVictory(): void;
  playGameOver(): void;
}
