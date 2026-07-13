import {
  HotUpdateDownloader,
  HotUpdateFileEntry,
  HotUpdateManifest,
  HotUpdateState,
  HotUpdateStorage,
  EMPTY_STATE,
} from './hotUpdateTypes';

/**
 * Files that need to land in the new version directory: either downloaded
 * fresh (hash changed or file is new) or copied from the currently active
 * build (hash unchanged). The native side loads a version directory as a
 * complete WebView root, so every remote file must be present locally even
 * when only a handful actually changed.
 */
export interface FilePlanEntry extends HotUpdateFileEntry {
  source: 'download' | 'copy';
}

export function planFiles(
  activeManifest: HotUpdateManifest | null,
  remote: HotUpdateManifest
): FilePlanEntry[] {
  const activeByPath = new Map((activeManifest?.files ?? []).map((f) => [f.path, f.hash]));
  return remote.files.map((f) => ({
    ...f,
    source: activeByPath.get(f.path) === f.hash ? 'copy' : 'download',
  }));
}

export interface HotUpdateManagerOptions {
  manifestUrl: string;
  currentNativeBuild: number;
  storage: HotUpdateStorage;
  downloader: HotUpdateDownloader;
  /** Max historical versions to retain besides the active one. Defaults to 1 (the previous-good build). */
  keepPreviousVersions?: number;
}

export type HotUpdateResult =
  | { outcome: 'up-to-date' }
  | { outcome: 'disabled-remote'; rolledBackTo: string | null }
  | { outcome: 'native-build-too-old'; requiredMinNativeBuild: number }
  | { outcome: 'updated'; buildId: string }
  | { outcome: 'failed'; error: string };

/**
 * Orchestrates a single hot-update check: fetch the remote manifest, diff it
 * against the currently active build, download/copy the resulting file set
 * into a fresh version directory, verify it, then flip the "active" pointer.
 * The new version takes effect on the next cold start — the native
 * WebView-loading code decides which directory to serve from at launch.
 */
export class HotUpdateManager {
  constructor(private readonly options: HotUpdateManagerOptions) {}

  async checkForUpdate(): Promise<HotUpdateResult> {
    const { manifestUrl, storage, downloader, currentNativeBuild } = this.options;

    let remote: HotUpdateManifest;
    try {
      remote = await downloader.fetchManifest(manifestUrl);
    } catch (err) {
      return { outcome: 'failed', error: `manifest fetch failed: ${String(err)}` };
    }

    const state = await storage.readState();

    if (remote.disabled) {
      if (state.activeBuildId !== state.previousGoodBuildId) {
        const rolledBack: HotUpdateState = {
          activeBuildId: state.previousGoodBuildId,
          activeManifest: null,
          previousGoodBuildId: state.previousGoodBuildId,
        };
        await storage.writeState(rolledBack);
        await storage.activate(state.previousGoodBuildId);
      }
      return { outcome: 'disabled-remote', rolledBackTo: state.previousGoodBuildId };
    }

    if (remote.minNativeBuild > currentNativeBuild) {
      return { outcome: 'native-build-too-old', requiredMinNativeBuild: remote.minNativeBuild };
    }

    if (remote.buildId === state.activeBuildId) {
      return { outcome: 'up-to-date' };
    }

    const plan = planFiles(state.activeManifest, remote);

    try {
      for (const entry of plan) {
        if (entry.source === 'copy' && state.activeBuildId) {
          await storage.copyFile(state.activeBuildId, remote.buildId, entry.path);
        } else {
          const bytes = await downloader.fetchFile(`${dirUrl(manifestUrl)}/${entry.path}`);
          await storage.writeFile(remote.buildId, entry.path, bytes);
        }
      }

      for (const entry of plan) {
        const localHash = await storage.hashFile(remote.buildId, entry.path);
        if (localHash !== entry.hash) {
          throw new Error(`hash mismatch for ${entry.path}`);
        }
      }
    } catch (err) {
      await storage.removeVersion(remote.buildId);
      return { outcome: 'failed', error: String(err) };
    }

    const nextState: HotUpdateState = {
      activeBuildId: remote.buildId,
      activeManifest: remote,
      previousGoodBuildId: state.activeBuildId ?? state.previousGoodBuildId,
    };
    await storage.writeState(nextState);
    await storage.activate(remote.buildId);
    await this.pruneOldVersions(nextState);

    return { outcome: 'updated', buildId: remote.buildId };
  }

  private async pruneOldVersions(state: HotUpdateState): Promise<void> {
    const keep = new Set(
      [state.activeBuildId, state.previousGoodBuildId].filter((id): id is string => !!id)
    );
    const versions = await this.options.storage.listVersions();
    const toRemove = versions.filter((v) => !keep.has(v));
    for (const v of toRemove) {
      await this.options.storage.removeVersion(v);
    }
  }
}

function dirUrl(manifestUrl: string): string {
  return manifestUrl.slice(0, manifestUrl.lastIndexOf('/'));
}

export function createEmptyState(): HotUpdateState {
  return { ...EMPTY_STATE };
}
