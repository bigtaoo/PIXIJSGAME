import * as PIXI from 'pixi.js-legacy';
import digitsPngUrl  from '../assets/digits.png';
import heartPngUrl   from '../assets/heart.png';
import heartEmptyUrl from '../assets/heart_empty.png';
import explosionJsonUrl from '../assets/explosion.json';
import explosionPngUrl  from '../assets/explosion.png';
import bgPngUrl      from '../assets/lobby_bg.png';
import dailyPngUrl   from '../assets/daily_challenge_icon.png';
import starPngUrl    from '../assets/star.png';
import trophyPngUrl  from '../assets/trophy.png';
import firePngUrl    from '../assets/fire.png';
import musicPngUrl   from '../assets/music.png';
import { IAssetsManager } from './IAssetsManager';
import {
  makeTexture,
  CELL_PALETTE,
  GlossEllipse,
  drawCell, drawCellSelected,
  drawClockFace, drawClockHand,
  drawPlus, drawEquals,
  drawRetryIcon, drawNextIcon, drawSettingsIcon, drawLobbyIcon,
  drawLetterS,
} from '../game/graphicsFactory';

/** Number of random gloss variants generated per palette colour. */
const GLOSS_PER_COLOR = 6; // 4 colours × 6 = 24 cell textures total

/**
 * Generate a random gloss config for a cell texture.
 * Returns 1 large / 2 medium / 3 small ellipses with randomised positions.
 */
function makeGlossEllipses(): GlossEllipse[] {
  const r   = Math.random;
  const typ = Math.floor(r() * 3); // 0 = large, 1 = two medium, 2 = three small

  if (typ === 0) {
    // 1 large ellipse — random position in upper portion
    return [{
      cx: 0.18 + r() * 0.44,
      cy: 0.13 + r() * 0.10,
      rx: 0.18 + r() * 0.09,
      ry: 0.09 + r() * 0.05,
    }];
  } else if (typ === 1) {
    // 2 medium ellipses — left half and right half
    return [
      { cx: 0.13 + r() * 0.22, cy: 0.13 + r() * 0.10, rx: 0.11 + r() * 0.05, ry: 0.06 + r() * 0.03 },
      { cx: 0.52 + r() * 0.22, cy: 0.13 + r() * 0.10, rx: 0.10 + r() * 0.05, ry: 0.06 + r() * 0.03 },
    ];
  } else {
    // 3 small ellipses — spread across left / centre / right
    return [
      { cx: 0.12 + r() * 0.14, cy: 0.12 + r() * 0.12, rx: 0.07 + r() * 0.04, ry: 0.04 + r() * 0.02 },
      { cx: 0.36 + r() * 0.12, cy: 0.15 + r() * 0.10, rx: 0.07 + r() * 0.04, ry: 0.04 + r() * 0.02 },
      { cx: 0.60 + r() * 0.14, cy: 0.12 + r() * 0.12, rx: 0.07 + r() * 0.04, ry: 0.04 + r() * 0.02 },
    ];
  }
}

const DIGIT_W   = 120;
const DIGIT_H   = 160;
const DIGIT_GAP = 10;

const CELL_BASE      = 120;
const CLOCK_RADIUS   = 40;
const CLOCK_HAND_LEN = 26;
const CLOCK_HAND_W   = 6;
const SYMBOL_W       = 80;
const SYMBOL_H_PLUS  = 80;
const SYMBOL_H_EQ    = 60;
const BTN_SIZE       = 200;
const SETTINGS_SIZE  = 80;

export class WebAssetsManager implements IAssetsManager {
  private textures: Record<string, PIXI.Texture> = {};

  public async loadAssets(
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    const tasks: Array<[string, () => Promise<void>]> = [
      ['digits',     () => this.loadDigits()],
      ['hearts',     () => this.loadHearts()],
      ['explosion',  () => this.loadExplosionAtlas()],
      ['lobby_bg',   () => this.loadBg()],
      ['daily_icon', () => this.loadDailyIcon()],
      ['star',       () => this.loadStar()],
      ['trophy',     () => this.loadTrophy()],
      ['fire',       () => this.loadFire()],
      ['music',      () => this.loadMusic()],
    ];

    const total = tasks.length;
    let loaded = 0;

    await Promise.all(
      tasks.map(async ([name, fn]) => {
        try {
          await fn();
          loaded++;
          onProgress?.(loaded, total);
        } catch (err) {
          throw new Error(`[asset:${name}] ${String(err)}`);
        }
      }),
    );
  }

  private async loadBg(): Promise<void> {
    const base = await this.waitForBase(PIXI.BaseTexture.from(bgPngUrl));
    this.textures['lobby_bg.png'] = new PIXI.Texture(base);
  }
  private async loadDailyIcon(): Promise<void> {
    const base = await this.waitForBase(PIXI.BaseTexture.from(dailyPngUrl));
    this.textures['daily_challenge_icon.png'] = new PIXI.Texture(base);
  }

