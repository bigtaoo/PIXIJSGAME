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
/**
 * Three tier colours — map small→mid→large numbers to cool→neutral→warm.
 * Index 0 = tier 0 (small numbers), 1 = tier 1 (mid), 2 = tier 2 (large).
 */
export const CELL_PALETTE = [
  0xC5E8FA,  // tier 0 — soft sky blue   (small numbers)
  0xFFF3CC,  // tier 1 — warm cream       (mid numbers)
  0xFFCCBC,  // tier 2 — soft coral/peach (large numbers)
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

  // ── Base fill ──────────────────────────────────────────────────────────────
  g.beginFill(C.bgFill);
  g.drawRect(0, 0, w, h);
  g.endFill();

  // ── Grid lines ─────────────────────────────────────────────────────────────
  const sp        = 24;   // grid spacing (px)
  const lineColor = 0xB8A88A;   // warm tan — warmer than gray, fits stationery theme
  const alphaMin  = 0.22;       // minor lines
  const alphaMaj  = 0.40;       // every 4th line (major grid)

  for (let x = sp; x < w; x += sp) {
    const isMajor = Math.round(x / sp) % 4 === 0;
    g.lineStyle(isMajor ? 1.2 : 0.8, lineColor, isMajor ? alphaMaj : alphaMin);
    g.moveTo(x, 0); g.lineTo(x, h);
  }
  for (let y = sp; y < h; y += sp) {
    const isMajor = Math.round(y / sp) % 4 === 0;
    g.lineStyle(isMajor ? 1.2 : 0.8, lineColor, isMajor ? alphaMaj : alphaMin);
    g.moveTo(0, y); g.lineTo(w, y);
  }

  // ── Small dots at every intersection (minor lines only) ───────────────────
  g.lineStyle(0);
  for (let x = sp; x < w; x += sp) {
    for (let y = sp; y < h; y += sp) {
      const isMajorX = Math.round(x / sp) % 4 === 0;
      const isMajorY = Math.round(y / sp) % 4 === 0;
      if (!isMajorX && !isMajorY) {
        g.beginFill(lineColor, 0.28);
        g.drawCircle(x, y, 1.2);
        g.endFill();
      }
    }
  }

  // ── Vignette: multi-layer gradient-style dark overlay at four edges ──
  // Eight progressively inset strips per edge; quadratic alpha fall-off
  // produces a smooth gradient without a shader.
  const vLayers = 8;
  const vDepth  = Math.min(w, h) * 0.18;
  g.lineStyle(0);
  for (let i = 0; i < vLayers; i++) {
    const frac  = (vLayers - i) / vLayers;   // 1 → 1/vLayers (outermost darkest)
    const alpha = 0.05 * frac * frac;
    const d0    = (i / vLayers) * vDepth;    // outer edge of this strip
    const d1    = ((i + 1) / vLayers) * vDepth; // inner edge
    const thick = d1 - d0;
    g.beginFill(0x3D2200, alpha);
    g.drawRect(0,         d0,         w,     thick); // top
    g.drawRect(0,         h - d1,     w,     thick); // bottom
    g.drawRect(d0,        vDepth,     thick, h - vDepth * 2); // left
    g.drawRect(w - d1,    vDepth,     thick, h - vDepth * 2); // right
    g.endFill();
  }
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
 * Clock face: 3-layer bevel ring + warm face + 12 tick marks + centre dot.
 * Drawing region (0, 0, radius*2, radius*2).
 *
 * Designed to remain readable when the caller applies a red tint (warning state):
 * the near-white face turns bright red, the dark-brown ticks become dark red.
 */
export function drawClockFace(g: PIXI.Graphics, radius: number): void {
  const cx     = radius;
  const cy     = radius;
  const rOuter = radius - 2;   // outer edge of the rim ring
  const rRim   = rOuter - Math.round(radius * 0.10);  // dark-to-gold border
  const rFace  = rRim   - Math.round(radius * 0.07);  // gold-to-face border

  // ── Drop shadow (creates elevation above the header bar) ─────────────
  g.lineStyle(0);
  g.beginFill(0x3D2200, 0.22);
  g.drawCircle(cx + Math.round(radius * 0.04), cy + Math.round(radius * 0.06), rOuter);
  g.endFill();

  // ── Outer rim — dark warm brown ──────────────────────────────────────
  g.beginFill(0x7A5530);
  g.drawCircle(cx, cy, rOuter);
  g.endFill();

  // ── Inner ring — warm gold (bevel highlight) ─────────────────────────
  g.beginFill(0xE8C060);
  g.drawCircle(cx, cy, rRim);
  g.endFill();

  // ── Main face — near-white warm cream ────────────────────────────────
  // Keep close to white so the warning red-tint (0xFF5252) renders as bright red.
  g.beginFill(0xFFF8F0);
  g.drawCircle(cx, cy, rFace);
  g.endFill();

  // ── 12 tick marks ─────────────────────────────────────────────────────
  const tickOuter = rFace - Math.round(radius * 0.03);
  for (let i = 0; i < 12; i++) {
    const a       = (i * Math.PI) / 6 - Math.PI / 2;
    const isMajor = i % 3 === 0;
    const tickLen = Math.round(radius * (isMajor ? 0.22 : 0.13));
    const lw      = isMajor ? Math.round(radius * 0.06) : Math.round(radius * 0.04);
    g.lineStyle(lw, 0x6B4C2A, isMajor ? 1.0 : 0.65);
    g.moveTo(cx + Math.cos(a) * (tickOuter - tickLen), cy + Math.sin(a) * (tickOuter - tickLen));
    g.lineTo(cx + Math.cos(a) *  tickOuter,            cy + Math.sin(a) *  tickOuter);
  }

  // ── Centre dot ────────────────────────────────────────────────────────
  g.lineStyle(0);
  g.beginFill(0x6B4C2A);
  g.drawCircle(cx, cy, Math.round(radius * 0.09));
  g.endFill();
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

// ─── Button background ────────────────────────────────────────────────────────

/**
 * Warm parchment rounded-rect button background.
 * Drawing region (0, 0, size, size).
 * Call this BEFORE drawing the icon so the icon renders on top.
 */
export function drawButtonBackground(g: PIXI.Graphics, size: number): void {
  const r  = Math.round(size * 0.20);
  const bw = Math.max(3, Math.round(size * 0.025));

  // Drop shadow
  g.lineStyle(0);
  g.beginFill(0x3D2200, 0.20);
  g.drawRoundedRect(2, 3, size, size, r);
  g.endFill();

  // Main body
  g.lineStyle(bw, 0xC4A870, 1);
  g.beginFill(0xEEDFBD);
  g.drawRoundedRect(0, 0, size, size, r);
  g.endFill();

  // Top highlight strip
  g.lineStyle(0);
  g.beginFill(0xFFFFFF, 0.15);
  g.drawRoundedRect(bw, bw, size - bw * 2, size * 0.35, r - 2);
  g.endFill();
}

// ─── Button icons ─────────────────────────────────────────────────────────────

/** Retry icon (arc arrow).
 *  @param ox  X offset of the icon's (0,0) corner within the Graphics (default 0)
 *  @param oy  Y offset of the icon's (0,0) corner within the Graphics (default 0)
 */
export function drawRetryIcon(g: PIXI.Graphics, size: number, ox = 0, oy = 0): void {
  const cx = ox + size / 2;
  const cy = oy + size / 2;
  const r  = size * 0.33;
  const sw = Math.max(5, Math.round(size * 0.1));

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

/** Solid right-pointing triangle (next level).
 *  @param ox  X offset (default 0)
 *  @param oy  Y offset (default 0)
 */
export function drawNextIcon(g: PIXI.Graphics, size: number, ox = 0, oy = 0): void {
  const pad = size * 0.22;
  g.lineStyle(0);
  g.beginFill(C.icon);
  g.drawPolygon([
    ox + pad,          oy + pad,
    ox + size - pad,   oy + size / 2,
    ox + pad,          oy + size - pad,
  ]);
  g.endFill();
}

/** Hamburger menu (settings).
 *  @param ox  X offset (default 0)
 *  @param oy  Y offset (default 0)
 */
export function drawSettingsIcon(g: PIXI.Graphics, size: number, ox = 0, oy = 0): void {
  const pad  = size * 0.2;
  const barH = Math.round(size * 0.13);
  const barW = size - pad * 2;
  const gap  = (size - pad * 2 - barH * 3) / 2;
  g.lineStyle(0);
  g.beginFill(C.icon);
  for (let i = 0; i < 3; i++) {
    g.drawRoundedRect(ox + pad, oy + pad + i * (barH + gap), barW, barH, barH / 2);
  }
  g.endFill();
}

/** 2×2 grid (return to lobby).
 *  @param ox  X offset (default 0)
 *  @param oy  Y offset (default 0)
 */
export function drawLobbyIcon(g: PIXI.Graphics, size: number, ox = 0, oy = 0): void {
  const pad = size * 0.18;
  const gap = size * 0.1;
  const sq  = (size - pad * 2 - gap) / 2;
  g.lineStyle(0);
  g.beginFill(C.icon);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      g.drawRoundedRect(
        ox + pad + col * (sq + gap),
        oy + pad + row * (sq + gap),
        sq, sq, 4,
      );
    }
  }
  g.endFill();
}

// ─── Panel ────────────────────────────────────────────────────────────────────

/**
 * Pop-up panel (result / settings overlay): warm parchment paper look —
 * shadow + warm-gold border + paper fill + subtle grid-dot pattern + top highlight.
 * Drawing region (0, 0, w+4, h+5).
 */
export function drawPanel(g: PIXI.Graphics, w: number, h: number): void {
  const r  = 22;
  const bw = 3;

  // ── Drop shadow ──────────────────────────────────────────────────────────
  g.lineStyle(0);
  g.beginFill(0x3D2200, 0.18);
  g.drawRoundedRect(4, 5, w, h, r);
  g.endFill();

  // ── Main body — warm parchment ───────────────────────────────────────────
  g.lineStyle(bw, 0xC4A870, 1);
  g.beginFill(0xFDF6E3);
  g.drawRoundedRect(0, 0, w, h, r);
  g.endFill();

  // ── Inner grid-dot pattern (graph-paper feel) ────────────────────────────
  const spacing = 24;
  const dotR    = 1.5;
  const pad     = r + 4;
  g.lineStyle(0);
  g.beginFill(0xB0A090, 0.30);
  for (let x = pad; x < w - pad + 1; x += spacing) {
    for (let y = pad; y < h - pad + 1; y += spacing) {
      g.drawCircle(x, y, dotR);
    }
  }
  g.endFill();

  // ── Top highlight strip ───────────────────────────────────────────────────
  g.lineStyle(0);
  g.beginFill(0xFFFFFF, 0.25);
  g.drawRoundedRect(bw + 2, bw + 2, w - (bw + 2) * 2, h * 0.22, r - 4);
  g.endFill();
}

/**
 * Header background bar: warm parchment panel floating above the grid-paper
 * background.  A soft drop-shadow below the bar sells the "raised tile" look.
 * Drawing region (0, 0, w, h); shadow extends slightly below h.
 */
export function drawHeaderBar(g: PIXI.Graphics, w: number, h: number): void {
  const r = 16;

  // ── Drop shadow ── dark warm stripe offset 5 px down, alpha 0.18
  g.lineStyle(0);
  g.beginFill(0x3D2200, 0.18);
  g.drawRoundedRect(3, 5, w - 3, h, r);
  g.endFill();

  // ── Main bar ── warm parchment, warm gold border
  g.lineStyle(1.5, 0xC4A068, 0.55);
  g.beginFill(0xEAD5A8);
  g.drawRoundedRect(0, 0, w, h, r);
  g.endFill();

  // ── Subtle top highlight ── gives a slight convex / raised feel
  g.lineStyle(0);
  g.beginFill(0xFFFFFF, 0.18);
  g.drawRoundedRect(5, 3, w - 10, h * 0.38, r - 2);
  g.endFill();
}

// ─── Text-substitute symbols ───────────────────────────────────────────────────

/**
 * Question mark, used when a tip slot has not been filled.
 * Drawn centred at (cx, cy) within a region of height approximately h.
 * Colour is warm brown 0x8B6030, matching the header's warm palette.
 */
export function drawQuestionMark(g: PIXI.Graphics, cx: number, cy: number, h: number): void {
  const sw    = Math.round(h * 0.13);
  const r     = h * 0.19;
  const color = 0x8B6030;

  g.lineStyle(sw, color, 1);
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
  g.beginFill(color);
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
 * Combo glow overlay for a single cell: concentric filled circles fading outward.
 * Drawing region (0, 0, size, size). Callers tint the sprite gold or green.
 * Uses 16 concentric rings with a cubic ease-out alpha curve for a smooth
 * radial gradient appearance.
 */
export function drawComboGlow(g: PIXI.Graphics, size: number): void {
  const cx   = size / 2;
  const cy   = size / 2;
  const maxR = size / 2;
  const steps = 16;
  g.lineStyle(0);
  // Draw from outermost inward so inner rings paint over outer (correct blending).
  for (let i = steps; i >= 1; i--) {
    const r    = maxR * (i / steps);
    // Cubic ease-out: alpha peaks near the centre, falls quickly outward.
    const norm = i / steps;                  // 1 at centre, 1/steps at edge
    const a    = 0.22 * (1 - norm) * (1 - norm) * (1 - norm * 0.5);
    if (a <= 0) continue;
    g.beginFill(0xFFFFFF, a);
    g.drawCircle(cx, cy, r);
    g.endFill();
  }
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
