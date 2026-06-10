import { Orientation } from './enums';
import {
  GAME_WIDTH,
  OFFSET_Y,
  HEADER_X_PORTRAIT,
  HEADER_BAR_W_PORTRAIT,
  HEADER_X_LANDSCAPE,
  HEADER_BAR_W_LANDSCAPE,
} from './consts';

export class ScreenConfig {
  public width: number = GAME_WIDTH;
  public height: number = (GAME_WIDTH * 16) / 9;
  public scale: number = 1;
  public orientation: Orientation = Orientation.Portrait;

  public readonly offsetY = OFFSET_Y;

  // Per-scene header bounds override (null = use consts defaults).
  // Set by each scene via setGridBounds() to align the grid with its own header bar.
  private _headerXPortrait: number | null = null;
  private _headerBarWPortrait: number | null = null;
  private _headerXLandscape: number | null = null;
  private _headerBarWLandscape: number | null = null;

  /**
   * Override the header bar bounds used for grid sizing and centering.
   * Call this when the scene's header bar dimensions differ from the defaults
   * defined in consts.ts (e.g. DailyChallengeScene has a wider header bar).
   *
   * @param portraitX      Header bar left x in portrait (logical px)
   * @param portraitBarW   Header bar width in portrait (logical px)
   * @param landscapeX     Header bar left x in landscape (logical px)
   * @param landscapeBarW  Header bar width in landscape (logical px)
   */
  public setGridBounds(
    portraitX: number,
    portraitBarW: number,
    landscapeX: number,
    landscapeBarW: number
  ): void {
    this._headerXPortrait = portraitX;
    this._headerBarWPortrait = portraitBarW;
    this._headerXLandscape = landscapeX;
    this._headerBarWLandscape = landscapeBarW;
  }

  // Explicit grid dimensions driven by stage data; null = auto from orientation
  private _gridW: number | null = null;
  private _gridH: number | null = null;

  // ── Layout lock ────────────────────────────────────────────────────────
  // Once lockLayout() is called (after numbers are assigned), the grid-related
  // getters return frozen values so that orientation changes mid-game do not
  // alter the cell layout.  width/height/scale still update normally so the
  // background, header and overlays can respond to resize events.
  private _locked = false;
  private _lockedGridCountW: number | null = null;
  private _lockedGridCountH: number | null = null;
  private _lockedGridSize: number | null = null;
  private _lockedOffsetX: number | null = null;

  /** Full logical canvas size captured at lock time. Used by GameScene to
   *  compute the gameContainer scale factor on subsequent resize events. */
  public lockedLogicalW = 0;
  public lockedLogicalH = 0;

  public get isLocked(): boolean {
    return this._locked;
  }

  /**
   * Freeze the grid layout.  Must be called after logic.initialize() and
   * gridLayer.reconfigure() so that all grid-dependent getters return
   * consistent values for the lifetime of the current target.
   */
  public lockLayout(): void {
    this._lockedGridCountW = this.gridCountW;
    this._lockedGridCountH = this.gridCountH;
    this._lockedGridSize = this.gridSize;
    this._lockedOffsetX = this.offsetX;
    this.lockedLogicalW = this.width;
    this.lockedLogicalH = this.height;
    this._locked = true;
  }

  /** Release the layout lock so the next reconfigure() uses the real
   *  (possibly rotated) screen dimensions. */
  public unlockLayout(): void {
    this._locked = false;
    this._lockedGridCountW = null;
    this._lockedGridCountH = null;
    this._lockedGridSize = null;
    this._lockedOffsetX = null;
  }
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Set explicit grid dimensions (called by GameScene with StageData).
   * After calling this, gridCountW/H return the given values.
   */
  public setGridDims(w: number, h: number): void {
    this._gridW = w;
    this._gridH = h;
  }

  /**
   * Horizontal cell count.
   * Stage data stores portrait-oriented dims (fewer cols, more rows).
   * In landscape we swap so the grid fills the wider canvas.
   *   Portrait  [3, 6] -> 3 cols × 6 rows
   *   Landscape [3, 6] -> 6 cols × 3 rows
   * When the layout is locked the frozen value is returned regardless of
   * orientation so mid-game rotation cannot reshape the grid.
   */
  public get gridCountW(): number {
    if (this._locked && this._lockedGridCountW !== null) return this._lockedGridCountW;
    if (this._gridW !== null && this._gridH !== null) {
      return this.orientation === Orientation.Landscape ? this._gridH : this._gridW;
    }
    return this.orientation === Orientation.Landscape ? 12 : 6;
  }

