import { describe, it, expect, beforeEach } from 'vitest';
import { HotUpdateManager, planFiles } from './hotUpdateManager';
import {
  HotUpdateDownloader,
  HotUpdateManifest,
  HotUpdateState,
  HotUpdateStorage,
  EMPTY_STATE,
} from './hotUpdateTypes';

function manifest(overrides: Partial<HotUpdateManifest> = {}): HotUpdateManifest {
  return {
    buildId: 'build-1',
    generatedAt: '2024-01-01T00:00:00.000Z',
    minNativeBuild: 1,
    disabled: false,
    files: [
      { path: 'index.js', hash: 'sha256:aaa', size: 10 },
      { path: 'assets/img.png', hash: 'sha256:bbb', size: 20 },
    ],
    ...overrides,
  };
}

describe('planFiles', () => {
  it('marks every file for download when there is no active manifest', () => {
    const plan = planFiles(null, manifest());
    expect(plan.every((f) => f.source === 'download')).toBe(true);
    expect(plan).toHaveLength(2);
  });

  it('marks unchanged files for copy and changed/new files for download', () => {
    const active = manifest({
      files: [
        { path: 'index.js', hash: 'sha256:aaa', size: 10 }, // unchanged
        { path: 'assets/img.png', hash: 'sha256:old', size: 5 }, // changed
      ],
    });
    const plan = planFiles(active, manifest());
    const byPath = Object.fromEntries(plan.map((f) => [f.path, f.source]));
    expect(byPath['index.js']).toBe('copy');
    expect(byPath['assets/img.png']).toBe('download');
  });
});

/** In-memory fakes so the orchestration logic can be tested without any Capacitor runtime. */
class FakeStorage implements HotUpdateStorage {
  state: HotUpdateState = { ...EMPTY_STATE };
  versions = new Map<string, Map<string, { hash: string; data: ArrayBuffer }>>();

  async readState() {
    return this.state;
  }
  async writeState(state: HotUpdateState) {
    this.state = state;
  }
  async dirExists(buildId: string) {
    return this.versions.has(buildId);
  }
  async writeFile(buildId: string, relPath: string, data: ArrayBuffer) {
    if (!this.versions.has(buildId)) this.versions.set(buildId, new Map());
    this.versions.get(buildId)!.set(relPath, { hash: `sha256:written:${relPath}`, data });
  }
  async copyFile(fromBuildId: string, toBuildId: string, relPath: string) {
    const from = this.versions.get(fromBuildId)?.get(relPath);
    if (!from) throw new Error(`missing source file ${relPath} in ${fromBuildId}`);
    if (!this.versions.has(toBuildId)) this.versions.set(toBuildId, new Map());
    this.versions.get(toBuildId)!.set(relPath, from);
  }
  async hashFile(buildId: string, relPath: string) {
    return this.versions.get(buildId)?.get(relPath)?.hash ?? null;
  }
  async removeVersion(buildId: string) {
    this.versions.delete(buildId);
  }
  async listVersions() {
    return Array.from(this.versions.keys());
  }
  activated: (string | null)[] = [];
  async activate(buildId: string | null) {
    this.activated.push(buildId);
  }

  /** Test helper: seed a version's files with hashes matching a manifest, as if a prior update had completed. */
  seed(buildId: string, m: HotUpdateManifest) {
    const map = new Map(m.files.map((f) => [f.path, { hash: f.hash, data: new ArrayBuffer(0) }]));
    this.versions.set(buildId, map);
  }
}

class FakeDownloader implements HotUpdateDownloader {
  constructor(private readonly remoteManifest: HotUpdateManifest) {}
  async fetchManifest() {
    return this.remoteManifest;
  }
  async fetchFile() {
    return new ArrayBuffer(0);
  }
}

