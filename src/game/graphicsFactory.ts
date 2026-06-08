/**
 * graphicsFactory.ts
 *
 * Central module for all programmatic drawing functions.
 * Each function accepts a PIXI.Graphics and draws into it in-place; no state is held.
 *
 * makeTexture() is a utility that renders a drawing into a RenderTexture for use as a Sprite.
 */

import * as PIXI from 'pixi.js-legacy';

// ─── Cell colour palette (exported so assetsManager can generate per-colour textures) ──
export const CELL_PALETTE = [
  0xFFF3CC,  // warm honey cream
  0xC5E8FA,  // soft sky blue
  0xFFCCBC,  // soft coral / peach
  0xD8F0D0,  // soft sage green
] as const;

/** One gloss ellipse: position + size as fractions of cell size. */
export interface GlossEllipse { cx: number; cy: number; rx: number; ry: number; }

// ─── Internal helper ──────────────────────────────────────────────────────────

/** Darken a hex colour by `amount` (0–1). */
function darkenHex(color: number, amount: number): number {
  const f = 1 - amount;
  const r = Math.round(((color >> 16) & 0xFF) * f);
  const g = Math.round(((color >> 8)  & 0xFF) * f);
  const b = Math.round((color & 0xFF) * f);
  return (r << 16) | (g << 8) | b;
}

// ─── Colour palette ───────────────────────────────────────────────────────────

export const C = {
  // Background
  bgFill:        0xEDE8DC,
  bgLine:        0xCCCCCC,
  bgLineAlpha:   0.12,

  // Cell · normal
  cellFill:      0xFAFAF8,
  cellBorder:    0xE0DAD0,

  // Cell · selected
  cellSelFill:   0xFBF8EE,
  cellSelBorder: 0xEAB830,

  // Lobby node circle (warmer parchment tone)
  nodeFill:      0xEEDFBD,
  nodeSelFill:   0xF5EAC8,
  nodeBorder:    0xC4A870,

  // Panel (Header / result overlay / settings overlay)
  panelFill:     0xFAFAF8,
  panelBorder:   0xE0DAD0,

  // Clock
  clockFace:     0xFAFAF8,
  clockBorder:   0x5D4037,
  clockHand:     0x3E2723,

  // Shared icon colour
  icon:          0x5D4037,
};

// ─── Background ───────────────────────────────────────────────────────────────

/**
 * Grid-paper background: warm-beige fill + light-grey grid lines (20px spacing).
 * No need to call clear() before this.
 */
export function drawBackground(g: PIXI.Graphics, w: number, h: number): void {
  g.clear();
  g.beginFill(C.bgFill);
  g.drawRect(0, 0, w, h);
  g.endFill();

  g.lineStyle(1, C.bgLine, C.bgLineAlpha);
  const sp = 20;
  for (let x = sp; x < w; x += sp) { g.moveTo(x, 0); g.lineTo(x, h); }
  for (let y = sp; y < h; y += sp) { g.moveTo(0, y); g.lineTo(w, y); }
}

// ─── Cell ─────────────────────────────────────────────────────────────────────

/**
 * Normal cell: coloured rounded rectangle with 3-D depth effect.
 *   - Bottom shadow strip (darker shade of fillColor) gives a "raised tile" look.
 *   - Top-left gloss ellipse (semi-transparent white) simulates a light source.
 * Drawing region (0, 0, size, size).
 */
export function drawCell(
  g: PIXI.Graphics,
  size: number,
  fillColor: number = C.cellFill,
  glossEllipses: readonly GlossEllipse[] = [{ cx: 0.31, cy: 0.19, rx: 0.19, ry: 0.10 }],
): void {
  const r      = Math.round(size * 0.18);
  const depth  = Math.round(size * 0.10);
  const shadow = darkenHex(fillColor, 0.28);

  // ── Layer 1: shadow strip ──────────────────────────────────────────────────
  g.lineStyle(0);
  g.beginFill(shadow);
  g.drawRoundedRect(0, depth, size, size - depth, r);
  g.endFill();

  // ── Layer 2: main tile body ────────────────────────────────────────────────
  g.beginFill(fillColor);
  g.drawRoundedRect(0, 0, size, size - depth, r);
  g.endFill();

  // ── Layer 3: gloss ellipses (1 large / 2 medium / 3 small, random positions)
  for (const { cx, cy, rx, ry } of glossEllipses) {
    g.beginFill(0xFFFFFF, 0.38);
    g.drawEllipse(size * cx, size * cy, size * rx, size * ry);
    g.endFill();
  }
}

