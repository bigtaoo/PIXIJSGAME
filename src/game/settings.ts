import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';

/**
 * 设置/暂停浮层。
 * 重构：移除对 display/config 的全局引用，改用 onResume 回调。
 * 构造时即创建所有子节点，可见性由 show()/hide() 控制。
 */
export class SettingsOverlay extends PIXI.Container {
  constructor(ctx: AppContext, onResume: () => void) {
    super();
    this.visible = false;

    const bg = ctx.assets.GetSpriteFromNumberAtlas('note.png');
    bg.width = 1500;
    bg.height = 800;
    bg.x = 300;
    bg.y = 200;
    this.addChild(bg);

    const closeBtn = ctx.assets.GetSpriteFromNumberAtlas('clock.png');
    closeBtn.width = 300;
    closeBtn.height = 200;
    closeBtn.x = 600;
    closeBtn.y = 500;
    this.addChild(closeBtn);
    ctx.input.registerUI(
      new UIElement({ zIndex: 20, sprite: closeBtn, onTap: onResume }),
    );
  }

  public show(): void {
    this.visible = true;
  }

  public hide(): void {
    this.visible = false;
  }
}
