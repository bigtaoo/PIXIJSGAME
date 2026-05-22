import { IPlayerPrefs } from './IPlayerPrefs';

/**
 * 基于 localStorage 的 PlayerPrefs 实现。
 * 适用于桌面浏览器与移动端浏览器（两者 API 完全相同）。
 *
 * 所有 key 加前缀以避免与页面其他数据冲突。
 * 写入失败时（如隐私模式禁用 storage、配额满）静默降级，不抛出异常。
 */
export class WebPlayerPrefs implements IPlayerPrefs {
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
      localStorage.removeItem(this.k(key));
    } catch {
      // 静默忽略
    }
  }

  deleteAll(): void {
    try {
      const toRemove = Object.keys(localStorage).filter((k) => k.startsWith(this.prefix));
      toRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // 静默忽略
    }
  }

  /** localStorage 每次写入自动持久化，此方法为 no-op */
  save(): void {}

  // ── 内部辅助 ─────────────────────────────────────────────────────────

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // QuotaExceededError 或隐私模式下 storage 被禁用，静默忽略
      console.warn('[WebPlayerPrefs] 写入失败:', e);
    }
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
}
