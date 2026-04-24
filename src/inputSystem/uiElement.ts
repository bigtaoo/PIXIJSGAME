import * as PIXI from 'pixi.js-legacy';

export class UIElement {
    zIndex: number = 0;
    visible: boolean = true;

    private boundsProvider: () => DOMRect | PIXI.Rectangle;
    private onTap?: () => void;

    constructor(options: {
        zIndex?: number;
        bounds: () => DOMRect | PIXI.Rectangle;
        onTap?: () => void;
    }) {
        this.zIndex = options.zIndex ?? 0;
        this.boundsProvider = options.bounds;
        this.onTap = options.onTap;
    }

    contains(x: number, y: number): boolean {
        const b = this.boundsProvider();

        return (
            x >= b.x &&
            x <= b.x + b.width &&
            y >= b.y &&
            y <= b.y + b.height
        );
    }

    handle(e: { type: string }) {
        if (e.type === 'tap' && this.onTap) {
            this.onTap();
        }
    }
}
