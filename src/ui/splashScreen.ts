import * as PIXI from 'pixi.js-legacy';
import { IAssetsManager } from '../assetsManager/IAssetsManager';

/**
 * SplashScreen
 *
 * A brief branded splash shown on every launch, after assets have loaded and
 * before the first scene appears. Displays the SumQuest logo on the game's
 * parchment background with a gentle fade-in / hold / fade-out, then cleans
 * itself up and resolves.
 *
 * Usage:
 *   await playSplash(app, assets);
 *
 * The splash is purely cosmetic: if the logo texture is unavailable (e.g. a
 * platform whose asset load skipped it), it resolves immediately without
 * blocking startup.
 */

/** Texture key registered by the asset managers. */
const SPLASH_TEXTURE_KEY = 'splash.png';
/** Parchment background — matches LoadingOverlay and the game art style. */
const BG_COLOR = 0xf5eac8;

// ── Timing (ms) ──────────────────────────────────────────────────────────────
const FADE_IN_MS = 350;
const HOLD_MS = 900;
const FADE_OUT_MS = 350;

/** Fraction of the screen the splash art may occupy on each axis (contain fit). */
const SPLASH_SCREEN_FRACTION = 0.9;

type Phase = 'fade_in' | 'hold' | 'fade_out';

/** Smoothstep easing for a soft, non-linear fade. */
function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

export function playSplash(app: PIXI.Application, assets: IAssetsManager): Promise<void> {
  let texture: PIXI.Texture;
  try {
    texture = assets.GetTexture(SPLASH_TEXTURE_KEY);
  } catch {
    // Splash is optional — never block startup on a missing texture.
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const container = new PIXI.Container();
    container.interactiveChildren = false;

    // ── Opaque parchment backdrop covering the whole screen ──────────────────
    const bg = new PIXI.Graphics();
    container.addChild(bg);

    // ── Logo sprite (anchored at its centre for clean scaling) ───────────────
    const logo = new PIXI.Sprite(texture);
    logo.anchor.set(0.5);
    container.addChild(logo);

    // Base scale that fits the logo to the screen; the entrance "pop" multiplies it.
    let baseScale = 1;

    const layout = (): void => {
      const w = app.renderer.width / app.renderer.resolution;
      const h = app.renderer.height / app.renderer.resolution;

      bg.clear();
      bg.beginFill(BG_COLOR, 1);
      bg.drawRect(0, 0, w, h);
      bg.endFill();

      // Contain the portrait splash art within the screen, preserving aspect.
      baseScale = Math.min(
        (w * SPLASH_SCREEN_FRACTION) / texture.width,
        (h * SPLASH_SCREEN_FRACTION) / texture.height
      );
      logo.position.set(w / 2, h / 2);
    };

    layout();
    // `window` is absent in some runtimes (e.g. WeChat mini-games); guard it.
    const hasWindow =
      typeof window !== 'undefined' && typeof window.addEventListener === 'function';
    if (hasWindow) window.addEventListener('resize', layout);

    // Set the starting frame explicitly to avoid a one-frame flash at full size.
    container.alpha = 0;
    logo.scale.set(baseScale * 0.94);

    app.stage.addChild(container);

    let phase: Phase = 'fade_in';
    let elapsed = 0;

    const tick = (): void => {
      elapsed += app.ticker.elapsedMS;

      if (phase === 'fade_in') {
        const t = elapsed / FADE_IN_MS;
        const e = smoothstep(t);
        container.alpha = e;
        // Subtle pop: scale logo from 0.94× → 1.0× of its fitted size.
        logo.scale.set(baseScale * (0.94 + 0.06 * e));
        if (t >= 1) {
          container.alpha = 1;
          logo.scale.set(baseScale);
          phase = 'hold';
          elapsed = 0;
        }
      } else if (phase === 'hold') {
        if (elapsed >= HOLD_MS) {
          phase = 'fade_out';
          elapsed = 0;
        }
      } else {
        const t = elapsed / FADE_OUT_MS;
        container.alpha = 1 - smoothstep(t);
        if (t >= 1) {
          finish();
        }
      }
    };

    const finish = (): void => {
      app.ticker.remove(tick);
      if (hasWindow) window.removeEventListener('resize', layout);
      app.stage.removeChild(container);
      container.destroy({ children: true });
      resolve();
    };

    app.ticker.add(tick);
  });
}
