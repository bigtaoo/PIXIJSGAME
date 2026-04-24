import { Orientation } from "./enums";

class Config
{
    public Width: number = 100;
    public Height: number = 100;
    public Scale: number = 1;
    public Orientation: Orientation = Orientation.Portrait;
}

export const config = new Config();