/**
 * Selected cell: gold border + 3-D depth effect matching drawCell.
 * Drawing region (0, 0, size, size).
 */
export function drawCellSelected(g: PIXI.Graphics, size: number): void {
  const r     = Math.round(size * 0.18);
  const depth = Math.round(size * 0.10);
  const bw    = Math.max(5, Math.round(size * 0.05));
  const shadow = darkenHex(C.cellSelFill, 0.22);

  // Shadow strip
  g.lineStyle(0);
  g.beginFill(shadow);
  g.drawRoundedRect(0, depth, size, size - depth, r);
  g.endFill();

  // Main tile with gold border
  g.lineStyle(bw, C.cellSelBorder, 1);
  g.beginFill(C.cellSelFill);
  g.drawRoundedRect(bw / 2, bw / 2, size - bw, size - depth - bw / 2, r);
  g.endFill();

  // Gloss
  g.lineStyle(0);
  g.beginFill(0xFFFFFF, 0.40);
  g.drawEllipse(size * 0.31, size * 0.19, size * 0.19, size * 0.10);
  g.endFill();
}

// ─── Stage lobby circular nodes ───────────────────────────────────────────────

/**
 * Normal circular cell: warm-white fill + light border, inscribed in a size×size square.
 */
export function drawCircleCell(g: PIXI.Graphics, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 2;
  g.lineStyle(2, C.nodeBorder, 0.8);
  g.beginFill(C.nodeFill);
  g.drawCircle(cx, cy, r);
  g.endFill();
}

/**
 * Selected circular cell: gold border + slightly brighter fill, inscribed in a size×size square.
 */
export function drawCircleCellSelected(g: PIXI.Graphics, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const bw = Math.max(5, Math.round(size * 0.042));
  const r  = size / 2 - bw / 2;
  g.lineStyle(bw, C.cellSelBorder, 1);
  g.beginFill(C.nodeSelFill);
  g.drawCircle(cx, cy, r);
  g.endFill();
}

// ─── Clock ────────────────────────────────────────────────────────────────────

/**
 * Clock face: circle + centre dot + 4 tick marks.
 * Drawing region (0, 0, radius*2, radius*2).
 */
export function drawClockFace(g: PIXI.Graphics, radius: number): void {
  const cx = radius;
  const cy = radius;
  const r  = radius - 3;

  // Clock face
  g.lineStyle(3, C.clockBorder, 1);
  g.beginFill(C.clockFace);
  g.drawCircle(cx, cy, r);
  g.endFill();

  // Centre dot
  g.lineStyle(0);
  g.beginFill(C.clockBorder);
  g.drawCircle(cx, cy, 3);
  g.endFill();

  // 4 tick marks (12 / 3 / 6 / 9 o'clock positions)
  g.lineStyle(3, C.clockBorder, 0.7);
  for (let i = 0; i < 4; i++) {
    const a     = (i * Math.PI) / 2 - Math.PI / 2;
    const inner = r - 9;
    const outer = r - 2;
    g.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    g.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
  }
}

/**
 * Clock hand: a downward-pointing rounded rectangle from (0,0) to (width, length).
 *
 * Usage (inside Header):
 *   sprite.pivot.set(width/2, 0)   // pivot at top-centre (connecting to the clock face centre)
 *   sprite.position.set(cx, cy)    // place at the clock face centre
 *   sprite.rotation = Math.PI + (1 - ratio) * Math.PI * 2  // 12 o'clock = full time
 */
export function drawClockHand(g: PIXI.Graphics, length: number, width = 6): void {
  g.lineStyle(0);
  g.beginFill(C.clockHand);
  g.drawRoundedRect(0, 0, width, length, width / 2);
  g.endFill();
}

// ─── Symbols ──────────────────────────────────────────────────────────────────

