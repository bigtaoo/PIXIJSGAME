import { config } from "./config"
import { Orientation } from "./enums"

export const offset_x = () => {
    if (config.Orientation === Orientation.Landscape){
        return 400;
    }
    return 100;
}