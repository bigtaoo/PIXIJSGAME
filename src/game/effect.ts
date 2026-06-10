import * as PIXI from 'pixi.js-legacy';
import { IAssetsManager } from '../assetsManager/IAssetsManager';

// ── Particle ───────────────────────────────────────────────────────────────

interface Particle {
  sprite: PIXI.Sprite;
  vx: number;
  vy: number;
  vr: number;
  life: number;
  maxLife: number;
  drag: number;
  gravity: number;
  active: boolean;
}

interface SpawnOpts {
  speedMin: number;
  speedMax: number;
  rotMin: number;
  rotMax: number;
  scale: number;
  scaleVar: number;
  lifeMin: number;
  lifeMax: number;
  drag: number;
  gravity: number;
}

// ── ExplosionSystem ────────────────────────────────────────────────────────

/**
 * Particle-based explosion system for number-elimination cells.
 *
 * All sprites are pooled and reused; no allocation happens after warm-up.
 * Call play() each time a cell is eliminated, and update() every frame.
 */
export class ExplosionSystem {
  private readonly particles: Particle[] = [];

  private readonly largeTextures: PIXI.Texture[] = [];
  private readonly mediumTextures: PIXI.Texture[] = [];
  private readonly smallTextures: PIXI.Texture[] = [];
  private readonly dustTextures: PIXI.Texture[] = [];
  private dustCloudTexture!: PIXI.Texture;

  /** False if explosion textures failed to load (e.g. on WeChat). */
  private ready = false;

