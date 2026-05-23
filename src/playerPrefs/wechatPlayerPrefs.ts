import { IPlayerPrefs } from './IPlayerPrefs';

// wx sync-storage APIs are missing from the official TypeScript declarations;
// cast to any to bypass the type checker.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wxStorage = wx as any;

/**
 * wx.storage-backed PlayerPrefs implementation for WeChat mini games.
 *
 * The Sync-suffixed wx APIs run synchronously on the main thread,
 * behaving like localStorage. All operations are wrapped in try-catch
 * so storage errors degrade silently without affecting gameplay.
 *
 * WeChat storage limits: 1 MB per key, 10 MB total.
 */
export class WechatPlayerPrefs implements IPlayerPrefs {
  private readonly prefix: string;

  constructor(prefix = 'nge_') {
    this.prefix = prefix;
  }

  private k(key: string): string {
    return this.prefix + key;
  }

  setInt(key: string, value: number): void {
    this.write(this.k(key), Math.trunc(value).toString());
  }

  setFloat(key: string, value: number): void {
    this.write(this.k(key), value.toString());
  }

  setString(key: string, value: string): void {
    this.write(this.k(key), value);
  }

  getInt(key: string, defaultValue = 0): number {
    const raw = this.read(this.k(key));
    if (raw === null) return defaultValue;
    const n = parseInt(raw, 10);
    return isNaN(n) ? defaultValue : n;
  }

  getFloat(key: string, defaultValue = 0): number {
    const raw = this.read(this.k(key));
    if (raw === null) return defaultValue;
    const n = parseFloat(raw);
    return isNaN(n) ? defaultValue : n;
  }

  getString(key: string, defaultValue = ''): string {
    return this.read(this.k(key)) ?? defaultValue;
  }

  hasKey(key: string): boolean {
    return this.read(this.k(key)) !== null;
  }

  deleteKey(key: string): void {
    try {
      wxStorage.removeStorageSync(this.k(key));
    } catch (e) {
      console.warn('[WechatPlayerPrefs] deleteKey failed:', e);
    }
  }

  deleteAll(): void {
    try {
      const info = wxStorage.getStorageInfoSync();
      const toRemove = (info.keys as string[]).filter((k) => k.startsWith(this.prefix));
      toRemove.forEach((k) => {
        try { wxStorage.removeStorageSync(k); } catch (_e) { /* ignore */ }
      });
    } catch (e) {
      console.warn('[WechatPlayerPrefs] deleteAll failed:', e);
    }
  }

  /** wx.storage persists automatically on each write — no-op */
  save(): void {}

  private write(key: string, value: string): void {
    try {
      wxStorage.setStorageSync(key, value);
    } catch (e) {
      console.warn('[WechatPlayerPrefs] write failed:', e);
    }
  }

  private read(key: string): string | null {
    try {
      // wx.getStorageSync returns '' when the key is not found (not null)
      const val: string = wxStorage.getStorageSync(key);
      return val === '' ? null : val;
    } catch (_e) {
      return null;
    }
  }
}
