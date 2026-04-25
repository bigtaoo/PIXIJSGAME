import { config } from "./config"
import { Orientation } from "./enums"

export const offset_x = () => {
    if (config.Orientation === Orientation.Landscape){
        return 300;
    }
    return 100;
}

export const grid_size = () => {
    return 120;
}

export const grid_count_w = () => {
    if (config.Orientation === Orientation.Landscape){
        return 12;
    }
    return 6;
}

export const grid_count_h = () => {
    if (config.Orientation === Orientation.Landscape){
        return 6;
    }
    return 12;
}

export const index = (x: number, y: number): number => {
    return y * 1000 + x;
}
