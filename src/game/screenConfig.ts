import { Orientation } from './enums';
import { GAME_WIDTH, OFFSET_Y } from './consts';

export class ScreenConfig {
  public width: number = GAME_WIDTH;
  public height: number = GAME_WIDTH * 16 / 9;
  public scale: number = 1;
  public orientation: Orientation = Orientation.Portrait;

  public readonly offsetY = OFFSET_Y;

  // Explicit grid dimensions driven by stage data; null = auto from orientation
  private _gridW: number | null = null;
  private _gridH: number | null = null;

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
   */
  public get gridCountW(): number {
    if (this._gridW !== null && this._gridH !== null) {
      return this.orientation === Orientation.Landscape ? this._gridH : this._gridW;
    }
    return this.orientation === Orientation.Landscape ? 12 : 6;
  }

  public get gridCountH(): number {
    if (this._gridW !== null && this._gridH !== null) {
      return this.orientation === Orientation.Landscape ? this._gridW : this._gridH;
    }
    return this.orientation === Orientation.Landscape ? 6 : 12;
  }

  /**
   * Cell size: compare width/cols vs available-height/rows and take the smaller.
   *
   *   gridSize = floor( min(width / gridCountW, playH / gridCountH) )
   *
   * where playH = height - offsetY  (the area below the header).
   * This ensures the grid always fits both horizontally and vertically.
   */
  public get gridSize(): number {
    const playH = this.height - this.offsetY;
    return Math.floor(Math.min(this.width / this.gridCountW, playH / this.gridCountH));
  }

  /**
   * Horizontal offset: centers the grid within the full canvas width.
   */
  public get offsetX(): number {
    return (this.width - this.gridCountW * this.gridSize) / 2;
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
      this.scale  = windowHeight / GAME_WIDTH;
      this.height = GAME_WIDTH;
      this.width  = Math.round(windowWidth / this.scale);
    } else {
      this.orientation = Orientation.Portrait;
      this.scale  = windowWidth / GAME_WIDTH;
      this.width  = GAME_WIDTH;
      this.height = Math.round(windowHeight / this.scale);
    }
  }
}
