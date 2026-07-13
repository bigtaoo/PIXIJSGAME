import { Directory, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { HotUpdateState, HotUpdateStorage, EMPTY_STATE } from './hotUpdateTypes';
import { arrayBufferToBase64, sha256Hex } from './base64';
import { HotUpdateNative } from './hotUpdateNativePlugin';

const STATE_KEY = 'hotUpdateState';

// Matches the directory Capacitor's own CAPBridgeViewController.instanceDescriptor()
// already reads from (see ios/App/App/HotUpdatePlugin.swift for the activation side).
// Placing bundles here lets us reuse Capacitor's built-in live-update loading path
// instead of writing a custom WebView-root override.
const ROOT = 'NoCloud/ionic_built_snapshots';

/** @capacitor/filesystem + @capacitor/preferences backed storage, one directory per build under Directory.Library/NoCloud/ionic_built_snapshots/. */
export class CapacitorHotUpdateStorage implements HotUpdateStorage {
  async readState(): Promise<HotUpdateState> {
    const { value } = await Preferences.get({ key: STATE_KEY });
    if (!value) return { ...EMPTY_STATE };
    try {
      return JSON.parse(value) as HotUpdateState;
    } catch {
      return { ...EMPTY_STATE };
    }
  }

  async writeState(state: HotUpdateState): Promise<void> {
    await Preferences.set({ key: STATE_KEY, value: JSON.stringify(state) });
  }

  async dirExists(buildId: string): Promise<boolean> {
    try {
      await Filesystem.stat({ path: `${ROOT}/${buildId}`, directory: Directory.Library });
      return true;
    } catch {
      return false;
    }
  }

  async writeFile(buildId: string, relPath: string, data: ArrayBuffer): Promise<void> {
    await Filesystem.writeFile({
      path: `${ROOT}/${buildId}/${relPath}`,
      directory: Directory.Library,
      data: arrayBufferToBase64(data),
      recursive: true,
    });
  }

  async copyFile(fromBuildId: string, toBuildId: string, relPath: string): Promise<void> {
    await Filesystem.copy({
      from: `${ROOT}/${fromBuildId}/${relPath}`,
      to: `${ROOT}/${toBuildId}/${relPath}`,
      directory: Directory.Library,
      toDirectory: Directory.Library,
    });
  }

  async hashFile(buildId: string, relPath: string): Promise<string | null> {
    try {
      const { data } = await Filesystem.readFile({
        path: `${ROOT}/${buildId}/${relPath}`,
        directory: Directory.Library,
      });
      const binary = atob(data as string);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return `sha256:${await sha256Hex(bytes.buffer)}`;
    } catch {
      return null;
    }
  }

  async removeVersion(buildId: string): Promise<void> {
    try {
      await Filesystem.rmdir({
        path: `${ROOT}/${buildId}`,
        directory: Directory.Library,
        recursive: true,
      });
    } catch {
      // already gone — nothing to clean up
    }
  }

  async listVersions(): Promise<string[]> {
    try {
      const { files } = await Filesystem.readdir({ path: ROOT, directory: Directory.Library });
      return files.filter((f) => f.type === 'directory').map((f) => f.name);
    } catch {
      return [];
    }
  }

  async activate(buildId: string | null): Promise<void> {
    if (buildId) {
      await HotUpdateNative.activate({ buildId });
    } else {
      await HotUpdateNative.reset();
    }
  }
}
