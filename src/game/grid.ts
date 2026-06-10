import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { UIElement } from '../inputSystem/uiElement';

const GLOSS_PER_COLOR = 6; // must match webAssetsManager constant
const CELL_GAP = 5; // must match reconfigure() GAP

// -- Selection bounce ---------------------------------------------------------
const BOUNCE_DURATION = 120; // ms - total duration of the scale pop
const BOUNCE_PEAK = 1.12; // max scale overshoot

// -- Fall animation -----------------------------------------------------------
const FALL_DURATION_MS = 180;

interface FallAnim {
  sprite: PIXI.Sprite;
  fromY: number;
  toY: number;
  elapsed: number;
}

// -- Idle shimmer -------------------------------------------------------------
const IDLE_INTERVAL = 1600;
const IDLE_PULSE_DUR = 500;
const IDLE_MIN_ALPHA = 0.78;
const IDLE_MAX_ACTIVE = 2;

interface IdlePulse {
  sprite: PIXI.Sprite;
  elapsed: number;
}

export class Grid extends PIXI.Container {
  private cells: Map<number, PIXI.Sprite> = new Map();
  private cellGlossIdx: Map<number, number> = new Map();
  private cellTier: Map<number, 0 | 1 | 2> = new Map();
  private selectionHighlight: PIXI.Sprite | undefined;

  private bounceElapsed = -1;
  private bounceSprite: PIXI.Sprite | null = null;

  private idleTimer = IDLE_INTERVAL;
  private idlePulses: IdlePulse[] = [];

