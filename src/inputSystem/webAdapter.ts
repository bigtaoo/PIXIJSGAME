import { InputManager } from './inputManager';

export function setupWebInput(canvas: HTMLCanvasElement, input: InputManager) {
  // offsetX/offsetY are relative to the canvas element itself,
  // which matches PIXI's stage coordinate system directly.
  canvas.addEventListener('pointerdown', (e) => {
    input.emit({ x: e.offsetX, y: e.offsetY, type: 'down' });
  });

  canvas.addEventListener('pointerup', (e) => {
    input.emit({ x: e.offsetX, y: e.offsetY, type: 'tap' });
  });
}
