import * as PIXI from 'pixi.js-legacy';
import { config } from './config';
import { EffectManager } from './effectManager';
import { Grid } from './grid';
import { logic } from './logic';
import { Numbers } from './numbers';
import { Header } from './header';
import { GameResult } from './gameResult';

class Display {
  private grids: Grid | undefined;
  private numbers: Numbers | undefined;
  private effects: EffectManager | undefined;
  private header: Header | undefined;
  private gameResult: GameResult | undefined;

  private slectedIndex: number = -1;
  private gameScene: PIXI.Container | undefined;

  constructor() {}

  public Initialize(gameScene: PIXI.Container): void {
    this.gameScene = gameScene;
  }

  public Draw() {
    if (!this.grids) {
      this.grids = new Grid();
      this.gameScene?.addChild(this.grids);
    }
    this.grids.DrawGrids();

    if (!this.numbers) {
      this.numbers = new Numbers();
      this.gameScene?.addChild(this.numbers);
    }
    this.numbers.DrawNumbers();

    if (!this.header) {
      this.header = new Header();
      this.gameScene?.addChild(this.header);
    }

    if (!this.effects) {
      this.effects = new EffectManager();
      this.gameScene?.addChild(this.effects);
    }

    if (!this.gameResult) {
      this.gameResult = new GameResult();
      this.gameScene?.addChild(this.gameResult);
    }

    // console.log('children: ', this.gameScene?.children);
  }

  public Update(delta: number) {
    this.effects?.Update(delta);
    this.header?.UpdateTime();

    if (config.TimeCount - config.GameTime < 100) {
      config.isGameEnd = true;
      this.gameResult!.visible = true;
      this.gameResult?.Draw(false);
    }
  }

  public NewGame(): void {
    config.GameTime = 0;
    config.isGameEnd = false;
    logic.Initialize(config.Target);
    this.grids?.NewGame();
    this.numbers?.NewGame();
  }

  public OnClick(index: number) {
    if (config.isGameEnd) {
      return;
    }
    // console.log('clicked index: ', index);
    if (this.slectedIndex === -1) {
      this.slectedIndex = index;
      this.grids?.DrawSelectedImage(index);
    } else if (this.slectedIndex === index) {
      return;
    } else {
      const selectedValue = logic.getNumberByIndex(this.slectedIndex);
      const currentValue = logic.getNumberByIndex(index);
      if (selectedValue + currentValue === config.Target) {
        this.grids?.HideSelctedImage();
        this.grids?.HideGrid(this.slectedIndex);
        this.grids?.HideGrid(index);
        this.numbers?.HideNumber(this.slectedIndex);
        this.numbers?.HideNumber(index);
        this.effects?.PlayEffect(index);
        this.effects?.PlayEffect(this.slectedIndex);
        logic.removeNumber(this.slectedIndex);
        logic.removeNumber(index);
        this.slectedIndex = -1;

        if (logic.isRemovedAllNumber()) {
          config.isGameEnd = true;
          this.gameResult?.Draw(true);
        }
      } else {
        this.slectedIndex = index;
        this.grids?.DrawSelectedImage(index);
      }
    }
  }
}

export const display = new Display();
