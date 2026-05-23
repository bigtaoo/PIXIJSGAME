import { IPlayerPrefs } from './IPlayerPrefs';

/**
 * localStorage-backed PlayerPrefs implementation.
 * Works on desktop browsers and mobile browsers (identical API).
 *
 * All keys are prefixed to avoid collisions with other page data.
 * Write failures (private-mode storage disabled, quota exceeded) are
 * silently swallowed — they must not crash the game.
 */
export class WebPlayerPrefs implements IPlayerPrefs {
  private readonly prefix: string;

  constructor(prefix = 'nge_') {
    this.prefix = prefix;
  }

  private k(key: string): string {
    return this.prefix + key;
  }

  // ── Write ─────────────────────────────────────────────────────────

  setInt(key: string, value: number): void {
    this.write(this.k(key), Math.trunc(value).toString());
  }

  setFloat(key: string, value: number): void {
    this.write(this.k(key), value.toString());
  }

  setString(key: string, value: string): void {
    this.write(this.k(key), value);
  }

  // ── Read ──────────────────────────────────────────────────────────

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

  // ── Other ─────────────────────────────────────────────────────────

  hasKey(key: string): boolean {
    return this.read(this.k(key)) !== null;
  }

  deleteKey(key: string): void {
    try {
      localStorage.removeItem(this.k(key));
    } catch {
      // Silently ignore
    }
  }

  deleteAll(): void {
    try {
      const toRemove = Object.keys(localStorage).filter((k) => k.startsWith(this.prefix));
      toRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Silently ignore
    }
  }

  /** localStorage persists automatically on every write — no-op */
  save(): void {}

  // ── Internal helpers ──────────────────────────────────────────────

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // QuotaExceededError or storage disabled in private mode
      console.warn('[WebPlayerPrefs] write failed:', e);
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
