/**
 * 跨平台数据持久化接口，对标 Unity PlayerPrefs。
 *
 * 平台实现：
 *  - Web / 移动端浏览器 → WebPlayerPrefs  (localStorage)
 *  - 微信小游戏         → WechatPlayerPrefs (wx.storage)
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
   * 显式刷盘（对标 Unity PlayerPrefs.Save()）。
   * localStorage / wx.storage 均自动持久化，此方法为 no-op，
   * 保留是为了让调用方无需关心平台差异。
   */
  save(): void;
}
