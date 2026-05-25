/**
 * lobbyLayout.ts
 *
 * 大厅场景（LobbyScene）的布局数据。
 *
 * 坐标系：游戏逻辑像素，原点在左上角。
 *   竖屏：宽度 GAME_WIDTH = 1080，高度 GAME_HEIGHT = 1920
 *   横屏：高度 GAME_WIDTH = 1080，宽度 = screenConfig.width（设备相关）
 *
 * 横屏坐标的默认生成方式：
 *   x_landscape = portraitX * (screenW / GAME_WIDTH)
 *   y_landscape = portraitY * (GAME_WIDTH / GAME_HEIGHT)  // = portraitY * 0.5625
 *
 * 如需手动精调某个节点的横屏位置，在 landscapeLobbyLayout() 中对应条目
 * 直接替换 x / y 即可，其余保持自动计算。
 */

import { ScreenConfig } from './screenConfig';
import { Orientation } from './enums';
import { GAME_WIDTH, GAME_HEIGHT } from './consts';

// ── 竖屏节点坐标 ──────────────────────────────────────────────────────────────

export interface LobbyNodePos {
  /** 1-based 关卡编号，与 StageData.stageIndex 对应 */
  stageIndex: number;
  /** 节点中心 x（逻辑像素） */
  x: number;
  /** 节点中心 y（逻辑像素） */
  y: number;
}

/**
 * 19 个关卡节点的竖屏坐标。
 * stageIndex 1 = 地图底部；19 = 地图顶部。
 */
const PORTRAIT_NODE_POSITIONS: readonly LobbyNodePos[] = [
  { stageIndex:  1, x:  540, y: 1820 },
  { stageIndex:  2, x:  303, y: 1730 },
  { stageIndex:  3, x:  878, y: 1640 },
  { stageIndex:  4, x:  573, y: 1550 },
  { stageIndex:  5, x:  708, y: 1460 },
  { stageIndex:  6, x:  438, y: 1370 },
  { stageIndex:  7, x:  708, y: 1280 },
  { stageIndex:  8, x:  303, y: 1190 },
  { stageIndex:  9, x:  776, y: 1100 },
  { stageIndex: 10, x:  540, y: 1010 },
  { stageIndex: 11, x:  641, y:  920 },
  { stageIndex: 12, x:  843, y:  830 },
  { stageIndex: 13, x:  506, y:  740 },
  { stageIndex: 14, x:  843, y:  650 },
  { stageIndex: 15, x:  573, y:  560 },
  { stageIndex: 16, x:  708, y:  470 },
  { stageIndex: 17, x:  843, y:  380 },
  { stageIndex: 18, x:  708, y:  290 },
  { stageIndex: 19, x:  506, y:  200 },
];

const PORTRAIT_DAILY_POS = { x: 110, y: 960 } as const;

// ── Layout interface ──────────────────────────────────────────────────────────

export interface LobbyLayout {
  nodePositions:    readonly LobbyNodePos[];
  dailyChallengePos: { x: number; y: number };
}

// ── Layout functions ──────────────────────────────────────────────────────────

export function portraitLobbyLayout(): LobbyLayout {
  return {
    nodePositions:    PORTRAIT_NODE_POSITIONS,
    dailyChallengePos: PORTRAIT_DAILY_POS,
  };
}

/**
 * 根据横屏 canvas 宽度，将竖屏坐标按比例映射到横屏空间。
 *
 * 比例因子：
 *   scaleX = screenW / GAME_WIDTH    （水平拉伸）
 *   scaleY = GAME_WIDTH / GAME_HEIGHT （垂直压缩，约 0.5625）
 *
 * 如需精调某节点，在此函数内对特定 stageIndex 手动覆盖 x / y。
 */
export function landscapeLobbyLayout(screenW: number): LobbyLayout {
  const scaleX = screenW / GAME_WIDTH;
  const scaleY = GAME_WIDTH / GAME_HEIGHT;   // 1080 / 1920 ≈ 0.5625

  const nodePositions: LobbyNodePos[] = PORTRAIT_NODE_POSITIONS.map(p => ({
    stageIndex: p.stageIndex,
    x: Math.round(p.x * scaleX),
    y: Math.round(p.y * scaleY),
  }));

  const dailyChallengePos = {
    x: Math.round(PORTRAIT_DAILY_POS.x * scaleX),
    y: Math.round(PORTRAIT_DAILY_POS.y * scaleY),
  };

  return { nodePositions, dailyChallengePos };
}

/** 根据当前 ScreenConfig 返回对应方向的布局。 */
export function getLobbyLayout(screen: ScreenConfig): LobbyLayout {
  return screen.orientation === Orientation.Landscape
    ? landscapeLobbyLayout(screen.width)
    : portraitLobbyLayout();
}
