import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { UIElement } from '../inputSystem/uiElement';
import { Orientation } from './enums';
import { drawHeaderBar, drawQuestionMark } from './graphicsFactory';

/** 时间警告阈值（秒）：低于此值时闹钟容器变红。 */
const WARN_THRESHOLD = 10;

/** 计算指针角度的参考时长（秒）：超过此值时指针停在 12 点。 */
const CLOCK_REF_SECS = 30;

// ── 布局配置 ──────────────────────────────────────────────────────────────────

interface HeaderLayout {
  /** Header 背景条宽度（local 空间）*/
  barW: number;
  barH: number;

  // ── 提示公式 ──────────────────────────────────────────────────────────────
  tipY: number;
  tipSlotW: number;
  tipSlotH: number;
  tipSlot1X: number;    // 左槽 x
  tipPlusX: number;     // 加号 x
  tipSlot2X: number;    // 右槽 x
  tipEquaX: number;     // 等号 x
  tipTargetX: number;   // 目标数字起始 x
  tipTargetStep: number;// 每个数字字符的步进宽度

  // ── 闹钟 ──────────────────────────────────────────────────────────────────
  clockX: number;
  clockY: number;
  clockSize: number;   // 表盘直径（clockRadius = clockSize / 2）

  // ── 时间数字 ──────────────────────────────────────────────────────────────
  timeStartX: number;
  timeY: number;
  timeDigitW: number;
  timeDigitH: number;
  timeDigitGap: number;

  // ── 命数心形 ──────────────────────────────────────────────────────────────
  livesStartX: number;
  livesY: number;
  heartSize: number;
  heartGap: number;

  // ── 设置按钮 ──────────────────────────────────────────────────────────────
  settingsX: number;
  settingsY: number;
  settingsSize: number;
}

/** 横屏布局（Header 居于画布右侧，left offset 350，bar 宽 1350）。 */
function landscapeLayout(): HeaderLayout {
  return {
    barW: 1350, barH: 250,
    tipY: 85, tipSlotW: 80, tipSlotH: 100,
    tipSlot1X: 50, tipPlusX: 140, tipSlot2X: 225, tipEquaX: 315,
    tipTargetX: 395, tipTargetStep: 65,
    clockX: 550, clockY: 70, clockSize: 110,
    timeStartX: 668, timeY: 70, timeDigitW: 80, timeDigitH: 110, timeDigitGap: -20,
    livesStartX: 860, livesY: 95, heartSize: 60, heartGap: 10,
    settingsX: 1130, settingsY: 70, settingsSize: 100,
  };
}

/**
 * 竖屏布局（Header 居于画布顶部，left offset 30，bar 宽 1020）。
 * GAME_WIDTH=1080，pad=30 → bar width = 1020。
 */
function portraitLayout(): HeaderLayout {
  return {
    barW: 1020, barH: 250,
    tipY: 80, tipSlotW: 70, tipSlotH: 90,
    tipSlot1X: 20, tipPlusX: 100, tipSlot2X: 180, tipEquaX: 260,
    tipTargetX: 340, tipTargetStep: 75,
    clockX: 510, clockY: 85, clockSize: 70,
    timeStartX: 590, timeY: 95, timeDigitW: 44, timeDigitH: 60, timeDigitGap: 4,
    livesStartX: 748, livesY: 93, heartSize: 52, heartGap: 8,
    settingsX: 940, settingsY: 20, settingsSize: 52,
  };
}

// ── Header ────────────────────────────────────────────────────────────────────

export class Header extends PIXI.Container {
  // ── 时间显示 ──────────────────────────────────────────────────────
  private timeSprites: PIXI.Sprite[]  = [];
  private lastDisplayedSeconds        = -1;

  // ── 提示公式 ──────────────────────────────────────────────────────
  /** 整个提示区容器，每次重建时销毁旧的、重建新的。 */
  private tipContainer!: PIXI.Container;
  /** 消除成功后短暂展示完整等式的计时器，-1 = 空闲。 */
  private resultElapsed = -1;
  private static readonly RESULT_DISPLAY_MS = 500;

