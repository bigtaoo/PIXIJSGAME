import { registerPlugin } from '@capacitor/core';

export interface HotUpdateNativePlugin {
  /** Persists `buildId` as the active Capacitor live-update snapshot for the next cold start. */
  activate(options: { buildId: string }): Promise<void>;
  /** Clears the active snapshot so the next cold start falls back to the app-bundled build. */
  reset(): Promise<void>;
}

/** Backed by ios/App/App/HotUpdatePlugin.swift, which wraps Capacitor's built-in serverBasePath mechanism. */
export const HotUpdateNative = registerPlugin<HotUpdateNativePlugin>('HotUpdate');
