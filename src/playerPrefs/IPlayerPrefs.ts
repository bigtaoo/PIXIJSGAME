/**
 * Cross-platform data persistence interface, modelled after Unity PlayerPrefs.
 *
 * Platform implementations:
 *  - Web / mobile browser -> WebPlayerPrefs  (localStorage)
 *  - WeChat mini game     -> WechatPlayerPrefs (wx.storage)
 */
export interface IPlayerPrefs {
  setInt(key: string, value: number): void;
  getInt(key: string, defaultValue?: number): number;

  setFloat(key: string, value: number): void;
  getFloat(key: string, defaultValue?: number): number;

  setString(key: string, value: string): void;
  getString(key: string, defaultValue?: string): string;

  hasKey(key: string): boolean;
  deleteKey(key: string): void;
  deleteAll(): void;

  /**
   * Explicit flush to disk (mirrors Unity PlayerPrefs.Save()).
   * localStorage / wx.storage persist automatically on every write,
   * so this is a no-op — kept so callers need not branch on platform.
   */
  save(): void;
}
