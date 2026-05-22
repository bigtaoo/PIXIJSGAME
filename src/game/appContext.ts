import { IAssetsManager } from '../assetsManager/IAssetsManager';
import { InputManager } from '../inputSystem/inputManager';

export interface AppContext {
  assets: IAssetsManager;
  input: InputManager;
}
