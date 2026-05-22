import { IPlayerPrefs } from './IPlayerPrefs';

let _impl: IPlayerPrefs | null = null;

/**
 * 在应用启动时（加载资源之前）注入平台对应的实现。
 *
 * Web:    setPlayerPrefsImpl(new WebPlayerPrefs())
 * WeChat: setPlayerPrefsImpl(new WechatPlayerPrefs())
 */
export function setPlayerPrefsImpl(impl: IPlayerPrefs): void {
  _impl = impl;
}

function get(): IPlayerPrefs {
  if (!_impl) throw new Error('[PlayerPrefs] 未初始化，请先调用 setPlayerPrefsImpl()');
  return _impl;
}

/**
 * Unity 风格的静态 PlayerPrefs API。
 *
 * 用法示例：
 *   PlayerPrefs.setInt('stage', 3);
 *   const stage = PlayerPrefs.getInt('stage', 1);
 */
export const PlayerPrefs = {
  // ── Int ────────────────────────────────────────────────────────────
  setInt(key: string, value: number): void {
    get().setInt(key, value);
  },
  getInt(key: string, defaultValue = 0): number {
    return get().getInt(key, defaultValue);
  },

  // ── Float ──────────────────────────────────────────────────────────
  setFloat(key: string, value: number): void {
    get().setFloat(key, value);
  },
  getFloat(key: string, defaultValue = 0): number {
    return get().getFloat(key, defaultValue);
  },

  // ── String ─────────────────────────────────────────────────────────
  setString(key: string, value: string): void {
    get().setString(key, value);
  },
  getString(key: string, defaultValue = ''): string {
    return get().getString(key, defaultValue);
  },

  // ── 通用 ───────────────────────────────────────────────────────────
  hasKey(key: string): boolean {
    return get().hasKey(key);
  },
  deleteKey(key: string): void {
    get().deleteKey(key);
  },
  deleteAll(): void {
    get().deleteAll();
  },
  save(): void {
    get().save();
  },
} as const;
