import * as PIXI from 'pixi.js-legacy';
import { AppContext } from './appContext';
import { UIElement } from '../inputSystem/uiElement';

/**
 * 设置/暂停浮层。
 * 提供"继续游戏"和"返回大厅"两个操作。
 */
export class SettingsOverlay extends PIXI.Container {
  constructor(
    ctx: AppContext,
    onResume: () => void,
    onGoLobby: () => void,
  ) {
    super();
    this.visible = false;

    const bg = ctx.assets.GetSpriteFromNumberAtlas('note.png');
    bg.width = 700;
    bg.height = 500;
    bg.x = 190;
    bg.y = 710;
    this.addChild(bg);

    // 继续游戏
    const resumeBtn = ctx.assets.GetSpriteFromNumberAtlas('next.png');
    resumeBtn.width = 200;
    resumeBtn.height = 200;
    resumeBtn.x = 230;
    resumeBtn.y = 820;
    this.addChild(resumeBtn);
    ctx.input.registerUI(
      new UIElement({ zIndex: 20, sprite: resumeBtn, onTap: onResume }),
    );

    // 返回大厅
    const lobbyBtn = ctx.assets.GetSpriteFromNumberAtlas('clock.png');
    lobbyBtn.width = 200;
    lobbyBtn.height = 200;
    lobbyBtn.x = 470;
    lobbyBtn.y = 820;
    this.addChild(lobbyBtn);
    ctx.input.registerUI(
      new UIElement({ zIndex: 20, sprite: lobbyBtn, onTap: onGoLobby }),
    );
  }

  public show(): void {
    this.visible = true;
  }

  public hide(): void {
    this.visible = false;
  }
}
