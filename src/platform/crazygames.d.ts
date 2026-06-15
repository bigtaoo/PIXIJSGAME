/**
 * CrazyGames SDK v3 type declarations
 * https://docs.crazygames.com/sdk/html5/
 */

declare namespace CrazyGames {
  // ── Ad types ──────────────────────────────────────────────────────

  type AdType = 'interstitial' | 'rewarded';

  interface AdCallbacks {
    adStarted?: () => void;
    adError?: (error: unknown) => void;
    adFinished?: () => void;
  }

  interface AdModule {
    /** Request an interstitial or rewarded ad. */
    requestAd(type: AdType, callbacks: AdCallbacks): void;
    /** Whether the current environment has an adblocker active. */
    hasAdblock: boolean;
  }

  // ── Banner module ─────────────────────────────────────────────────
  // In SDK v3 banners are a separate module (SDK.banner), NOT part of SDK.ad.

  interface BannerOptions {
    /** DOM element id of the container the banner is rendered into. */
    id: string;
    width: number;
    height: number;
  }

  interface BannerModule {
    /**
     * Request a fixed-size banner into a container element.
     * Rejects on error (e.g. refreshed too often, banners disabled).
     */
    requestBanner(options: BannerOptions | BannerOptions[]): Promise<void>;
    /** Request a banner that fills the given container responsively. */
    requestResponsiveBanner(containerId: string | string[]): Promise<void>;
    /** Remove the banner in the given container. */
    clearBanner(containerId: string): void;
    /** Remove all banners. */
    clearAllBanners(): void;
  }

  // ── Game module ───────────────────────────────────────────────────

  interface GameModule {
    /** Call at the very start of loading (before any assets). */
    loadingStart(): void;
    /** Call when loading is complete and the game is ready to play. */
    loadingStop(): void;
    /** Call when interactive gameplay begins (e.g. round start). */
    gameplayStart(): void;
    /** Call when gameplay pauses or ends (e.g. round over, menu open). */
    gameplayStop(): void;
    /** Call before the page is reloaded or navigated away. */
    sdkGameLoadingStart(): void;
  }

  // ── User module ───────────────────────────────────────────────────

  interface CrazyGamesUser {
    userId: string;
    username: string;
    profilePictureUrl?: string;
  }

  interface UserModule {
    /** Whether the user account system is available in this environment. */
    isUserAccountAvailable: boolean;
    /** Get the currently logged-in user, or null if not logged in. */
    getUser(): Promise<CrazyGamesUser | null>;
    /** Get a short-lived auth token for server-side verification. */
    getUserToken(): Promise<string | null>;
    /** Show the CrazyGames login dialog. */
    showAuthPrompt(): Promise<CrazyGamesUser | null>;
    /** Show the account link dialog (links guest account to CrazyGames account). */
    showAccountLinkPrompt(): Promise<void>;
    /** Subscribe to auth state changes. Returns unsubscribe function. */
    addAuthListener(callback: (user: CrazyGamesUser | null) => void): () => void;
    /**
     * Submit a leaderboard score (MVP). Pass both the AES-GCM encrypted score
     * and the plaintext score. The API never reports success/failure to the
     * client (anti-cheat validation happens server-side).
     */
    submitScore(args: { encryptedScore: string; score: number }): Promise<void>;
  }

  // ── Environment ───────────────────────────────────────────────────

  interface EnvironmentModule {
    /** Whether the SDK is running inside the CrazyGames iframe. */
    isOnCrazyGames: boolean;
    /** Current language code (e.g. "en", "de"). */
    language: string;
    /** Current country code (e.g. "US", "DE"). */
    country: string;
  }

  // ── Top-level SDK ─────────────────────────────────────────────────

  interface ISDK {
    /** Must be called once before using any other SDK methods. */
    init(): Promise<void>;

    ad: AdModule;
    banner: BannerModule;
    game: GameModule;
    user: UserModule;
    environment: EnvironmentModule;
  }
}

interface Window {
  CrazyGames: {
    SDK: CrazyGames.ISDK;
  };
}
