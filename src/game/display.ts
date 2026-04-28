import { config } from "./config";
import { Grid } from "./grid";
import { logic } from "./logic";
import { Numbers } from "./numbers";

class Display
{
    private grids : Grid | undefined;
    private numbers : Numbers | undefined;
    private slectedIndex: number = -1;

    constructor(){

    }

    public Initialize(g: Grid, n: Numbers): void{
        this.grids = g;
        this.numbers = n;
    }

    public OnClick(index: number){
        // console.log('clicked index: ', index);
        if (this.slectedIndex === -1){
            this.slectedIndex = index;
            this.grids?.DrawSelectedImage(index);
        } else {
            const selectedValue = logic.getNumberByIndex(this.slectedIndex);
            const currentValue = logic.getNumberByIndex(index);
            if (selectedValue + currentValue === config.Target){               
                this.grids?.HideSelctedImage();
                this.grids?.HideGrid(this.slectedIndex);
                this.grids?.HideGrid(index);
                this.numbers?.HideNumber(this.slectedIndex);
                this.numbers?.HideNumber(index);
                this.slectedIndex = -1;
            }else{
                this.slectedIndex = index;
                this.grids?.DrawSelectedImage(index);
            }
        }
    }
}

export const display = new Display();