  private fallAnims: FallAnim[] = [];

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig,
    private readonly onCellClick: (index: number) => void
  ) {
    super();
  }

  private getGlossIdx(idx: number): number {
    if (!this.cellGlossIdx.has(idx)) {
      this.cellGlossIdx.set(idx, Math.floor(Math.random() * GLOSS_PER_COLOR));
    }
    return this.cellGlossIdx.get(idx)!;
  }

  private textureKey(idx: number): string {
    const tier = this.cellTier.get(idx) ?? 0;
    const gloss = this.getGlossIdx(idx);
    return `cell_t${tier}_g${gloss}.png`;
  }

  public setCellTier(idx: number, tier: 0 | 1 | 2): void {
    this.cellTier.set(idx, tier);
    const sprite = this.cells.get(idx);
    if (sprite) {
      sprite.texture = this.ctx.assets.GetTexture(this.textureKey(idx));
    }
  }

  public static tierForValue(value: number, target: number): 0 | 1 | 2 {
    const maxVal = target - 1;
    if (value <= maxVal / 3) return 0;
    if (value <= (maxVal * 2) / 3) return 1;
    return 2;
  }

  public reconfigure(): void {
    const { gridCountW: w, gridCountH: h, gridSize, offsetX, offsetY } = this.screen;
    const activeIndices = new Set<number>();
    const GAP = CELL_GAP;

    for (let col = 0; col < w; ++col) {
      for (let row = 0; row < h; ++row) {
        const idx = this.screen.cellIndex(col, row);
        activeIndices.add(idx);

        let sprite = this.cells.get(idx);

        if (!sprite) {
          sprite = new PIXI.Sprite(this.ctx.assets.GetTexture(this.textureKey(idx)));
          this.addChild(sprite);
          this.cells.set(idx, sprite);

          const capturedIdx = idx;
          this.ctx.input.registerUI(
            new UIElement({
              zIndex: 10,
              sprite,
              onTap: () => this.onCellClick(capturedIdx),
            })
          );
        }

        sprite.x = col * gridSize + offsetX;
        sprite.y = row * gridSize + offsetY;
        sprite.width = gridSize - GAP;
        sprite.height = gridSize - GAP;
        sprite.visible = true;
      }
    }

    for (const [idx, sprite] of this.cells) {
      if (!activeIndices.has(idx)) sprite.visible = false;
    }

    if (this.selectionHighlight) {
      this.selectionHighlight.width = gridSize - CELL_GAP;
      this.selectionHighlight.height = gridSize - CELL_GAP;
    }

    this.hideSelection();
  }

  public showSelection(index: number): void {
    const { gridSize } = this.screen;
    const sz = gridSize - CELL_GAP;

    if (!this.selectionHighlight) {
      this.selectionHighlight = new PIXI.Sprite(this.ctx.assets.GetTexture('cell_selected.png'));
      this.selectionHighlight.width = sz;
      this.selectionHighlight.height = sz;
      this.addChild(this.selectionHighlight);
    } else {
      this.selectionHighlight.width = sz;
      this.selectionHighlight.height = sz;
      this.setChildIndex(this.selectionHighlight, this.children.length - 1);
    }

    const { x, y } = this.screen.indexToPos(index);
    this.selectionHighlight.x = x;
    this.selectionHighlight.y = y;
    this.selectionHighlight.visible = true;

    this.bounceElapsed = 0;
    this.bounceSprite = this.selectionHighlight;
  }

  public hideSelection(): void {
    if (this.selectionHighlight) this.selectionHighlight.visible = false;
    if (this.bounceSprite) {
      this.bounceSprite.scale.set(1);
      this.bounceSprite = null;
    }
    this.bounceElapsed = -1;
  }

  public hideCell(index: number): void {
    const cell = this.cells.get(index);
    if (cell) {
      cell.visible = false;
      this.idlePulses = this.idlePulses.filter((p) => {
        if (p.sprite === cell) {
          p.sprite.alpha = 1;
          return false;
        }
        return true;
      });
    }
  }

  /**
   * Start a fall animation for all visible cells at rows 0..emptyRow (inclusive).
   * Called immediately after syncGrid() has repositioned sprites to their new
   * logical positions. Shifts sprites back up by one gridSize and tweens down.
   */
  public startFallAnims(emptyRow: number): void {
    const { gridCountW: w, gridSize } = this.screen;

    // Snap any in-progress fall anims so we do not compound offsets.
    for (const a of this.fallAnims) a.sprite.y = a.toY;
    this.fallAnims = [];

    for (let col = 0; col < w; col++) {
      for (let row = 0; row <= emptyRow; row++) {
        const idx = this.screen.cellIndex(col, row);
        const sprite = this.cells.get(idx);
        if (!sprite || !sprite.visible) continue;
        const toY = sprite.y;
        sprite.y = toY - gridSize; // shift one row up
        this.fallAnims.push({ sprite, fromY: sprite.y, toY, elapsed: 0 });
      }
    }
  }

  public update(deltaMs: number): void {
    this.updateBounce(deltaMs);
    this.updateIdle(deltaMs);
    this.updateFall(deltaMs);
  }

  private updateBounce(deltaMs: number): void {
    if (this.bounceElapsed < 0 || !this.bounceSprite) return;
    this.bounceElapsed += deltaMs;
    const t = Math.min(this.bounceElapsed / BOUNCE_DURATION, 1);

    const sz = this.screen.gridSize - CELL_GAP;
    let factor: number;
    if (t < 0.5) {
      factor = 1 + (BOUNCE_PEAK - 1) * (t / 0.5);
    } else {
      factor = BOUNCE_PEAK - (BOUNCE_PEAK - 1) * ((t - 0.5) / 0.5);
    }
    this.bounceSprite.width = sz * factor;
    this.bounceSprite.height = sz * factor;

    if (t >= 1) {
      this.bounceSprite.width = sz;
      this.bounceSprite.height = sz;
      this.bounceSprite = null;
      this.bounceElapsed = -1;
    }
  }

  private updateIdle(deltaMs: number): void {
    this.idleTimer -= deltaMs;
    if (this.idleTimer <= 0 && this.idlePulses.length < IDLE_MAX_ACTIVE) {
      this.spawnIdlePulse();
      this.idleTimer = IDLE_INTERVAL * (0.75 + Math.random() * 0.5);
    }

    for (let i = this.idlePulses.length - 1; i >= 0; i--) {
      const p = this.idlePulses[i]!;
      if (!p.sprite.visible) {
        this.idlePulses.splice(i, 1);
        continue;
      }

      p.elapsed += deltaMs;
      const half = IDLE_PULSE_DUR / 2;

      let alpha: number;
      if (p.elapsed < half) {
        alpha = 1 - (1 - IDLE_MIN_ALPHA) * (p.elapsed / half);
      } else if (p.elapsed < IDLE_PULSE_DUR) {
        alpha = IDLE_MIN_ALPHA + (1 - IDLE_MIN_ALPHA) * ((p.elapsed - half) / half);
      } else {
        alpha = 1;
      }
      p.sprite.alpha = alpha;

      if (p.elapsed >= IDLE_PULSE_DUR) {
        p.sprite.alpha = 1;
        this.idlePulses.splice(i, 1);
      }
    }
  }

  private updateFall(deltaMs: number): void {
    for (let i = this.fallAnims.length - 1; i >= 0; i--) {
      const a = this.fallAnims[i]!;
      if (!a.sprite.visible) {
        this.fallAnims.splice(i, 1);
        continue;
      }
      a.elapsed += deltaMs;
      const t = Math.min(a.elapsed / FALL_DURATION_MS, 1);
      // ease-out quad: decelerates into final position
      const eased = 1 - (1 - t) * (1 - t);
      a.sprite.y = a.fromY + (a.toY - a.fromY) * eased;
      if (t >= 1) {
        a.sprite.y = a.toY;
        this.fallAnims.splice(i, 1);
      }
    }
  }

  private spawnIdlePulse(): void {
    const candidates: PIXI.Sprite[] = [];
    for (const [, sprite] of this.cells) {
      if (sprite.visible && sprite.alpha === 1) candidates.push(sprite);
    }
    if (candidates.length === 0) return;

    const sprite = candidates[Math.floor(Math.random() * candidates.length)]!;
    this.idlePulses.push({ sprite, elapsed: 0 });
  }
}
