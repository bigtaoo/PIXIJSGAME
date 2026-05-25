import * as PIXI from 'pixi.js-legacy';
import { IAssetsManager } from '../assetsManager/IAssetsManager';
import { InputManager } from '../inputSystem/inputManager';
import { AudioManager } from './audioManager';

/**
 * Optional platform-specific hooks injected by the platform entry point
 * (e.g. crazygamesIndex.ts).  Game code calls these without knowing which
 * platform is active — on web/wechat builds the field is simply absent.
 */
export interface PlatformCallbacks {
  /** Signal that interactive gameplay has started. */
  gameplayStart(): void;
  /** Signal that interactive gameplay has paused or ended. */
  gameplayStop(): void;
  /**
   * Show a throttled interstitial ad.
   * Resolves immediately when the throttle window has not yet elapsed.
   */
  requestInterstitialAd(): Promise<void>;
  /**
   * Show a rewarded ad and return true if the player watched it to completion.
   * Returns false if no ad is available or the player dismissed it.
   */
  requestExtraLife(): Promise<boolean>;
}

export interface AppContext {
  assets: IAssetsManager;
  input: InputManager;
  renderer: PIXI.Renderer;
  audio: AudioManager;
  /** Present only on platforms that support ad / lifecycle callbacks. */
  platform?: PlatformCallbacks;
}
