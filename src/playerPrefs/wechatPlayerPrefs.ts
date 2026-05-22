import { IPlayerPrefs } from './IPlayerPrefs';

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

  // ── 写入 ────────────────────────────────────────────────────────────

  setInt(key: string, value: number): void {
    this.write(this.k(key), Math.trunc(value).toString());
  }

  setFloat(key: string, value: number): void {
    this.write(this.k(key), value.toString());
  }

  setString(key: string, value: string): void {
    this.write(this.k(key), value);
  }

  // ── 读取 ────────────────────────────────────────────────────────────

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

  // ── 其他 ────────────────────────────────────────────────────────────

  hasKey(key: string): boolean {
    return this.read(this.k(key)) !== null;
  }

  deleteKey(key: string): void {
    try {
      wx.removeStorageSync(this.k(key));
    } catch (e) {
      console.warn('[WechatPlayerPrefs] deleteKey 失败:', e);
    }
  }

  deleteAll(): void {
    try {
      const info = wx.getStorageInfoSync();
      const toRemove = info.keys.filter((k: string) => k.startsWith(this.prefix));
      toRemove.forEach((k: string) => {
        try { wx.removeStorageSync(k); } catch { /* 单条失败不中断 */ }
      });
    } catch (e) {
      console.warn('[WechatPlayerPrefs] deleteAll 失败:', e);
    }
  }

  /** wx.storage 每次写入自动持久化，此方法为 no-op */
  save(): void {}

  // ── 内部辅助 ─────────────────────────────────────────────────────────

  private write(key: string, value: string): void {
    try {
      wx.setStorageSync(key, value);
    } catch (e) {
      // 超出配额或其他写入错误，静默忽略
      console.warn('[WechatPlayerPrefs] 写入失败:', e);
    }
  }

  private read(key: string): string | null {
    try {
      // wx.getStorageSync 找不到 key 时返回空字符串 ''，而非 null
      const val: string = wx.getStorageSync(key);
      return val === '' ? null : val;
    } catch {
      return null;
    }
  }
}