  private async loadStar(): Promise<void> {
    const base = await this.waitForBase(PIXI.BaseTexture.from(starPngUrl));
    this.textures['star.png'] = new PIXI.Texture(base);
  }
  private async loadTrophy(): Promise<void> {
    const base = await this.waitForBase(PIXI.BaseTexture.from(trophyPngUrl));
    this.textures['trophy.png'] = new PIXI.Texture(base);
  }
  private async loadFire(): Promise<void> {
    const base = await this.waitForBase(PIXI.BaseTexture.from(firePngUrl));
    this.textures['fire.png'] = new PIXI.Texture(base);
  }
  private async loadMusic(): Promise<void> {
    const base = await this.waitForBase(PIXI.BaseTexture.from(musicPngUrl));
    this.textures['music.png'] = new PIXI.Texture(base);
  }

  private async loadDigits(): Promise<void> {
    const base = await this.waitForBase(PIXI.BaseTexture.from(digitsPngUrl));
    for (let i = 0; i <= 9; i++) {
      this.textures[`${i}.png`] = new PIXI.Texture(
        base,
        new PIXI.Rectangle(i * (DIGIT_W + DIGIT_GAP), 0, DIGIT_W, DIGIT_H),
      );
    }
  }

  private async loadHearts(): Promise<void> {
    const [hb, heb] = await Promise.all([
      this.waitForBase(PIXI.BaseTexture.from(heartPngUrl)),
      this.waitForBase(PIXI.BaseTexture.from(heartEmptyUrl)),
    ]);
    this.textures['heart.png']       = new PIXI.Texture(hb);
    this.textures['heart_empty.png'] = new PIXI.Texture(heb);
  }

  private async loadExplosionAtlas(): Promise<void> {
    const res   = await fetch(explosionJsonUrl);
    const atlas = await res.json();
    const base  = await this.waitForBase(PIXI.BaseTexture.from(explosionPngUrl));
    this.parseAtlas(atlas, base);
  }

  private waitForBase(bt: PIXI.BaseTexture): Promise<PIXI.BaseTexture> {
    return new Promise((resolve, reject) => {
      if (bt.valid) { resolve(bt); return; }
      bt.once('loaded', () => resolve(bt));
      bt.once('error',  (_bt: PIXI.BaseTexture, err: Error) => reject(err));
    });
  }

  private parseAtlas(atlas: any, base: PIXI.BaseTexture): void {
    for (const key in atlas.frames) {
      const f = atlas.frames[key].frame;
      this.textures[key] = new PIXI.Texture(base, new PIXI.Rectangle(f.x, f.y, f.w, f.h));
    }
  }

  public generateProgrammaticTextures(renderer: PIXI.Renderer): void {
    // Generate 3 tier colours × 6 random gloss variants = 18 cell textures.
    // Key format: cell_t{tier}_g{gloss}.png
    CELL_PALETTE.forEach((color, tier) => {
      for (let gi = 0; gi < GLOSS_PER_COLOR; gi++) {
        const key = `cell_t${tier}_g${gi}.png`;
        const gloss = makeGlossEllipses();
        this.textures[key] = makeTexture(
          renderer, g => drawCell(g, CELL_BASE, color, gloss), CELL_BASE,
        );
      }
    });
    // 'cell.png' kept for any legacy references (defaults to tier 0, gloss 0)
    this.textures['cell.png'] = this.textures['cell_t0_g0.png'];

    this.textures['cell_selected.png'] = makeTexture(
      renderer, g => drawCellSelected(g, CELL_BASE), CELL_BASE,
    );
    this.textures['clock_face.png'] = makeTexture(
      renderer, g => drawClockFace(g, CLOCK_RADIUS), CLOCK_RADIUS * 2,
    );
    this.textures['clock_hand.png'] = makeTexture(
      renderer,
      g => drawClockHand(g, CLOCK_HAND_LEN, CLOCK_HAND_W),
      CLOCK_HAND_W, CLOCK_HAND_LEN,
    );
    this.textures['plus.png'] = makeTexture(
      renderer, g => drawPlus(g, SYMBOL_W, SYMBOL_H_PLUS), SYMBOL_W, SYMBOL_H_PLUS,
    );
    this.textures['equa.png'] = makeTexture(
      renderer, g => drawEquals(g, SYMBOL_W, SYMBOL_H_EQ), SYMBOL_W, SYMBOL_H_EQ,
    );
    this.textures['retry.png']    = makeTexture(renderer, g => drawRetryIcon(g,    BTN_SIZE),     BTN_SIZE);
    this.textures['next.png']     = makeTexture(renderer, g => drawNextIcon(g,      BTN_SIZE),     BTN_SIZE);
    this.textures['lobby.png']    = makeTexture(renderer, g => drawLobbyIcon(g,     BTN_SIZE),     BTN_SIZE);
    this.textures['settings.png'] = makeTexture(renderer, g => drawSettingsIcon(g, SETTINGS_SIZE), SETTINGS_SIZE);

    // Letter "s" (for the flying bonus animation), white outline; callers tint it
    const S_W = 50, S_H = 70;
    this.textures['s.png'] = makeTexture(renderer, g => drawLetterS(g, S_W, S_H), S_W, S_H);
  }

  public GetTexture(key: string): PIXI.Texture {
    const tex = this.textures[key];
    if (!tex) throw new Error(`Missing texture: "${key}"`);
    return tex;
  }

  public GetSpriteFromNumberAtlas(key: string): PIXI.Sprite {
    return new PIXI.Sprite(this.GetTexture(key));
  }
}