  constructor(
    private readonly container: PIXI.Container,
    assets: IAssetsManager
  ) {
    try {
      for (let i = 0; i < 3; i++) this.largeTextures.push(assets.GetTexture(`large_${i}`));
      for (let i = 0; i < 3; i++) this.mediumTextures.push(assets.GetTexture(`medium_${i}`));
      for (let i = 0; i < 7; i++) this.smallTextures.push(assets.GetTexture(`small_${i}`));
      for (let i = 0; i < 3; i++) this.dustTextures.push(assets.GetTexture(`dust_${i}`));
      this.dustCloudTexture = assets.GetTexture('dust_cloud');
      this.ready = true;
    } catch {
      // Textures not available (e.g. WeChat environment without atlas loaded)
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Trigger an explosion at the given screen-space centre.
   *
   * @param cx       Centre X (logical pixels, already offset to cell centre)
   * @param cy       Centre Y
   * @param isCombo  Whether this is a combo elimination (more / faster particles)
   * @param gridSize Cell size in logical pixels — used to scale fragments
   */
  public play(cx: number, cy: number, isCombo: boolean, gridSize: number): void {
    if (!this.ready) return;

    // Base visual scale: fragment should look ~27 % of a cell for "large" (2/3 of original)
    const bs = gridSize / 180;

    if (isCombo) {
      this.spawnGroup(this.largeTextures, cx, cy, 3, {
        speedMin: 10,
        speedMax: 16,
        rotMin: 0.05,
        rotMax: 0.12,
        scale: bs * 1.0,
        scaleVar: 0.2,
        lifeMin: 200,
        lifeMax: 300,
        drag: 0.92,
        gravity: 0.35,
      });
      this.spawnGroup(this.mediumTextures, cx, cy, 3, {
        speedMin: 8,
        speedMax: 14,
        rotMin: 0.04,
        rotMax: 0.1,
        scale: bs * 0.8,
        scaleVar: 0.2,
        lifeMin: 170,
        lifeMax: 260,
        drag: 0.91,
        gravity: 0.3,
      });
      this.spawnGroup(this.smallTextures, cx, cy, 8, {
        speedMin: 5,
        speedMax: 12,
        rotMin: 0.06,
        rotMax: 0.15,
        scale: bs * 0.5,
        scaleVar: 0.15,
        lifeMin: 120,
        lifeMax: 240,
        drag: 0.89,
        gravity: 0.25,
      });
      this.spawnGroup(this.dustTextures, cx, cy, 4, {
        speedMin: 2,
        speedMax: 7,
        rotMin: 0.01,
        rotMax: 0.04,
        scale: bs * 0.5,
        scaleVar: 0.1,
        lifeMin: 60,
        lifeMax: 200,
        drag: 0.87,
        gravity: 0.08,
      });
      this.spawnParticle(this.dustCloudTexture, cx, cy, {
        speedMin: 1,
        speedMax: 3,
        rotMin: 0.01,
        rotMax: 0.02,
        scale: bs * 1.3,
        scaleVar: 0.1,
        lifeMin: 120,
        lifeMax: 220,
        drag: 0.85,
        gravity: 0.0,
      });
    } else {
      this.spawnGroup(this.largeTextures, cx, cy, 2, {
        speedMin: 8,
        speedMax: 14,
        rotMin: 0.05,
        rotMax: 0.12,
        scale: bs * 1.0,
        scaleVar: 0.2,
        lifeMin: 160,
        lifeMax: 260,
        drag: 0.92,
        gravity: 0.3,
      });
      this.spawnGroup(this.mediumTextures, cx, cy, 2, {
        speedMin: 6,
        speedMax: 12,
        rotMin: 0.04,
        rotMax: 0.1,
        scale: bs * 0.8,
        scaleVar: 0.2,
        lifeMin: 140,
        lifeMax: 230,
        drag: 0.91,
        gravity: 0.25,
      });
      this.spawnGroup(this.smallTextures, cx, cy, 4, {
        speedMin: 4,
        speedMax: 10,
        rotMin: 0.06,
        rotMax: 0.15,
        scale: bs * 0.5,
        scaleVar: 0.15,
        lifeMin: 90,
        lifeMax: 190,
        drag: 0.9,
        gravity: 0.2,
      });
      this.spawnGroup(this.dustTextures, cx, cy, 2, {
        speedMin: 2,
        speedMax: 5,
        rotMin: 0.01,
        rotMax: 0.03,
        scale: bs * 0.5,
        scaleVar: 0.1,
        lifeMin: 30,
        lifeMax: 140,
        drag: 0.88,
        gravity: 0.05,
      });
    }
  }

  /**
   * Call every frame, passing elapsed milliseconds since last frame.
   */
  public update(deltaMs: number): void {
    // dt = number of 60 fps ticks elapsed; keeps physics frame-rate independent
    const dt = deltaMs / 16.667;

    for (const p of this.particles) {
      if (!p.active) continue;

      // Apply drag (frame-rate independent: drag^dt)
      const d = Math.pow(p.drag, dt);
      p.vx *= d;
      p.vy *= d;

      // Gravity
      p.vy += p.gravity * dt;

      // Move & rotate
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.rotation += p.vr * dt;

      // Lifetime & alpha (fade in second half)
      p.life -= deltaMs;
      const progress = p.life / p.maxLife;
      p.sprite.alpha = progress < 0.5 ? 1 : progress * 2;

      if (p.life <= 0) {
        p.active = false;
        p.sprite.visible = false;
      }
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private spawnGroup(
    textures: PIXI.Texture[],
    cx: number,
    cy: number,
    count: number,
    opts: SpawnOpts
  ): void {
    for (let i = 0; i < count; i++) {
      const tex = textures[Math.floor(Math.random() * textures.length)];
      this.spawnParticle(tex, cx, cy, opts);
    }
  }

  private spawnParticle(tex: PIXI.Texture, cx: number, cy: number, opts: SpawnOpts): void {
    // Reuse an inactive particle from the pool, or create a new one
    let p = this.particles.find((q) => !q.active);
    if (!p) {
      const sprite = new PIXI.Sprite();
      sprite.anchor.set(0.5, 0.5);
      this.container.addChild(sprite);
      p = { sprite, vx: 0, vy: 0, vr: 0, life: 0, maxLife: 0, drag: 0, gravity: 0, active: false };
      this.particles.push(p);
    }

    const angle = Math.random() * Math.PI * 2;
    const speed = opts.speedMin + Math.random() * (opts.speedMax - opts.speedMin);
    const life = opts.lifeMin + Math.random() * (opts.lifeMax - opts.lifeMin);
    const scale = opts.scale + (Math.random() - 0.5) * 2 * opts.scaleVar;
    const rotSign = Math.random() < 0.5 ? 1 : -1;
    const rotSpeed = opts.rotMin + Math.random() * (opts.rotMax - opts.rotMin);

    p.sprite.texture = tex;
    p.sprite.x = cx;
    p.sprite.y = cy;
    p.sprite.alpha = 1;
    p.sprite.rotation = Math.random() * Math.PI * 2;
    p.sprite.scale.set(Math.max(0.1, scale));
    p.sprite.visible = true;

    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.vr = rotSign * rotSpeed;
    p.life = life;
    p.maxLife = life;
    p.drag = opts.drag;
    p.gravity = opts.gravity;
    p.active = true;
  }
}
