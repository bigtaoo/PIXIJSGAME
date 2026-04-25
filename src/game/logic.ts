import { grid_count_h, grid_count_w, index } from "./helper";

class Logic
{
    private numbers: Map<number, number> = new Map();

    public Initialize(target: number): void {
        this.numbers.clear();
        const w = grid_count_w();
        const h = grid_count_h();
        const n: number[] = [];
        const count = w * h / 2;
        for (let i = 0; i < count; ++i){
            const first = Math.floor(Math.random() % 9) + 1;
            const second = target - first;
            n.push(first, second);
        }
        this.shuffle(n);
        for (let i = 0; i < w; ++i){
            for (let j = 0; j < h; ++j){
                const s = index(i, j);
                this.numbers.set(s, n.pop() ?? 0);
            }
        }
    }

    public getNumber(x: number, y: number): number{
        const s = index(x, y);
        return this.numbers.get(s) ?? 0;
    }

    private shuffle(arr: number[]): void {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}

export const logic = new Logic();