describe('HotUpdateManager.checkForUpdate', () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = new FakeStorage();
  });

  it('reports up-to-date when remote buildId matches the active build', async () => {
    storage.state = {
      activeBuildId: 'build-1',
      activeManifest: manifest(),
      previousGoodBuildId: null,
    };
    const mgr = new HotUpdateManager({
      manifestUrl: 'https://example.com/mobile/latest/manifest.json',
      currentNativeBuild: 1,
      storage,
      downloader: new FakeDownloader(manifest()),
    });
    const result = await mgr.checkForUpdate();
    expect(result.outcome).toBe('up-to-date');
  });

  it('refuses to apply an update that requires a newer native build', async () => {
    const mgr = new HotUpdateManager({
      manifestUrl: 'https://example.com/mobile/latest/manifest.json',
      currentNativeBuild: 1,
      storage,
      downloader: new FakeDownloader(manifest({ minNativeBuild: 5 })),
    });
    const result = await mgr.checkForUpdate();
    expect(result).toEqual({ outcome: 'native-build-too-old', requiredMinNativeBuild: 5 });
  });

  it('downloads a fresh build on first run and activates it', async () => {
    // Fake writeFile/hashFile is rigged so the written hash always matches the manifest hash
    // it was written under, by writing with the hash the manifest expects (simulated download).
    class SeedingDownloader implements HotUpdateDownloader {
      constructor(private readonly m: HotUpdateManifest) {}
      async fetchManifest() {
        return this.m;
      }
      async fetchFile() {
        return new ArrayBuffer(0);
      }
    }
    // Patch storage.writeFile to record the manifest-declared hash instead of a synthetic one,
    // mirroring what a real hash-verified download would produce.
    const remote = manifest();
    const originalWriteFile = storage.writeFile.bind(storage);
    storage.writeFile = async (buildId, relPath, data) => {
      await originalWriteFile(buildId, relPath, data);
      const expected = remote.files.find((f) => f.path === relPath)?.hash;
      storage.versions.get(buildId)!.set(relPath, { hash: expected!, data });
    };

    const mgr = new HotUpdateManager({
      manifestUrl: 'https://example.com/mobile/latest/manifest.json',
      currentNativeBuild: 1,
      storage,
      downloader: new SeedingDownloader(remote),
    });

    const result = await mgr.checkForUpdate();
    expect(result).toEqual({ outcome: 'updated', buildId: 'build-1' });
    expect(storage.state.activeBuildId).toBe('build-1');
    expect(storage.state.previousGoodBuildId).toBeNull();
    expect(storage.activated).toEqual(['build-1']);
  });

  it('rolls back to the previous-good build when the remote manifest is disabled', async () => {
    storage.state = {
      activeBuildId: 'build-2',
      activeManifest: manifest({ buildId: 'build-2' }),
      previousGoodBuildId: 'build-1',
    };
    const mgr = new HotUpdateManager({
      manifestUrl: 'https://example.com/mobile/latest/manifest.json',
      currentNativeBuild: 1,
      storage,
      downloader: new FakeDownloader(manifest({ buildId: 'build-2', disabled: true })),
    });
    const result = await mgr.checkForUpdate();
    expect(result).toEqual({ outcome: 'disabled-remote', rolledBackTo: 'build-1' });
    expect(storage.state.activeBuildId).toBe('build-1');
    expect(storage.activated).toEqual(['build-1']);
  });

  it('discards the new version directory and keeps the old active build when hash verification fails', async () => {
    class LyingDownloader implements HotUpdateDownloader {
      constructor(private readonly m: HotUpdateManifest) {}
      async fetchManifest() {
        return this.m;
      }
      async fetchFile() {
        return new ArrayBuffer(0); // writeFile will record a hash that never matches the manifest's declared hash
      }
    }
    storage.seed('build-0', manifest({ buildId: 'build-0' }));
    storage.state = {
      activeBuildId: 'build-0',
      activeManifest: manifest({ buildId: 'build-0' }),
      previousGoodBuildId: null,
    };

    // Different file hashes than the active build so every file is planned as a
    // download (not a same-hash copy), which is the path that actually verifies hashes.
    const remoteManifest = manifest({
      buildId: 'build-1',
      files: [
        { path: 'index.js', hash: 'sha256:new-aaa', size: 10 },
        { path: 'assets/img.png', hash: 'sha256:new-bbb', size: 20 },
      ],
    });

    const mgr = new HotUpdateManager({
      manifestUrl: 'https://example.com/mobile/latest/manifest.json',
      currentNativeBuild: 1,
      storage,
      downloader: new LyingDownloader(remoteManifest),
    });

    const result = await mgr.checkForUpdate();
    expect(result.outcome).toBe('failed');
    expect(storage.state.activeBuildId).toBe('build-0'); // unchanged
    expect(await storage.dirExists('build-1')).toBe(false); // cleaned up
  });

  it('prunes versions other than the active and previous-good builds', async () => {
    storage.seed('build-1', manifest({ buildId: 'build-1' }));
    storage.seed('stale', manifest({ buildId: 'stale' }));
    storage.state = {
      activeBuildId: 'build-1',
      activeManifest: manifest({ buildId: 'build-1' }),
      previousGoodBuildId: null,
    };

    const remote = manifest({ buildId: 'build-2' });
    const originalWriteFile = storage.writeFile.bind(storage);
    storage.writeFile = async (buildId, relPath, data) => {
      await originalWriteFile(buildId, relPath, data);
      const expected = remote.files.find((f) => f.path === relPath)?.hash;
      storage.versions.get(buildId)!.set(relPath, { hash: expected!, data });
    };
    // Unchanged file copy path requires the source hash to match — align build-1's img hash.
    storage.versions
      .get('build-1')!
      .set('assets/img.png', { hash: 'sha256:bbb', data: new ArrayBuffer(0) });

    const mgr = new HotUpdateManager({
      manifestUrl: 'https://example.com/mobile/latest/manifest.json',
      currentNativeBuild: 1,
      storage,
      downloader: new FakeDownloader(remote),
    });

    const result = await mgr.checkForUpdate();
    expect(result).toEqual({ outcome: 'updated', buildId: 'build-2' });
    const versions = await storage.listVersions();
    expect(versions.sort()).toEqual(['build-1', 'build-2']);
    expect(versions).not.toContain('stale');
  });
});