  // ── 命数心形 ──────────────────────────────────────────────────────
  private livesSprites: PIXI.Sprite[] = [];

  // ── 闹钟 ──────────────────────────────────────────────────────────
  /** 闹钟整体容器（表盘 + 指针），弹跳 / 变色在此容器上操作。 */
  private clockContainer!: PIXI.Container;
  private clockFaceSprite!: PIXI.Sprite;
  private clockHandSprite!: PIXI.Sprite;

  /** 弹跳动画进度，-1 = 空闲。 */
  private bounceElapsed                  = -1;
  private static readonly BOUNCE_DURATION = 200; // ms

  private _target: number;

  /** 当前布局配置（由构造时的方向决定，全生命周期不变）。 */
  private readonly layout: HeaderLayout;

  constructor(
    private readonly ctx: AppContext,
    private readonly screen: ScreenConfig,
    initialTarget: number,
    onSettings: () => void,
  ) {
    super();
    this._target = initialTarget;
    this.layout  = screen.orientation === Orientation.Landscape
      ? landscapeLayout()
      : portraitLayout();

    this.buildBackground();
    this.buildTip();
    this.buildTime();
    this.buildLives();
    this.buildSettingsButton(onSettings);
  }

  // ── Public API ────────────────────────────────────────────────────

  /** 目标数变化时调用：销毁旧提示容器，重建新的（显示空槽）。 */
  public updateTarget(target: number): void {
    this._target = target;
    this.resultElapsed = -1;
    this.rebuildTip(null, null);
  }

  /** 玩家选中第一个数字后调用，将其填入左槽。 */
  public setFirstSelected(value: number): void {
    this.resultElapsed = -1;
    this.rebuildTip(value, null);
  }

  /** 取消选中 / 进入新 Target 时重置为双空槽。 */
  public resetTip(): void {
    this.resultElapsed = -1;
    this.rebuildTip(null, null);
  }

  /**
   * 消除成功后调用：短暂展示完整等式（a + b = Target），
   * 约 500 ms 后自动重置为空槽。
   */
  public showMatchResult(a: number, b: number): void {
    this.rebuildTip(a, b);
    this.resultElapsed = 0;
  }

  /** 每帧由 GameScene 调用，驱动弹跳动画 + 消除结果计时器。 */
  public update(deltaMs: number): void {
    this.updateBounce(deltaMs);
    this.updateResultReset(deltaMs);
  }

  /** 更新时间显示 + 闹钟指针 + 预警变色。秒数未变时为空操作。 */
  public updateTime(seconds: number): void {
    if (seconds === this.lastDisplayedSeconds) return;
    this.lastDisplayedSeconds = seconds;

    // 数字显示（左对齐，紧靠闹钟右侧，不补零）
    const s = Math.max(0, seconds).toString();
    for (const d of this.timeSprites) d.visible = false;
    for (let i = 0; i < s.length && i < this.timeSprites.length; i++) {
      const sprite   = this.timeSprites[i];
      sprite.texture = this.ctx.assets.GetTexture(`${s[i]}.png`);
      sprite.visible = true;
    }

    // 指针旋转：ratio=1 → 12点（满时间），随时间减少顺时针旋转
    const ratio = Math.min(Math.max(seconds, 0) / CLOCK_REF_SECS, 1);
    this.clockHandSprite.rotation = Math.PI + (1 - ratio) * Math.PI * 2;

    // 时间预警变色
    const warnColor = (seconds > 0 && seconds < WARN_THRESHOLD) ? 0xFF5252 : 0xFFFFFF;
    this.clockFaceSprite.tint  = warnColor;
    this.clockHandSprite.tint  = warnColor;
  }

  /** 更新命数显示：满心 / 空心贴图切换。 */
  public updateLives(lives: number): void {
    for (let i = 0; i < this.livesSprites.length; i++) {
      this.livesSprites[i].texture = i < lives
        ? this.ctx.assets.GetTexture('heart.png')
        : this.ctx.assets.GetTexture('heart_empty.png');
    }
  }

