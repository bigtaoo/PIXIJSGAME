/**
 * GameDistributionService
 *
 * Wraps the GameDistribution HTML5 SDK and exposes a game-friendly API.
 * Import this ONLY from gdIndex.ts so it never leaks into the web / wechat /
 * crazygames / telegram bundles.
 *
 * The SDK itself is loaded by public/gamedistribution.html, which also defines
 * window.GD_OPTIONS. Its onEvent handler re-dispatches every SDK event as a DOM
 * CustomEvent ('gd-sdk-event'); this service subscribes to that.
 *
 * Docs: https://github.com/GameDistribution/GD-HTML5/wiki/SDK-Implementation
 */

interface GdEvent {
  name: string;
  message?: string;
}

interface Gdsdk {
  /** Show an interstitial (no arg) or a typed ad, e.g. showAd('rewarded'). */
  showAd(type?: string): Promise<void>;
  /** Preload a typed ad, e.g. preloadAd('rewarded'). */
  preloadAd(type: string): Promise<void>;
  openConsole?(): void;
}

declare global {
  interface Window {
    gdsdk?: Gdsdk;
    GD_OPTIONS?: unknown;
  }
}

/** Lifecycle hooks driven by the SDK's pause/resume events. */
export interface GdLifecycleHooks {
  /** SDK_GAME_PAUSE — a video ad is about to play: pause AND mute the game. */
  onPause(): void;
  /** SDK_GAME_START — the ad finished: resume the game and unmute. */
  onResume(): void;
}

export class GameDistributionService {
  private _ready = false;
  private _rewardWatched = false;
  private hooks: GdLifecycleHooks | null = null;

  private log(msg: string): void {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[GD]', msg);
    }
  }

  /** Register lifecycle hooks and start listening for SDK events. */
  init(hooks: GdLifecycleHooks): void {
    this.hooks = hooks;
    window.addEventListener('gd-sdk-event', (e: Event) => {
      this.handleEvent((e as CustomEvent<GdEvent>).detail);
    });
  }

  private handleEvent(event: GdEvent): void {
    switch (event.name) {
      case 'SDK_READY':
        this._ready = true;
        this.log('SDK ready.');
        break;
      case 'SDK_GAME_PAUSE':
        this.hooks?.onPause();
        break;
      case 'SDK_GAME_START':
        this.hooks?.onResume();
        break;
      case 'SDK_REWARDED_WATCH_COMPLETE':
        this._rewardWatched = true;
        this.log('Rewarded watch complete.');
        break;
      default:
        break;
    }
  }

  get isReady(): boolean {
    return this._ready;
  }

  private get sdk(): Gdsdk | undefined {
    return window.gdsdk;
  }

  /**
   * Show an interstitial (mid-roll) ad. GameDistribution throttles ad
   * frequency internally, so it is safe to call on every level transition.
   * MUST be invoked from a user-input handler (mouse/touch up).
   * Always resolves — never rejects.
   */
  async showInterstitial(): Promise<void> {
    const sdk = this.sdk;
    if (!sdk || typeof sdk.showAd !== 'function') return;
    try {
      await sdk.showAd();
    } catch (err) {
      this.log('Interstitial skipped/failed: ' + String(err));
    }
  }

  /**
   * Preload and show a rewarded ad. Resolves true only when the player watched
   * it to completion (SDK_REWARDED_WATCH_COMPLETE), false otherwise.
   * MUST be invoked from a user-input handler (mouse/touch up).
   */
  async showRewarded(): Promise<boolean> {
    const sdk = this.sdk;
    if (!sdk || typeof sdk.showAd !== 'function') return false;
    this._rewardWatched = false;
    try {
      if (typeof sdk.preloadAd === 'function') {
        await sdk.preloadAd('rewarded');
      }
      await sdk.showAd('rewarded');
      return this._rewardWatched;
    } catch (err) {
      this.log('Rewarded ad failed: ' + String(err));
      return false;
    }
  }
}

/** Singleton — import and use anywhere in the GameDistribution build. */
export const gd = new GameDistributionService();
