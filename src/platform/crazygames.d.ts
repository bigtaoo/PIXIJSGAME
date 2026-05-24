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

  interface BannerSize {
    width: number;
    height: number;
  }

  interface BannerOptions {
    id: string;
    containerId: string;
    size?: [number, number]; // [width, height]
  }

  interface AdModule {
    /** Request an interstitial or rewarded ad. */
    requestAd(type: AdType, callbacks: AdCallbacks): void;
    /** Request a banner ad. The container element must exist in the DOM. */
    requestBanner(options: BannerOptions): void;
    /** Remove a banner ad by id. */
    clearBanner(id: string): void;
    /** Whether the current environment supports ads. */
    hasAdblock: boolean;
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

  // ── Leaderboard ───────────────────────────────────────────────────

  interface LeaderboardScore {
    userId: string;
    username: string;
    score: number;
    profilePictureUrl?: string;
  }

  interface LeaderboardModule {
    /** Save a score for the current user. */
    saveScore(levelId: string, score: number): Promise<void>;
    /** Get the top scores for a level. */
    getScores(levelId: string, maxCount?: number): Promise<LeaderboardScore[]>;
  }

  // ── Top-level SDK ─────────────────────────────────────────────────

  interface ISDK {
    /** Must be called once before using any other SDK methods. */
    init(): Promise<void>;

    ad: AdModule;
    game: GameModule;
    user: UserModule;
    environment: EnvironmentModule;
    leaderboard: LeaderboardModule;
  }
}

interface Window {
  CrazyGames: {
    SDK: CrazyGames.ISDK;
  };
}