  /** 加时到达时触发弹跳动画。 */
  public triggerClockBounce(): void {
    this.bounceElapsed = 0;
  }

  /**
   * 返回闹钟圆心在 Header 父容器（GameScene 本地坐标）中的位置，
   * 供飞行加时动画定位终点。
   */
  public getClockCenter(): { x: number; y: number } {
    const r = this.layout.clockSize / 2;
    return {
      x: this.x + this.layout.clockX + r,
      y: this.y + this.layout.clockY + r,
    };
  }

  // ── 私有构建方法 ──────────────────────────────────────────────────

  private buildBackground(): void {
    const bg = new PIXI.Graphics();
    const L  = this.layout;

    if (this.screen.orientation === Orientation.Landscape) {
      this.x = 350;
      this.y = 10;
    } else {
      this.x = 30;
      this.y = 10;
    }
    drawHeaderBar(bg, L.barW, L.barH);
    this.addChild(bg);
  }

  /**
   * 提示区：□ + □ = Target，玩家选中数字后逐步填入空槽。
   * @param first  左槽数值，null = 显示空槽
   * @param second 右槽数值，null = 显示空槽
   */
  private rebuildTip(first: number | null, second: number | null): void {
    if (this.tipContainer) {
      this.removeChild(this.tipContainer);
      this.tipContainer.destroy({ children: true });
    }
    this.tipContainer = new PIXI.Container();
    const L = this.layout;

    // 左槽
    this.addSlotOrValue(this.tipContainer, first,  L.tipSlot1X, L.tipY, L.tipSlotW, L.tipSlotH);

    // 加号
    const plus   = new PIXI.Sprite(this.ctx.assets.GetTexture('plus.png'));
    plus.width   = L.tipSlotW; plus.height = L.tipSlotH;
    plus.x       = L.tipPlusX; plus.y      = L.tipY;
    this.tipContainer.addChild(plus);

    // 右槽
    this.addSlotOrValue(this.tipContainer, second, L.tipSlot2X, L.tipY, L.tipSlotW, L.tipSlotH);

    // 等号
    const equa   = new PIXI.Sprite(this.ctx.assets.GetTexture('equa.png'));
    equa.width   = L.tipSlotW; equa.height = L.tipSlotH;
    equa.x       = L.tipEquaX; equa.y      = L.tipY;
    this.tipContainer.addChild(equa);

    // 目标数字（可能为 1–2 位）
    this._target.toString().split('').forEach((ch, i) => {
      const s   = new PIXI.Sprite(this.ctx.assets.GetTexture(`${ch}.png`));
      s.width   = L.tipSlotW; s.height = L.tipSlotH;
      s.x       = L.tipTargetX + i * L.tipTargetStep;
      s.y       = L.tipY;
      this.tipContainer.addChild(s);
    });

    this.addChild(this.tipContainer);
  }

  /**
   * 在容器内的 (x, y) 位置绘制空槽或数字精灵。
   * - value === null → 绘制圆角矩形空槽（灰色边框 + "?" 文字）
   * - value !== null → 绘制对应数字精灵（两位数时并排缩放至槽宽）
   */
  private addSlotOrValue(
    container: PIXI.Container,
    value: number | null,
    x: number, y: number, w: number, h: number,
  ): void {
    if (value === null) {
      const g = new PIXI.Graphics();
      g.lineStyle(3, 0xBBBBBB, 1);
      g.beginFill(0xF0F0F0, 1);
      g.drawRoundedRect(x, y, w, h, 10);
      g.endFill();
      // 问号：程序绘制，替代原 PIXI.Text('?')
      drawQuestionMark(g, x + w / 2, y + h / 2, h);
      container.addChild(g);
    } else {
      const digits = value.toString().split('');
      if (digits.length === 1) {
        const s   = new PIXI.Sprite(this.ctx.assets.GetTexture(`${digits[0]}.png`));
        s.width   = w; s.height = h;
        s.x       = x; s.y      = y;
        container.addChild(s);
      } else {
        // 两位数：各占约 48% 宽度，中间留少量间距
        const dw = Math.floor((w - 4) / 2);
        digits.forEach((ch, i) => {
          const s   = new PIXI.Sprite(this.ctx.assets.GetTexture(`${ch}.png`));
          s.width   = dw; s.height = h;
          s.x       = x + i * (dw + 4); s.y = y;
          container.addChild(s);
        });
      }
    }
  }

