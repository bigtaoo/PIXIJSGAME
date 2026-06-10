/**
 * LoadingOverlay
 *
 * A pure-DOM loading screen shown while game assets load.
 * Uses the game's art-style colours (warm off-white background, dark-brown bar).
 * Fades out and removes itself from the DOM when dismiss() is called.
 *
 * Usage:
 *   const overlay = new LoadingOverlay();
 *   assets.loadAssets((loaded, total) => overlay.setProgress(loaded / total));
 *   await overlay.dismiss();
 */
export class LoadingOverlay {
  private readonly root: HTMLDivElement;
  private readonly fill: HTMLDivElement;

  constructor() {
    // ── Root overlay ────────────────────────────────────────────────────────
    const root = document.createElement('div');
    root.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:#F5EAC8', // 米白色 — matches game art style
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'gap:20px',
      'z-index:9999',
      'transition:opacity 0.35s ease',
    ].join(';');

    // ── Progress bar track ─────────────────────────────────────────────────
    const track = document.createElement('div');
    track.style.cssText = [
      'width:200px',
      'height:6px',
      'background:#D9C9A8', // slightly darker cream for the unfilled track
      'border-radius:3px',
      'overflow:hidden',
    ].join(';');

    // ── Progress bar fill ──────────────────────────────────────────────────
    const fill = document.createElement('div');
    fill.style.cssText = [
      'width:0%',
      'height:100%',
      'background:#6D4C41', // dark warm-brown — primary game colour
      'border-radius:3px',
      'transition:width 0.15s ease',
    ].join(';');

    track.appendChild(fill);
    root.appendChild(track);
    document.body.appendChild(root);

    this.root = root;
    this.fill = fill;
  }

  /**
   * Update the progress bar.  value should be in [0, 1].
   */
  setProgress(value: number): void {
    this.fill.style.width = `${Math.min(100, Math.round(value * 100))}%`;
  }

  /**
   * Animate to 100 %, fade out, then remove the element from the DOM.
   * Returns a Promise that resolves once the fade is complete.
   */
  async dismiss(): Promise<void> {
    // Snap to full before fading so it never looks stuck at 99 %
    this.setProgress(1);
    // Brief pause so the full bar is visible, then fade
    await new Promise<void>((r) => setTimeout(r, 120));
    this.root.style.opacity = '0';
    await new Promise<void>((r) => setTimeout(r, 370));
    this.root.remove();
  }
}
