import { IPlayerPrefs } from './IPlayerPrefs';

// wx 的同步存储 API 在官方类型声明里缺失，用 any 跳过类型检查
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wxStorage = wx as any;

/**
 * 基于微信小游戏 wx.storage 同步 API 的 PlayerPrefs 实现。
 *
 * wx 同步接口（Sync 后缀）在主线程可直接调用，行为类似 localStorage。
 * 所有操作均包裹 try-catch，存储异常时静默降级，不影响游戏运行。
 *
 * 微信存储限制：单个 key 最大 1MB，总量最大 10MB。
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
      // wx.getStorageSync returns empty string '' when key is not found (not null)
      const val: string = wxStorage.getStorageSync(key);
      return val === '' ? null : val;
    } catch (_e) {
      return null;
    }
  }
}