  /** 在构造时首次建立提示（双空槽）。 */
  private buildTip(): void {
    this.rebuildTip(null, null);
  }

  private buildTime(): void {
    const L = this.layout;

    this.clockContainer   = new PIXI.Container();
    this.clockContainer.x = L.clockX;
    this.clockContainer.y = L.clockY;

    // 表盘
    this.clockFaceSprite         = new PIXI.Sprite(this.ctx.assets.GetTexture('clock_face.png'));
    this.clockFaceSprite.width   = L.clockSize;
    this.clockFaceSprite.height  = L.clockSize;
    this.clockContainer.addChild(this.clockFaceSprite);

    // 指针：pivot 在顶部中心，放置于表盘圆心
    const r = L.clockSize / 2;
    this.clockHandSprite           = new PIXI.Sprite(this.ctx.assets.GetTexture('clock_hand.png'));
    this.clockHandSprite.width     = 6;
    this.clockHandSprite.height    = 33;
    this.clockHandSprite.pivot.set(3, 0);
    this.clockHandSprite.x        = r;
    this.clockHandSprite.y        = r;
    this.clockHandSprite.rotation = Math.PI; // 12 点位置
    this.clockContainer.addChild(this.clockHandSprite);

    this.addChild(this.clockContainer);

    // 时间数字（最多 3 位，左对齐紧跟闹钟右侧）
    for (let i = 0; i < 3; i++) {
      const s  = new PIXI.Sprite(this.ctx.assets.GetTexture('0.png'));
      s.width  = L.timeDigitW;
      s.height = L.timeDigitH;
      s.x      = L.timeStartX + i * (L.timeDigitW + L.timeDigitGap);
      s.y      = L.timeY;
      s.visible = false;
      this.addChild(s);
      this.timeSprites.push(s);
    }
  }

  private buildLives(): void {
    const L = this.layout;
    for (let i = 0; i < 3; i++) {
      const s  = new PIXI.Sprite(this.ctx.assets.GetTexture('heart.png'));
      s.width  = L.heartSize;
      s.height = L.heartSize;
      s.x      = L.livesStartX + i * (L.heartSize + L.heartGap);
      s.y      = L.livesY;
      this.addChild(s);
      this.livesSprites.push(s);
    }
  }

  private buildSettingsButton(onSettings: () => void): void {
    const L = this.layout;
    const s  = new PIXI.Sprite(this.ctx.assets.GetTexture('settings.png'));
    s.width  = L.settingsSize;
    s.height = L.settingsSize;
    s.x      = L.settingsX;
    s.y      = L.settingsY;
    this.addChild(s);
    this.ctx.input.registerUI(new UIElement({ zIndex: 15, sprite: s, onTap: onSettings }));
  }

  // ── 消除结果计时器 ────────────────────────────────────────────────

  private updateResultReset(deltaMs: number): void {
    if (this.resultElapsed < 0) return;
    this.resultElapsed += deltaMs;
    if (this.resultElapsed >= Header.RESULT_DISPLAY_MS) {
      this.resultElapsed = -1;
      this.rebuildTip(null, null);
    }
  }

  // ── 弹跳动画 ─────────────────────────────────────────────────────

  private updateBounce(deltaMs: number): void {
    if (this.bounceElapsed < 0) return;

    this.bounceElapsed += deltaMs;
    const t = this.bounceElapsed / Header.BOUNCE_DURATION;

    if (t >= 1) {
      this.clockContainer.scale.set(1);
      this.bounceElapsed = -1;
      return;
    }

    // 正弦弹跳：0 → 1 → 0，峰值缩放 1.25
    const scale = 1 + 0.25 * Math.sin(t * Math.PI);
    this.clockContainer.scale.set(scale);
  }
}
