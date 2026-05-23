import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { Logic } from './logic';

/**
 * 每个格子最多持有两个 Sprite 槽（个位 / 十位）。
 * Sprite 只创建、不销毁，切换数字时复用并更新贴图，多余的槽隐藏。
 */
interface CellSlots {
  /** slots[0] = 个位（单数字时只用它），slots[1] = 十位（两位数时追加） */
  slots: [PIXI.Sprite] | [PIXI.Sprite, PIXI.Sprite];
}

export class NumberLayer extends PIXI.Container {
  /** cellIndex → CellSlots */
  private cells: Map<number, CellSlots> = new Map();

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig,
  ) {
    super();
  }

  // ── 公开接口 ──────────────────────────────────────────────────────────

  public draw(logic: Logic): void {
    const { gridCountW: w, gridCountH: h } = this.screen;
    for (let col = 0; col < w; ++col) {
      for (let row = 0; row < h; ++row) {
        const n = logic.getNumber(this.screen, col, row);
        const idx = this.screen.cellIndex(col, row);
        this.updateCell(idx, col, row, n);
      }
    }
  }

  public hideNumber(index: number): void {
    const cell = this.cells.get(index);
    if (cell) cell.slots.forEach((s) => (s.visible = false));
  }

  /** 新游戏时重绘所有数字（复用已有 Sprite） */
  public reset(logic: Logic): void {
    this.draw(logic);
  }

  // ── 内部实现 ──────────────────────────────────────────────────────────

  /**
   * 根据数值 n 决定单/双位布局，创建或复用 Sprite。
   *
   * 单位数：一个 Sprite，填满整个格子（gridSize × gridSize）
   * 两位数：两个 Sprite，各占格子宽度的一半，整体缩放至格子的 70%，水平垂直居中
   */
  private updateCell(idx: number, col: number, row: number, n: number): void {
    const { gridSize, offsetX, offsetY } = this.screen;
    const cellX = col * gridSize + offsetX;
    const cellY = row * gridSize + offsetY;

    const str = n.toString();          // e.g. 15 → "15", 7 → "7"
    const isTwoDigit = str.length >= 2;

    if (isTwoDigit) {
      this.layoutTwoDigits(idx, cellX, cellY, gridSize, str[0], str[1]);
    } else {
      this.layoutOneDigit(idx, cellX, cellY, gridSize, str[0]);
    }
  }

  // ── 单位数布局 ────────────────────────────────────────────────────────

  private layoutOneDigit(
    idx: number,
    cellX: number,
    cellY: number,
    gs: number,
    digit: string,
  ): void {
    const cell = this.getOrCreateCell(idx, digit, false);
    const s = cell.slots[0];

    s.texture = this.ctx.assets.GetTexture(`${digit}.png`);
    s.width = gs;
    s.height = gs;
    s.x = cellX;
    s.y = cellY;
    s.visible = true;

    // 隐藏多余的十位槽（如果存在）
    if (cell.slots.length > 1) cell.slots[1]!.visible = false;
  }

  // ── 两位数布局 ────────────────────────────────────────────────────────

  private layoutTwoDigits(
    idx: number,
    cellX: number,
    cellY: number,
    gs: number,
    tensChar: string,
    unitsChar: string,
  ): void {
    const cell = this.getOrCreateCell(idx, tensChar, true);

    // 整体缩放到格子 70%，两个数字各占一半宽度
    const scale = 0.70;
    const totalW = gs * scale;
    const dw = totalW / 2;        // 每个数字宽度
    const dh = gs * scale;        // 每个数字高度
    const marginX = (gs - totalW) / 2;   // 水平居中偏移
    const marginY = (gs - dh) / 2;       // 垂直居中偏移

    const digits = [tensChar, unitsChar];
    for (let i = 0; i < 2; i++) {
      const s = cell.slots[i as 0 | 1]!;
      s.texture = this.ctx.assets.GetTexture(`${digits[i]}.png`);
      s.width = dw;
      s.height = dh;
      s.x = cellX + marginX + i * dw;
      s.y = cellY + marginY;
      s.visible = true;
    }
  }

  // ── Sprite 缓存管理 ───────────────────────────────────────────────────

  /**
   * 取出已有的 CellSlots，或首次创建。
   * needSecond=true 时确保 slots[1] 也存在。
   */
  private getOrCreateCell(
    idx: number,
    firstDigit: string,
    needSecond: boolean,
  ): CellSlots {
    let cell = this.cells.get(idx);

    if (!cell) {
      // 首次创建：至少建一个 Sprite
      const s0 = this.makeSprite(firstDigit);
      cell = { slots: [s0] } as CellSlots;
      this.cells.set(idx, cell);
    }

    if (needSecond && cell.slots.length < 2) {
      // 按需追加第二个 Sprite（十位 → 个位 旁边）
      const s1 = this.makeSprite('0');
      (cell.slots as PIXI.Sprite[]).push(s1);
    }

    return cell;
  }

  private makeSprite(digit: string): PIXI.Sprite {
    const s = this.ctx.assets.GetSpriteFromNumberAtlas(`${digit}.png`);
    this.addChild(s);
    return s;
  }
}
