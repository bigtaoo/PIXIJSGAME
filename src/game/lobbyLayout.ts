/**
 * lobbyLayout.ts
 *
 * Layout data for the lobby scene (LobbyScene).
 *
 * Coordinate system: game logical pixels, origin at top-left.
 *   Portrait:  width GAME_WIDTH = 1080, height GAME_HEIGHT = 1920
 *   Landscape: width GAME_HEIGHT = 1920, height GAME_WIDTH = 1080
 *              (background image is always stretched to 1920x1080; node coordinates align to it)
 *
 * Two independent sets of coordinates:
 *   PORTRAIT_NODE_POSITIONS  - portrait
 *   LANDSCAPE_NODE_POSITIONS - landscape (computed from the 16:9 ratio; can be fine-tuned manually)
 */

import { ScreenConfig } from './screenConfig';
import { Orientation } from './enums';
import { GAME_HEIGHT } from './consts';

// -- Portrait node coordinates ------------------------------------------------

export interface LobbyNodePos {
  /** 1-based stage number, matching StageData.stageIndex */
  stageIndex: number;
  /** Node centre x (logical pixels) */
  x: number;
  /** Node centre y (logical pixels) */
  y: number;
}

/**
 * Portrait coordinates for the 19 stage nodes.
 * stageIndex 1 = bottom of the map; 19 = top of the map.
 */
const PORTRAIT_NODE_POSITIONS: readonly LobbyNodePos[] = [
  { stageIndex: 1, x: 600, y: 1790 },
  { stageIndex: 2, x: 303, y: 1730 },
  { stageIndex: 3, x: 878, y: 1640 },
  { stageIndex: 4, x: 390, y: 1550 },
  { stageIndex: 5, x: 708, y: 1460 },
  { stageIndex: 6, x: 200, y: 1370 },
  { stageIndex: 7, x: 708, y: 1280 },
  { stageIndex: 8, x: 303, y: 1190 },
  { stageIndex: 9, x: 776, y: 1100 },
  { stageIndex: 10, x: 500, y: 1000 },
  { stageIndex: 11, x: 641, y: 920 },
  { stageIndex: 12, x: 843, y: 830 },
  { stageIndex: 13, x: 506, y: 740 },
  { stageIndex: 14, x: 843, y: 650 },
  { stageIndex: 15, x: 390, y: 560 },
  { stageIndex: 16, x: 708, y: 470 },
  { stageIndex: 17, x: 893, y: 380 },
  { stageIndex: 18, x: 508, y: 290 },
  { stageIndex: 19, x: 906, y: 100 },
];

const PORTRAIT_DAILY_POS = { x: 177, y: 870 } as const;

// -- Landscape node coordinates (background 1920x1080) ------------------------

const LANDSCAPE_NODE_POSITIONS: readonly LobbyNodePos[] = [
  { stageIndex: 1, x: 960, y: 950 },
  { stageIndex: 2, x: 580, y: 900 },
  { stageIndex: 3, x: 780, y: 770 },
  { stageIndex: 4, x: 1019, y: 750 },
  { stageIndex: 5, x: 1259, y: 821 },
  { stageIndex: 6, x: 1600, y: 871 },
  { stageIndex: 7, x: 1770, y: 670 },
  { stageIndex: 8, x: 1380, y: 669 },
  { stageIndex: 9, x: 1150, y: 550 },
  { stageIndex: 10, x: 660, y: 518 },
  { stageIndex: 11, x: 900, y: 418 },
  { stageIndex: 12, x: 1299, y: 410 },
  { stageIndex: 13, x: 1700, y: 416 },
  { stageIndex: 14, x: 1900, y: 200 },
  { stageIndex: 15, x: 1500, y: 210 },
  { stageIndex: 16, x: 959, y: 264 },
  { stageIndex: 17, x: 599, y: 214 },
  { stageIndex: 18, x: 1159, y: 133 },
  { stageIndex: 19, x: 800, y: 75 },
];

const LANDSCAPE_DAILY_POS = { x: 260, y: 390 } as const;

// -- Layout interface ---------------------------------------------------------

export interface LobbyLayout {
  nodePositions: readonly LobbyNodePos[];
  dailyChallengePos: { x: number; y: number };
}

// -- Layout functions ---------------------------------------------------------

export function portraitLobbyLayout(): LobbyLayout {
  return {
    nodePositions: PORTRAIT_NODE_POSITIONS,
    dailyChallengePos: PORTRAIT_DAILY_POS,
  };
}

/** Landscape layout: returns the pre-computed coordinates, aligned to the 1920x1080 background. */
export function landscapeLobbyLayout(): LobbyLayout {
  return {
    nodePositions: LANDSCAPE_NODE_POSITIONS,
    dailyChallengePos: LANDSCAPE_DAILY_POS,
  };
}

// -- Long-axis fit ------------------------------------------------------------
// The node maps are authored for a long-axis of GAME_HEIGHT (1920) logical px,
// with the short axis locked to GAME_WIDTH (1080). On devices whose aspect ratio
// is squarer than the design (e.g. iPad: portrait logical height ~1440), the
// long axis is shorter than 1920, so the last stage nodes (1-5 in portrait, the
// right-most in landscape) fall off-screen. Contract the long axis to fit so the
// whole map stays visible. Never scale up (capped at 1) so taller phones keep the
// original spacing untouched.

// Room reserved past the last node centre on the long axis: node radius (75) plus
// the star pill below it plus a small margin (portrait), or radius + margin
// (landscape, where the star pill sits on the short axis).
const PORTRAIT_END_PAD = 140;
const LANDSCAPE_END_PAD = 110;

function fitLongAxis(layout: LobbyLayout, screen: ScreenConfig): LobbyLayout {
  const landscape = screen.orientation === Orientation.Landscape;
  const actualLong = landscape ? screen.width : screen.height;
  // Tall/wide enough for the authored layout - return it unchanged.
  if (actualLong >= GAME_HEIGHT) return layout;

  const axisOf = (p: { x: number; y: number }): number => (landscape ? p.x : p.y);
  const vals = layout.nodePositions.map(axisOf);
  const srcMin = Math.min(...vals);
  const srcMax = Math.max(...vals);
  const endPad = landscape ? LANDSCAPE_END_PAD : PORTRAIT_END_PAD;

  // Portrait: anchor the top node at its authored y so the map only contracts
  // downward-to-fit (and stays identical when no contraction is needed).
  // Landscape: the daily-challenge panel sits left of every node, so anchor at
  // the origin and contract the whole map toward the left edge.
  const anchor = landscape ? 0 : srcMin;
  const dstMax = actualLong - endPad;
  const scale = Math.min(1, (dstMax - anchor) / (srcMax - anchor));
  const tx = (v: number): number => anchor + (v - anchor) * scale;

  const nodePositions = layout.nodePositions.map((p) =>
    landscape ? { ...p, x: tx(p.x) } : { ...p, y: tx(p.y) }
  );
  const d = layout.dailyChallengePos;
  const dailyChallengePos = landscape ? { x: tx(d.x), y: d.y } : { x: d.x, y: tx(d.y) };
  return { nodePositions, dailyChallengePos };
}

/** Return the layout for the current orientation from the given ScreenConfig. */
export function getLobbyLayout(screen: ScreenConfig): LobbyLayout {
  const base =
    screen.orientation === Orientation.Landscape ? landscapeLobbyLayout() : portraitLobbyLayout();
  return fitLongAxis(base, screen);
}
