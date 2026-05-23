import { Orientation } from './enums';
import { GAME_WIDTH, GAME_HEIGHT, OFFSET_Y } from './consts';

export class ScreenConfig {
  public width: number = GAME_WIDTH;
  public height: number = GAME_HEIGHT;
  public scale: number = 1;
  public orientation: Orientation = Orientation.Portrait;

  public readonly offsetY = OFFSET_Y;

  // Minimum padding around the grid (logical pixels)
  private static readonly H_PAD = 20;  // left + right each
  private static readonly V_PAD = 20;  // bottom

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

  public get gridCountW(): number {
    if (this._gridW !== null) return this._gridW;
    return this.orientation === Orientation.Landscape ? 12 : 6;
  }

  public get gridCountH(): number {
    if (this._gridH !== null) return this._gridH;
    return this.orientation === Orientation.Landscape ? 6 : 12;
  }

  /**
   * Dynamic grid cell size: fills the canvas based on available area and cell count.
   *
   *   availW = width  - H_PAD * 2
   *   availH = height - offsetY - V_PAD
   *   gridSize = floor( min(availW / gridCountW, availH / gridCountH) )
   */
  public get gridSize(): number {
    const availW = this.width  - ScreenConfig.H_PAD * 2;
    const availH = this.height - this.offsetY - ScreenConfig.V_PAD;
    return Math.floor(Math.min(availW / this.gridCountW, availH / this.gridCountH));
  }

  /**
   * Horizontal offset: centers the grid on the canvas.
   *   offsetX = (width - gridCountW * gridSize) / 2
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

  /** Update screen config from window dimensions (called by GameScene.resize) */
  public update(windowWidth: number, windowHeight: number): void {
    if (windowWidth > windowHeight) {
      this.width = GAME_HEIGHT;
      this.height = GAME_WIDTH;
      this.orientation = Orientation.Landscape;
    } else {
      this.width = GAME_WIDTH;
      this.height = GAME_HEIGHT;
      this.orientation = Orientation.Portrait;
    }
    this.scale = Math.min(windowWidth / this.width, windowHeight / this.height);
  }
}
