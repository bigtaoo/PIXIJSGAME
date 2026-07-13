import { Capacitor } from '@capacitor/core';
import { HotUpdateManager } from './hotUpdateManager';
import { CapacitorHotUpdateStorage } from './capacitorHotUpdateStorage';
import { FetchHotUpdateDownloader } from './fetchHotUpdateDownloader';

declare const HOT_UPDATE_NATIVE_BUILD: number;

/** Published by .github/workflows/deploy.yml alongside the web build — see design/IOS_DEPLOY.md. */
export const MOBILE_MANIFEST_URL =
  'https://bigtaoo.github.io/PIXIJSGAME/mobile/latest/manifest.json';

/**
 * Fire-and-forget hot-update check. Never blocks or throws into the caller —
 * a failed/skipped check just means the app keeps running whatever version
 * is already active. Any downloaded update takes effect on the next cold
 * start (see ios/App/App/HotUpdatePlugin.swift).
 */
export async function runHotUpdateCheck(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const manager = new HotUpdateManager({
    manifestUrl: MOBILE_MANIFEST_URL,
    currentNativeBuild: HOT_UPDATE_NATIVE_BUILD,
    storage: new CapacitorHotUpdateStorage(),
    downloader: new FetchHotUpdateDownloader(),
  });

  try {
    const result = await manager.checkForUpdate();
    console.log('[hotUpdate]', result);
  } catch (err) {
    console.error('[hotUpdate] check failed:', err);
  }
}
