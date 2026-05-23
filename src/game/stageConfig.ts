/**
 * 关卡静态配置。
 *
 * 共 19 关，每关 5 个目标数字（最后一关 4 个）。
 * 目标数字从 6 依次递增至 99。
 *
 * 格子扩张规则（取本关第一个目标数字判断）：
 *   ≥ 71 → 6×10 = 60 格
 *   ≥ 51 → 6×8  = 48 格
 *   ≥ 31 → 6×6  = 36 格
 *   ≥ 21 → 4×8  = 32 格
 *   ≥ 11 → 4×6  = 24 格
 *   default → 3×6 = 18 格
 *
 * 所有网格总格子数均为偶数，保证可正确配对。
 */
export interface StageData {
  readonly stageIndex: number;         // 1-based（1–19）
  readonly targets: readonly number[]; // 本关依次要消除的目标数字
  readonly gridW: number;              // 横向格子数
  readonly gridH: number;              // 纵向格子数
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
