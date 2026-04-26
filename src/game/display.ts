import { Grid } from "./grid";
import { Numbers } from "./numbers";

class Display
{
    private grids : Grid | undefined;
    private numbers : Numbers | undefined;

    constructor(){

    }

    public Initialize(g: Grid, n: Numbers): void{
        this.grids = g;
        this.numbers = n;
    }

    public OnClick(index: number){
        console.log('clicked index: ', index);
    }
}

export const display = new Display();
