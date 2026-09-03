import { Capacitor } from '@capacitor/core';
import { HotUpdateManager } from './hotUpdateManager';
import { CapacitorHotUpdateStorage } from './capacitorHotUpdateStorage';
import { FetchHotUpdateDownloader } from './fetchHotUpdateDownloader';

declare const HOT_UPDATE_NATIVE_BUILD: number;

/**
 * Published by .github/workflows/client-deploy.yml alongside the web build — see
 * design/IOS_DEPLOY.md.
 *
 * This used to be https://bigtaoo.github.io/PIXIJSGAME/mobile/latest/manifest.json, and that
 * URL still answers 200 — which is exactly why the breakage was invisible. The GitHub Pages
 * pipeline was retired in 55fbe03, so the tree behind it is frozen at the build before it:
 * every installed app kept polling a manifest that could never change again, with no error to
 * notice. Releases go to Cloudflare now.
 *
 * A hot-update fetch is cross-origin from the Capacitor WebView (capacitor://localhost on iOS,
 * https://localhost on Android) and goes through plain fetch, not CapacitorHttp — so the host
 * must send Access-Control-Allow-Origin. Pages sent it implicitly; Workers static assets does
 * not, so client-deploy.yml stages a _headers file for /mobile/latest/* and verifies it. Do not
 * point this at a host that has not been checked for that header.
 */
export const MOBILE_MANIFEST_URL = 'https://c.gamestao.com/mobile/latest/manifest.json';

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
