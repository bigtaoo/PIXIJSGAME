/**
 * Static stage configuration.
 *
 * 19 stages total; each stage has 5 targets (Stage 19 has 4).
 * Targets increment from 6 through 99.
 *
 * Grid expansion rules (determined by the first target of the stage):
 *   >= 71 -> 6 x 10 = 60 cells
 *   >= 51 -> 6 x 8  = 48 cells
 *   >= 31 -> 6 x 6  = 36 cells
 *   >= 21 -> 4 x 8  = 32 cells
 *   >= 11 -> 4 x 6  = 24 cells
 *   default -> 3 x 6 = 18 cells
 *
 * All cell counts are even numbers to guarantee valid pairing.
 */
export interface StageData {
  readonly stageIndex: number;         // 1-based (1-19)
  readonly targets: readonly number[]; // target values to clear in order
  readonly gridW: number;              // horizontal cell count
  readonly gridH: number;              // vertical cell count
}

function getGridDims(startTarget: number): [number, number] {
  if (startTarget >= 71) return [6, 10];
  if (startTarget >= 51) return [6, 8];
  if (startTarget >= 31) return [6, 6];
  if (startTarget >= 21) return [4, 8];
  if (startTarget >= 11) return [4, 6];
  return [3, 6];
}

function buildStages(): StageData[] {
  const stages: StageData[] = [];
  let target = 6;
  for (let si = 1; si <= 19; si++) {
    const count = si === 19 ? 4 : 5;
    const targets: number[] = [];
    for (let i = 0; i < count; i++) targets.push(target++);
    const [gridW, gridH] = getGridDims(targets[0]);
    stages.push({ stageIndex: si, targets, gridW, gridH });
  }
  return stages;
}

export const STAGES: readonly StageData[] = buildStages();
