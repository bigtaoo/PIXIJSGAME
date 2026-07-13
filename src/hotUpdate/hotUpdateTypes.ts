export interface HotUpdateFileEntry {
  path: string;
  hash: string;
  size: number;
}

export interface HotUpdateManifest {
  buildId: string;
  generatedAt: string;
  minNativeBuild: number;
  disabled: boolean;
  files: HotUpdateFileEntry[];
}

/** Persisted across launches (in @capacitor/preferences on-device). */
export interface HotUpdateState {
  activeBuildId: string | null;
  activeManifest: HotUpdateManifest | null;
  previousGoodBuildId: string | null;
}

export const EMPTY_STATE: HotUpdateState = {
  activeBuildId: null,
  activeManifest: null,
  previousGoodBuildId: null,
};

/** Fetches the remote manifest and raw file bytes. Swappable for tests. */
export interface HotUpdateDownloader {
  fetchManifest(url: string): Promise<HotUpdateManifest>;
  fetchFile(url: string): Promise<ArrayBuffer>;
}

/**
 * On-device storage for hot-update version directories. Each build lives in
 * its own directory (e.g. `hotupdate/<buildId>/`) so an in-progress download
 * never disturbs the currently active version.
 */
export interface HotUpdateStorage {
  readState(): Promise<HotUpdateState>;
  writeState(state: HotUpdateState): Promise<void>;
  dirExists(buildId: string): Promise<boolean>;
  writeFile(buildId: string, relPath: string, data: ArrayBuffer): Promise<void>;
  copyFile(fromBuildId: string, toBuildId: string, relPath: string): Promise<void>;
  hashFile(buildId: string, relPath: string): Promise<string | null>;
  removeVersion(buildId: string): Promise<void>;
  listVersions(): Promise<string[]>;
  /**
   * Points the native WebView at `buildId` on the next cold start, or falls
   * back to the app-bundled build when `buildId` is null. Takes effect on
   * next launch only — never reloads the currently running WebView.
   */
  activate(buildId: string | null): Promise<void>;
}
