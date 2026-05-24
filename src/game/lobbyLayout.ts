/**
 * 大厅关卡节点布局坐标
 *
 * 坐标系：游戏逻辑像素，原点在左上角
 *   宽度：GAME_WIDTH = 1080
 *   高度：GAME_HEIGHT = 1920
 *   背景图：bg.png（1024×1024）拉伸至 1080×1920
 *
 * 关卡排布：
 *   - 关卡 1 在底部，关卡 19 在顶部
 *   - 节点沿背景图中的蜿蜒探险小路排列
 *   - 每个坐标为圆形节点的中心点（直径 100px，半径 50px）
 *
 * 调整方式：直接修改各关卡的 x / y 值即可，
 *   lobbyScene.ts 会自动读取并刷新布局。
 */

export interface LobbyNodePos {
  /** 1-based 关卡编号，与 StageData.stageIndex 对应 */
  stageIndex: number;
  /** 节点中心 x 坐标（逻辑像素，0 = 左边缘） */
  x: number;
  /** 节点中心 y 坐标（逻辑像素，0 = 顶部边缘） */
  y: number;
}

/**
 * 19 个关卡节点位置。
 * stageIndex 1（关卡 1）= 地图底部；19（关卡 19）= 地图顶部。
 *
 * 坐标对应 bg.png 中的蜿蜒路径节点，可在此文件中按需微调。
 */
export const LOBBY_NODE_POSITIONS: readonly LobbyNodePos[] = [
  { stageIndex:  1, x:  540, y: 1820 },   // 底部中央
  { stageIndex:  2, x:  303, y: 1730 },   // 左侧
  { stageIndex:  3, x:  878, y: 1640 },   // 右侧
  { stageIndex:  4, x:  573, y: 1550 },   // 中部
  { stageIndex:  5, x:  708, y: 1460 },   // 中右
  { stageIndex:  6, x:  438, y: 1370 },   // 中左
  { stageIndex:  7, x:  708, y: 1280 },   // 中右
  { stageIndex:  8, x:  303, y: 1190 },   // 左侧
  { stageIndex:  9, x:  776, y: 1100 },   // 右侧
  { stageIndex: 10, x:  540, y: 1010 },   // 中部（与每日挑战同高度附近）
  { stageIndex: 11, x:  641, y:  920 },   // 中右
  { stageIndex: 12, x:  843, y:  830 },   // 右侧
  { stageIndex: 13, x:  506, y:  740 },   // 中部
  { stageIndex: 14, x:  843, y:  650 },   // 右侧
  { stageIndex: 15, x:  573, y:  560 },   // 中部
  { stageIndex: 16, x:  708, y:  470 },   // 中右
  { stageIndex: 17, x:  843, y:  380 },   // 右侧
  { stageIndex: 18, x:  708, y:  290 },   // 中右
  { stageIndex: 19, x:  506, y:  200 },   // 顶部中央
];

/**
 * 每日挑战入口图标位置。
 *
 * 文档规格（art.md §8.5）：
 *   - 地图左侧中部，不依附于关卡路径，独立存在
 *   - 逻辑坐标约为地图总高度 50% 处、距左边缘 80–100px
 *   - 直径 130px（半径 65px）
 *   - 图标始终以激活态显示（无锁定状态）
 */
export const DAILY_CHALLENGE_POS = {
  x: 110,    // 距左边缘 ~110px（圆心），圆直径 130px
  y: 960,    // 地图高度 50% 处（1920 / 2 = 960）
} as const;
