/**
 * lobbyLayout.ts
 *
 * 大厅场景（LobbyScene）的布局数据。
 *
 * 坐标系：游戏逻辑像素，原点在左上角。
 *   竖屏：宽度 GAME_WIDTH = 1080，高度 GAME_HEIGHT = 1920
 *   横屏：宽度 GAME_HEIGHT = 1920，高度 GAME_WIDTH = 1080
 *       （背景图始终拉伸为 1920×1080，节点坐标与之对齐）
 *
 * 两套坐标独立维护：
 *   PORTRAIT_NODE_POSITIONS  — 竖屏
 *   LANDSCAPE_NODE_POSITIONS — 横屏（基于 16:9 精确比例预算，可手动微调）
 *
 * 横屏坐标基准公式（仅首次生成时使用）：
 *   x = round(portraitX * GAME_HEIGHT / GAME_WIDTH)   // × 16/9
 *   y = round(portraitY * GAME_WIDTH  / GAME_HEIGHT)  // × 9/16
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

const PORTRAIT_DAILY_POS = { x: 90, y: 660 } as const;

// ── 横屏节点坐标（背景 1920×1080，与背景拉伸严格对齐）────────────────────────
// 基准公式：x = round(portraitX * 16/9)，y = round(portraitY * 9/16)
// 如需微调，直接改这里的数值即可，不影响竖屏。

const LANDSCAPE_NODE_POSITIONS: readonly LobbyNodePos[] = [
  { stageIndex:  1, x:  960, y: 1024 },
  { stageIndex:  2, x:  539, y:  973 },
  { stageIndex:  3, x: 1560, y:  923 },
  { stageIndex:  4, x: 1019, y:  872 },
  { stageIndex:  5, x: 1259, y:  821 },
  { stageIndex:  6, x:  779, y:  771 },
  { stageIndex:  7, x: 1259, y:  720 },
  { stageIndex:  8, x:  539, y:  669 },
  { stageIndex:  9, x: 1380, y:  619 },
  { stageIndex: 10, x:  960, y:  568 },
  { stageIndex: 11, x: 1140, y:  518 },
  { stageIndex: 12, x: 1499, y:  467 },
  { stageIndex: 13, x:  900, y:  416 },
  { stageIndex: 14, x: 1499, y:  366 },
  { stageIndex: 15, x: 1019, y:  315 },
  { stageIndex: 16, x: 1259, y:  264 },
  { stageIndex: 17, x: 1499, y:  214 },
  { stageIndex: 18, x: 1259, y:  163 },
  { stageIndex: 19, x:  900, y:  113 },
];

const LANDSCAPE_DAILY_POS = { x: 260, y: 390 } as const;

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

/** 横屏布局：直接返回预算坐标，与 1920×1080 背景严格对齐。 */
export function landscapeLobbyLayout(): LobbyLayout {
  return {
    nodePositions:    LANDSCAPE_NODE_POSITIONS,
    dailyChallengePos: LANDSCAPE_DAILY_POS,
  };
}

/** 根据当前 ScreenConfig 返回对应方向的布局。 */
export function getLobbyLayout(screen: ScreenConfig): LobbyLayout {
  return screen.orientation === Orientation.Landscape
    ? landscapeLobbyLayout()
    : portraitLobbyLayout();
}
