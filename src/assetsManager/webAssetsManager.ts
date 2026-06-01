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
  drawCell, drawCellSelected,
  drawClockFace, drawClockHand,
  drawPlus, drawEquals,
  drawRetryIcon, drawNextIcon, drawSettingsIcon, drawLobbyIcon,
  drawLetterS,
} from '../game/graphicsFactory';

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

  public async loadAssets(): Promise<void> {
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

    await Promise.all(
      tasks.map(async ([name, fn]) => {
        try {
          await fn();
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
    this.textures['cell.png'] = makeTexture(
      renderer, g => drawCell(g, CELL_BASE), CELL_BASE,
    );
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