  public get gridCountH(): number {
    if (this._locked && this._lockedGridCountH !== null) return this._lockedGridCountH;
    if (this._gridW !== null && this._gridH !== null) {
      return this.orientation === Orientation.Landscape ? this._gridW : this._gridH;
    }
    return this.orientation === Orientation.Landscape ? 6 : 12;
  }

  /**
   * Cell size: compare width/cols vs available-height/rows and take the smaller.
   *
   *   gridSize = floor( min(headerBarW / gridCountW, playH / gridCountH) )
   *
   * where playH = height - offsetY  (the area below the header) and
   * headerBarW is the inner width of the header bar for the current orientation.
   * This ensures the grid never overflows the header bar horizontally.
   * Returns the frozen value when the layout is locked.
   */
  public get gridSize(): number {
    if (this._locked && this._lockedGridSize !== null) return this._lockedGridSize;
    const barW =
      this.orientation === Orientation.Landscape
        ? (this._headerBarWLandscape ?? HEADER_BAR_W_LANDSCAPE)
        : (this._headerBarWPortrait ?? HEADER_BAR_W_PORTRAIT);
    const playH = this.height - this.offsetY;
    return Math.floor(Math.min(barW / this.gridCountW, playH / this.gridCountH));
  }

  /**
   * Horizontal offset: centers the grid within the header bar so its left/right
   * edges align with the header bar edges.
   * Returns the frozen value when the layout is locked.
   */
  public get offsetX(): number {
    if (this._locked && this._lockedOffsetX !== null) return this._lockedOffsetX;
    const headerX =
      this.orientation === Orientation.Landscape
        ? (this._headerXLandscape ?? HEADER_X_LANDSCAPE)
        : (this._headerXPortrait ?? HEADER_X_PORTRAIT);
    const barW =
      this.orientation === Orientation.Landscape
        ? (this._headerBarWLandscape ?? HEADER_BAR_W_LANDSCAPE)
        : (this._headerBarWPortrait ?? HEADER_BAR_W_PORTRAIT);
    return Math.floor(headerX + (barW - this.gridCountW * this.gridSize) / 2);
  }

  /** Encode (col, row) to a unique cell index */
  public cellIndex(col: number, row: number): number {
    return col * 1000 + row;
  }

  /** Decode a cell index back to (col, row) */
  public indexToCell(idx: number): { col: number; row: number } {
    const col = Math.floor(idx / 1000);
    const row = idx - col * 1000;
    return { col, row };
  }

  /** Convert a cell index to screen pixel coordinates (local space) */
  public indexToPos(idx: number): { x: number; y: number } {
    const { col, row } = this.indexToCell(idx);
    return {
      x: col * this.gridSize + this.offsetX,
      y: row * this.gridSize + this.offsetY,
    };
  }

  /**
   * Update screen config from actual window dimensions.
   *
   * The short side is always fixed to GAME_WIDTH (1080) logical pixels.
   * The long side adapts to the real aspect ratio so the canvas fills the
   * entire screen without letterboxing or black bars.
   *
   *   Portrait  (h >= w): scale = w / GAME_WIDTH,  logicalH = h / scale
   *   Landscape (w >  h): scale = h / GAME_WIDTH,  logicalW = w / scale
   *
   * GameScene / LobbyScene should place themselves at (0, 0) — no centering
   * offset is needed because the logical canvas matches the window exactly.
   */
  public update(windowWidth: number, windowHeight: number): void {
    if (windowWidth > windowHeight) {
      this.orientation = Orientation.Landscape;
      this.scale = windowHeight / GAME_WIDTH;
      this.height = GAME_WIDTH;
      this.width = Math.round(windowWidth / this.scale);
    } else {
      this.orientation = Orientation.Portrait;
      this.scale = windowWidth / GAME_WIDTH;
      this.width = GAME_WIDTH;
      this.height = Math.round(windowHeight / this.scale);
    }
  }
}
