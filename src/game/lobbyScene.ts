import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { ScreenConfig } from './screenConfig';
import { STAGES, StageData } from './stageConfig';
import { StageManager } from './stageManager';
import { StarManager } from './starManager';
import { UIElement } from '../inputSystem/uiElement';
import { GAME_WIDTH, GAME_HEIGHT } from './consts';
import { drawCircleCell, drawCircleCellSelected, makeTexture } from './graphicsFactory';
import { getDailyBestScore, getStreakDays } from './dailyChallengeStore';
import { LOBBY_NODE_POSITIONS, DAILY_CHALLENGE_POS } from './lobbyLayout';
import { Orientation } from './enums';

// Per-node runtime data for repositioning on resize
interface NodeEntry {
  portraitCX: number;
  portraitCY: number;
  card: PIXI.Sprite;
  numberText: PIXI.Text;
  starLabel: PIXI.Text;
}

// Daily challenge element refs for repositioning on resize
interface DailyChallengeEntry {
  portraitX: number;
  portraitY: number;
  circle: PIXI.Graphics;
  icon: PIXI.Sprite;
  title: PIXI.Text;
  bestText: PIXI.Text;
  streakText: PIXI.Text;
  hit: PIXI.Sprite;
}

export class LobbyScene extends PIXI.Container {
  private readonly screen: ScreenConfig;

  private static readonly NODE_SIZE = 100;
  private static readonly DAILY_SIZE = 130;

  // Background sprite - resized in resize()
  private bg!: PIXI.Sprite;

  // Node data for dynamic repositioning
  private nodeEntries: NodeEntry[] = [];
  private dailyEntry!: DailyChallengeEntry;

  // Parallel arrays for refresh()
  private stageCards: PIXI.Sprite[] = [];
  private starLabels: PIXI.Text[] = [];

  // Node textures
  private cardTexture!: PIXI.Texture;
  private cardSelectedTexture!: PIXI.Texture;

  // Kept for refresh() - also stored in dailyEntry
  private dcBestText!: PIXI.Text;
  private dcStreakText!: PIXI.Text;

