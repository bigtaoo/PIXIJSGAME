/**
 * CrazyGamesService
 *
 * Wraps the CrazyGames SDK v3 and exposes a clean, game-friendly API.
 * Import and use this only from crazygamesIndex.ts — it must never be
 * imported by web/wechat entry points so it doesn't end up in their bundles.
 *
 * Usage:
 *   const cg = new CrazyGamesService();
 *   await cg.init();
 *   cg.loadingStart();
 *   // ... load assets ...
 *   cg.loadingStop();
 *
 *   // Before a game round:
 *   cg.gameplayStart();
 *   // When round ends / menu opens:
 *   cg.gameplayStop();
 *
 *   // Show interstitial between rounds:
 *   await cg.showInterstitialAd();
 *
 *   // Show rewarded ad and wait for completion:
 *   const watched = await cg.showRewardedAd();
 *   if (watched) grantReward();
 */

export class CrazyGamesService {
  private sdk: CrazyGames.ISDK | null = null;
  private _initialized = false;
  private _lastInterstitialMs = -Infinity;

  /** Dev-only logging - stripped from production builds. */
  private log(msg: string): void {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[CrazyGames]', msg);
    }
  }

  // ── Init ──────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (!window.CrazyGames?.SDK) {
      console.warn('[CrazyGames] SDK not found on window. Running in offline/dev mode.');
      return;
    }
    await window.CrazyGames.SDK.init();
    this.sdk = window.CrazyGames.SDK;
    this._initialized = true;
    this.log('SDK initialized.');
  }

  get isAvailable(): boolean {
    return this._initialized && this.sdk !== null;
  }

  // ── Loading events ────────────────────────────────────────────────

  /** Call before starting to load game assets. */
  loadingStart(): void {
    this.sdk?.game.loadingStart();
  }

  /** Call when all assets are loaded and the game is ready to render. */
  loadingStop(): void {
    this.sdk?.game.loadingStop();
  }

  // ── Gameplay events ───────────────────────────────────────────────

  /** Call when interactive gameplay begins (round starts, player is in control). */
  gameplayStart(): void {
    this.sdk?.game.gameplayStart();
  }

  /**
   * Call when gameplay is paused or a round ends
   * (menu open, game over screen, between levels, etc.).
   * The SDK uses these signals to decide when it's safe to show ads.
   */
  gameplayStop(): void {
    this.sdk?.game.gameplayStop();
  }

  // ── Ads ───────────────────────────────────────────────────────────

  /**
   * Show an interstitial ad (non-skippable, shown between natural breaks).
   * Returns a promise that resolves when the ad is finished or errors.
   *
   * Important: call gameplayStop() before and gameplayStart() after if needed.
   */
  showInterstitialAd(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.sdk) {
        resolve();
        return;
      }
      this.sdk.ad.requestAd('interstitial', {
        adStarted: () => {
          this.log('Interstitial ad started.');
        },
        adError: (err) => {
          console.warn('[CrazyGames] Interstitial ad error:', err);
          resolve();
        },
        adFinished: () => {
          this.log('Interstitial ad finished.');
          resolve();
        },
      });
    });
  }

  /**
   * Show an interstitial ad at most once per `minIntervalMs` milliseconds.
   * Resolves immediately (without showing an ad) when called within the
   * throttle window.  Always resolves — never rejects.
   *
   * @param minIntervalMs  Minimum gap between ads in ms (default: 10 minutes).
   */
  showInterstitialAdThrottled(minIntervalMs = 10 * 60 * 1000): Promise<void> {
    const now = Date.now();
    if (now - this._lastInterstitialMs < minIntervalMs) {
      return Promise.resolve();
    }
    this._lastInterstitialMs = now;
    return this.showInterstitialAd();
  }

  /**
   * Show a rewarded ad. Returns true if the player watched it to completion,
   * false if it errored or wasn't shown.
   */
  showRewardedAd(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.sdk) {
        resolve(false);
        return;
      }
      let finished = false;
      this.sdk.ad.requestAd('rewarded', {
        adStarted: () => {
          this.log('Rewarded ad started.');
        },
        adError: (err) => {
          console.warn('[CrazyGames] Rewarded ad error:', err);
          resolve(false);
        },
        adFinished: () => {
          this.log('Rewarded ad finished.');
          finished = true;
          resolve(true);
        },
      });
      // Safety fallback — if neither callback fires resolve false
      setTimeout(() => {
        if (!finished) resolve(false);
      }, 30_000);
    });
  }

  /**
   * Request a banner ad into a DOM container.
   * Never throws — banner failures (refresh throttling, banners disabled
   * during basic launch, adblock) are caught and logged.
   * @param containerId  DOM element id of the container div.
   * @param size         Optional [width, height] in px. Omit for responsive.
   */
  async requestBanner(containerId: string, size?: [number, number]): Promise<void> {
    if (!this.sdk) return;
    try {
      if (size) {
        await this.sdk.banner.requestBanner({
          id: containerId,
          width: size[0],
          height: size[1],
        });
      } else {
        await this.sdk.banner.requestResponsiveBanner(containerId);
      }
    } catch (err) {
      console.warn('[CrazyGames] Banner request failed:', err);
    }
  }

  /** Remove a banner ad from its container. */
  clearBanner(containerId: string): void {
    this.sdk?.banner.clearBanner(containerId);
  }

  /** Whether the player has an adblocker active. */
  get hasAdblock(): boolean {
    return this.sdk?.ad.hasAdblock ?? false;
  }

  // ── User ──────────────────────────────────────────────────────────

  /** Returns true if the CrazyGames user account system is available. */
  get isUserAccountAvailable(): boolean {
    return this.sdk?.user.isUserAccountAvailable ?? false;
  }

  /**
   * Get the currently logged-in CrazyGames user.
   * Returns null if the player is not logged in.
   */
  async getUser(): Promise<CrazyGames.CrazyGamesUser | null> {
    if (!this.sdk) return null;
    return this.sdk.user.getUser();
  }

  /**
   * Get a short-lived JWT for server-side user verification.
   * Returns null if not logged in.
   */
  async getUserToken(): Promise<string | null> {
    if (!this.sdk) return null;
    return this.sdk.user.getUserToken();
  }

  /**
   * Show the CrazyGames login dialog.
   * Returns the logged-in user, or null if cancelled.
   */
  async showAuthPrompt(): Promise<CrazyGames.CrazyGamesUser | null> {
    if (!this.sdk) return null;
    return this.sdk.user.showAuthPrompt();
  }

  /**
   * Subscribe to auth state changes.
   * Returns an unsubscribe function — call it when the game shuts down.
   */
  onAuthChange(callback: (user: CrazyGames.CrazyGamesUser | null) => void): () => void {
    if (!this.sdk) return () => {};
    return this.sdk.user.addAuthListener(callback);
  }

  // ── Leaderboard ───────────────────────────────────────────────────

  /**
   * Submit a score for the current user.
   * @param levelId  Level/board identifier configured in the CrazyGames dashboard.
   * @param score    The score value to save.
   */
  async saveScore(levelId: string, score: number): Promise<void> {
    if (!this.sdk) return;
    await this.sdk.leaderboard.saveScore(levelId, score);
  }

  /**
   * Retrieve the top scores for a level.
   * @param levelId   Level/board identifier.
   * @param maxCount  Max number of scores to return (default 10).
   */
  async getScores(levelId: string, maxCount = 10): Promise<CrazyGames.LeaderboardScore[]> {
    if (!this.sdk) return [];
    return this.sdk.leaderboard.getScores(levelId, maxCount);
  }

  // ── Page lifecycle ────────────────────────────────────────────────

  /**
   * Call this in a `beforeunload` handler so CrazyGames knows the page is
   * intentionally reloading or navigating away (not crashing).
   */
  sdkGameLoadingStart(): void {
    this.sdk?.game.sdkGameLoadingStart();
  }

  // ── Environment ───────────────────────────────────────────────────

  /** True when running inside the CrazyGames platform iframe. */
  get isOnCrazyGames(): boolean {
    return this.sdk?.environment.isOnCrazyGames ?? false;
  }

  /** The player's browser language (e.g. "en", "de"). */
  get language(): string {
    return this.sdk?.environment.language ?? navigator.language.split('-')[0];
  }
}

/** Singleton — import and use anywhere in the CrazyGames build. */
export const crazyGames = new CrazyGamesService();