/** Plus sign, drawing region (0, 0, w, h). */
export function drawPlus(g: PIXI.Graphics, w: number, h: number): void {
  const t = Math.round(Math.min(w, h) * 0.22);
  g.lineStyle(0);
  g.beginFill(C.icon);
  g.drawRoundedRect((w - t) / 2, 0,       t, h, t / 2); // vertical bar
  g.drawRoundedRect(0,           (h - t) / 2, w, t, t / 2); // horizontal bar
  g.endFill();
}

/** Equals sign, drawing region (0, 0, w, h). */
export function drawEquals(g: PIXI.Graphics, w: number, h: number): void {
  const barH = Math.round(h * 0.22);
  const gap  = Math.round(h * 0.20);
  const total = barH * 2 + gap;
  const y0   = (h - total) / 2;
  g.lineStyle(0);
  g.beginFill(C.icon);
  g.drawRoundedRect(0, y0,              w, barH, barH / 2);
  g.drawRoundedRect(0, y0 + barH + gap, w, barH, barH / 2);
  g.endFill();
}

// ─── Button icons ─────────────────────────────────────────────────────────────

/** Retry icon (arc arrow), drawing region (0, 0, size, size). */
export function drawRetryIcon(g: PIXI.Graphics, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.33;
  const sw = Math.max(5, Math.round(size * 0.1));

  // Arc: from approximately -135° clockwise to about 120°
  g.lineStyle(sw, C.icon, 1);
  g.arc(cx, cy, r, -Math.PI * 0.75, Math.PI * 0.67);

  // Triangular arrowhead at the arc end.
  // Base sits at the arc endpoint; tip extends in the travel direction.
  const endA  = Math.PI * 0.67;
  const ax    = cx + Math.cos(endA) * r;  // arc endpoint (= base centre)
  const ay    = cy + Math.sin(endA) * r;
  const tA    = endA + Math.PI / 2;       // tangent = travel direction
  const ah    = sw * 2.5;                 // arrowhead length (base → tip)
  const hw    = sw * 1.3;                 // arrowhead half-width
  const perpA = tA + Math.PI / 2;        // perpendicular to tangent
  // Slide the base 3 px back so it overlaps the arc stroke for a seamless join.
  const overlap = 3;
  const bx = ax - Math.cos(tA) * overlap;
  const by = ay - Math.sin(tA) * overlap;
  const tipX = bx + Math.cos(tA) * ah;
  const tipY = by + Math.sin(tA) * ah;
  g.lineStyle(0);
  g.beginFill(C.icon);
  g.drawPolygon([
    tipX, tipY,                                                // arrowhead tip
    bx + Math.cos(perpA) * hw, by + Math.sin(perpA) * hw,    // base corner 1
    bx - Math.cos(perpA) * hw, by - Math.sin(perpA) * hw,    // base corner 2
  ]);
  g.endFill();
}

/** Solid right-pointing triangle (next level), drawing region (0, 0, size, size). */
export function drawNextIcon(g: PIXI.Graphics, size: number): void {
  const pad = size * 0.22;
  g.lineStyle(0);
  g.beginFill(C.icon);
  g.drawPolygon([
    pad,          pad,
    size - pad,   size / 2,
    pad,          size - pad,
  ]);
  g.endFill();
}

/** Hamburger menu (settings), drawing region (0, 0, size, size). */
export function drawSettingsIcon(g: PIXI.Graphics, size: number): void {
  const pad  = size * 0.2;
  const barH = Math.round(size * 0.13);
  const barW = size - pad * 2;
  const gap  = (size - pad * 2 - barH * 3) / 2;
  g.lineStyle(0);
  g.beginFill(C.icon);
  for (let i = 0; i < 3; i++) {
    g.drawRoundedRect(pad, pad + i * (barH + gap), barW, barH, barH / 2);
  }
  g.endFill();
}

/** 2×2 grid (return to lobby), drawing region (0, 0, size, size). */
export function drawLobbyIcon(g: PIXI.Graphics, size: number): void {
  const pad = size * 0.18;
  const gap = size * 0.1;
  const sq  = (size - pad * 2 - gap) / 2;
  g.lineStyle(0);
  g.beginFill(C.icon);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      g.drawRoundedRect(
        pad + col * (sq + gap),
        pad + row * (sq + gap),
        sq, sq, 4,
      );
    }
  }
  g.endFill();
}