  constructor(
    private readonly ctx: AppContext,
    private readonly onSelectStage: (stage: StageData) => void,
    private readonly onDailyChallenge: () => void,
  ) {
    super();
    this.screen = new ScreenConfig();
    this.screen.update(GAME_WIDTH, GAME_HEIGHT);
    this.buildUI();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  public resize(windowWidth: number, windowHeight: number): void {
    this.screen.update(windowWidth, windowHeight);
    this.x = 0;
    this.y = 0;
    this.scale.set(this.screen.scale);
    this.updateBgSize();
    this.repositionAll();
  }

  public refresh(): void {
    const maxCompleted = StageManager.getMaxCompleted();

    STAGES.forEach((stage, i) => {
      const card      = this.stageCards[i];
      const starLabel = this.starLabels[i];
      if (!card) return;

      const completed = stage.stageIndex <= maxCompleted;
      const isCurrent = stage.stageIndex === maxCompleted + 1;

      if (isCurrent) {
        card.texture = this.cardSelectedTexture;
        card.tint    = 0xFFFFFF;
        card.alpha   = 1;
      } else if (completed) {
        card.texture = this.cardTexture;
        card.tint    = 0xFFFFFF;
        card.alpha   = 1;
      } else {
        card.texture = this.cardTexture;
        card.tint    = 0x888888;
        card.alpha   = 0.5;
      }

      if (completed || isCurrent) {
        const stars = StarManager.getStars(stage.stageIndex);
        if (stars > 0) {
          starLabel.text    = '★'.repeat(stars) + '☆'.repeat(3 - stars);
          starLabel.visible = true;
        } else {
          starLabel.visible = false;
        }
      } else {
        starLabel.visible = false;
      }
    });

    if (this.dcBestText) {
      const best = getDailyBestScore();
      this.dcBestText.text   = best > 0 ? (`最佳 ${best}`) : "最佳 --";
      this.dcStreakText.text  = `${getStreakDays()}天`;
    }
  }

  // -------------------------------------------------------------------------
  // Build helpers
  // -------------------------------------------------------------------------

  private buildUI(): void {
    this.buildBackground();
    this.buildAdventureMap();
    this.buildDailyChallenge();
  }

  private buildBackground(): void {
    this.bg = new PIXI.Sprite(this.ctx.assets.GetTexture('lobby_bg.png'));
    this.bg.x      = 0;
    this.bg.y      = 0;
    this.bg.width  = GAME_WIDTH;
    this.bg.height = GAME_HEIGHT;
    this.addChild(this.bg);
  }

  private buildAdventureMap(): void {
    const sz = LobbyScene.NODE_SIZE;
    const r  = sz / 2;

    this.cardTexture = makeTexture(
      this.ctx.renderer,
      g => drawCircleCell(g, sz),
      sz,
    );
    this.cardSelectedTexture = makeTexture(
      this.ctx.renderer,
      g => drawCircleCellSelected(g, sz),
      sz,
    );

    STAGES.forEach((stage, i) => {
      const pos = LOBBY_NODE_POSITIONS[i];
      if (!pos) return;

      const cx = pos.x;
      const cy = pos.y;

      const card = this.buildStageButton(stage, cx - r, cy - r, sz);
      this.stageCards.push(card);

      const numberText = this.buildStageNumber(stage.stageIndex, cx, cy, sz);

      const starLabel = new PIXI.Text('', {
        fontFamily: 'Arial',
        fontSize:   20,
        fill:       0xEAB830,
      });
      starLabel.anchor.set(0.5, 0);
      starLabel.x = cx;
      starLabel.y = cy + r + 4;
      starLabel.visible = false;
      this.addChild(starLabel);
      this.starLabels.push(starLabel);

      this.nodeEntries.push({ portraitCX: cx, portraitCY: cy, card, numberText, starLabel });
    });

    this.refresh();
  }

  private buildDailyChallenge(): void {
    const { x, y } = DAILY_CHALLENGE_POS;
    const sz = LobbyScene.DAILY_SIZE;
    const r  = sz / 2;

    const circle = new PIXI.Graphics();
    circle.lineStyle(4, 0x6D4C41, 1);
    circle.beginFill(0xC8862A);
    circle.drawCircle(0, 0, r);
    circle.endFill();
    circle.x = x;
    circle.y = y;
    this.addChild(circle);

    const icon = new PIXI.Sprite(this.ctx.assets.GetTexture('daily_challenge_icon.png'));
    const targetPx = sz * 0.7;
    const iconScale = targetPx / Math.max(icon.texture.width, icon.texture.height);
    icon.width  = icon.texture.width  * iconScale;
    icon.height = icon.texture.height * iconScale;
    icon.anchor.set(0.5, 0.5);
    icon.x = x;
    icon.y = y;
    this.addChild(icon);

    const title = new PIXI.Text('每日挑战', {
      fontFamily: 'Arial',
      fontSize:   22,
      fontWeight: 'bold',
      fill:       0x5D4037,
      stroke:     0xFFFFFF,
      strokeThickness: 2,
    });
    title.anchor.set(0.5, 0);
    title.x = x;
    title.y = y + r + 8;
    this.addChild(title);

    const bestText = new PIXI.Text("最佳 --", {
      fontFamily: 'Arial', fontSize: 18, fill: 0x5D4037,
    });
    bestText.anchor.set(0.5, 0);
    bestText.x = x;
    bestText.y = y + r + 36;
    this.addChild(bestText);

    const streakText = new PIXI.Text("0天", {
      fontFamily: 'Arial', fontSize: 18, fill: 0x5D4037,
    });
    streakText.anchor.set(0.5, 0);
    streakText.x = x;
    streakText.y = y + r + 60;
    this.addChild(streakText);

    const hit = new PIXI.Sprite(PIXI.Texture.EMPTY);
    hit.width  = sz;
    hit.height = sz;
    hit.x = x - r;
    hit.y = y - r;
    this.addChild(hit);
    this.ctx.input.registerUI(
      new UIElement({ zIndex: 5, sprite: hit, onTap: () => this.onDailyChallenge() }),
    );

    this.dcBestText   = bestText;
    this.dcStreakText  = streakText;

    this.dailyEntry = { portraitX: x, portraitY: y, circle, icon, title, bestText, streakText, hit };
  }

  // -------------------------------------------------------------------------
  // Resize helpers
  // -------------------------------------------------------------------------

  // Landscape: bg fills the full logical screen width (square image, so height==width).
  // The bottom overflow is clipped naturally by the canvas bounds.
  // Portrait: bg stretches to GAME_WIDTH x GAME_HEIGHT.
  private updateBgSize(): void {
    if (!this.bg) return;
    if (this.screen.orientation === Orientation.Landscape) {
      this.bg.width  = this.screen.width;
      this.bg.height = this.screen.width;
    } else {
      this.bg.width  = GAME_WIDTH;
      this.bg.height = GAME_HEIGHT;
    }
  }

  // Map a portrait logical coordinate to the current orientation's logical space.
  // Portrait: returned unchanged.
  // Landscape logical dimensions: width = screen.width, height = GAME_WIDTH.
  //   x_new = portraitX / GAME_WIDTH  * screen.width
  //   y_new = portraitY / GAME_HEIGHT * GAME_WIDTH
  // This guarantees all nodes stay within [0, screen.width] x [0, GAME_WIDTH].
  private toLogicalPos(portraitX: number, portraitY: number): { x: number; y: number } {
    if (this.screen.orientation !== Orientation.Landscape) {
      return { x: portraitX, y: portraitY };
    }
    return {
      x: (portraitX / GAME_WIDTH)  * this.screen.width,
      y: (portraitY / GAME_HEIGHT) * GAME_WIDTH,
    };
  }

  // Reposition every node and daily-challenge element to match the current orientation.
  private repositionAll(): void {
    const sz = LobbyScene.NODE_SIZE;
    const r  = sz / 2;

    for (const entry of this.nodeEntries) {
      const pos = this.toLogicalPos(entry.portraitCX, entry.portraitCY);
      entry.card.x        = pos.x - r;
      entry.card.y        = pos.y - r;
      entry.numberText.x  = pos.x;
      entry.numberText.y  = pos.y;
      entry.starLabel.x   = pos.x;
      entry.starLabel.y   = pos.y + r + 4;
    }

    if (this.dailyEntry) {
      const pos = this.toLogicalPos(this.dailyEntry.portraitX, this.dailyEntry.portraitY);
      const dr  = LobbyScene.DAILY_SIZE / 2;
      this.dailyEntry.circle.x     = pos.x;
      this.dailyEntry.circle.y     = pos.y;
      this.dailyEntry.icon.x       = pos.x;
      this.dailyEntry.icon.y       = pos.y;
      this.dailyEntry.title.x      = pos.x;
      this.dailyEntry.title.y      = pos.y + dr + 8;
      this.dailyEntry.bestText.x   = pos.x;
      this.dailyEntry.bestText.y   = pos.y + dr + 36;
      this.dailyEntry.streakText.x = pos.x;
      this.dailyEntry.streakText.y = pos.y + dr + 60;
      this.dailyEntry.hit.x        = pos.x - dr;
      this.dailyEntry.hit.y        = pos.y - dr;
    }
  }

  // -------------------------------------------------------------------------
  // Internal builders
  // -------------------------------------------------------------------------

  private buildStageButton(
    stage: StageData,
    x: number,
    y: number,
    size: number,
  ): PIXI.Sprite {
    const card  = new PIXI.Sprite(this.cardTexture);
    card.width  = size;
    card.height = size;
    card.x      = x;
    card.y      = y;
    this.addChild(card);

    this.ctx.input.registerUI(
      new UIElement({
        zIndex: 5,
        sprite: card,
        onTap: () => {
          if (StageManager.isUnlocked(stage.stageIndex)) {
            this.onSelectStage(stage);
          }
        },
      }),
    );

    return card;
  }

  // Renders the stage number as PIXI.Text centered on the node circle.
  // Using Text (rather than digit sprites) avoids the visual gap caused by
  // fixed-width sprite frames around narrow glyphs like "1".
  private buildStageNumber(n: number, centerX: number, centerY: number, cardSize: number): PIXI.Text {
    const text = new PIXI.Text(n.toString(), {
      fontFamily:      'Arial',
      fontSize:        Math.round(cardSize * 0.40),
      fontWeight:      'bold',
      fill:            0x5D4037,
      stroke:          0xFFFFFF,
      strokeThickness: 3,
      align:           'center',
    });
    text.anchor.set(0.5, 0.5);
    text.x = centerX;
    text.y = centerY;
    this.addChild(text);
    return text;
  }
}
