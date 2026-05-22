import { Orientation } from './enums';
import { GAME_WIDTH, GAME_HEIGHT, OFFSET_Y } from './consts';

export class ScreenConfig {
  public width: number = GAME_WIDTH;
  public height: number = GAME_HEIGHT;
  public scale: number = 1;
  public orientation: Orientation = Orientation.Portrait;

  public readonly gridSize = 120;
  public readonly offsetY = OFFSET_Y;

  public get gridCountW(): number {
    return this.orientation === Orientation.Landscape ? 12 : 6;
  }

  public get gridCountH(): number {
    return this.orientation === Orientation.Landscape ? 6 : 12;
  }

  public get offsetX(): number {
    return this.orientation === Orientation.Landscape ? 300 : 100;
  }

  /** 将列行坐标编码为唯一格子索引 */
  public cellIndex(col: number, row: number): number {
    return col * 1000 + row;
  }

  /** 将格子索引解码为列行坐标 */
  public indexToCell(idx: number): { col: number; row: number } {
    const col = Math.floor(idx / 1000);
    const row = idx - col * 1000;
    return { col, row };
  }

  /** 将格子索引转换为屏幕像素坐标（局部坐标系） */
  public indexToPos(idx: number): { x: number; y: number } {
    const { col, row } = this.indexToCell(idx);
    return {
      x: col * this.gridSize + this.offsetX,
      y: row * this.gridSize + this.offsetY,
    };
  }

  /** 根据窗口尺寸更新屏幕配置（由 GameScene.resize 调用） */
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