// ─── Panel ────────────────────────────────────────────────────────────────────

/**
 * Pop-up panel (result / settings overlay): warm-white rounded rectangle + subtle shadow.
 * Drawing region (0, 0, w+4, h+4) (shadow offset 4px down-right).
 */
export function drawPanel(g: PIXI.Graphics, w: number, h: number): void {
  const r = 20;
  // Shadow layer
  g.lineStyle(0);
  g.beginFill(0x000000, 0.15);
  g.drawRoundedRect(4, 4, w, h, r);
  g.endFill();
  // Main panel
  g.lineStyle(1.5, C.panelBorder, 0.7);
  g.beginFill(C.panelFill);
  g.drawRoundedRect(0, 0, w, h, r);
  g.endFill();
}

/**
 * Header background bar: warm-white rounded rectangle, no shadow.
 * Drawing region (0, 0, w, h).
 */
export function drawHeaderBar(g: PIXI.Graphics, w: number, h: number): void {
  g.lineStyle(1, C.panelBorder, 0.6);
  g.beginFill(C.panelFill);
  g.drawRoundedRect(0, 0, w, h, 16);
  g.endFill();
}

// ─── Text-substitute symbols ───────────────────────────────────────────────────

/**
 * Question mark, used when a tip slot has not been filled.
 * Drawn centred at (cx, cy) within a region of height approximately h.
 * Colour is fixed at light-grey 0xBBBBBB, matching the original text style.
 */
export function drawQuestionMark(g: PIXI.Graphics, cx: number, cy: number, h: number): void {
  const sw = Math.round(h * 0.13);
  const r  = h * 0.19;

  g.lineStyle(sw, 0xBBBBBB, 1);
  // Upper arc: semicircle (left to right)
  g.arc(cx, cy - h * 0.14, r, Math.PI, 0, false);
  // Curve down to the stem
  g.bezierCurveTo(
    cx + r,  cy - h * 0.14 + r,
    cx,      cy + h * 0.02,
    cx,      cy + h * 0.10,
  );

  // Lower dot
  g.lineStyle(0);
  g.beginFill(0xBBBBBB);
  g.drawCircle(cx, cy + h * 0.30, sw * 0.75);
  g.endFill();
}

/**
 * Letter "s", drawing region (0, 0, w, h).
 * Drawn with white (0xFFFFFF) outline; callers tint the sprite gold or green.
 */
export function drawLetterS(g: PIXI.Graphics, w: number, h: number): void {
  const sw = Math.round(Math.min(w, h) * 0.37);
  g.lineStyle(sw, 0xFFFFFF, 1);

  // Upper C-arc (opens to the left)
  g.moveTo(w * 0.78, h * 0.18);
  g.bezierCurveTo(w * 0.78, h * 0.01, w * 0.08, h * 0.01, w * 0.08, h * 0.30);
  g.bezierCurveTo(w * 0.08, h * 0.48, w * 0.92, h * 0.52, w * 0.92, h * 0.70);
  // Lower C-arc (opens to the right)
  g.bezierCurveTo(w * 0.92, h * 0.99, w * 0.22, h * 0.99, w * 0.22, h * 0.82);
}

// ─── Utility functions ────────────────────────────────────────────────────────

/**
 * Render a draw function into a fixed-size RenderTexture and destroy the temporary Graphics.
 *
 * @param renderer  PIXI.Renderer instance (from AppContext)
 * @param drawFn    Function that performs the drawing on the Graphics object
 * @param w         Texture width (logical pixels)
 * @param h         Texture height (logical pixels; defaults to w)
 */
export function makeTexture(
  renderer: PIXI.Renderer,
  drawFn: (g: PIXI.Graphics) => void,
  w: number,
  h: number = w,
): PIXI.RenderTexture {
  const g = new PIXI.Graphics();
  drawFn(g);
  const tex = renderer.generateTexture(g, { region: new PIXI.Rectangle(0, 0, w, h) });
  g.destroy();
  return tex;
}
