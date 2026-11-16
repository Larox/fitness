export function toggleBell(
  selected: readonly number[],
  kg: number,
): number[] {
  if (selected.includes(kg)) {
    return selected.filter((value) => value !== kg);
  }
  return [...selected, kg].sort((a, b) => a - b);
}

/** Selecting a weight clears "no bells"; selecting "no bells" clears weights. */
export function selectNoHomeBells(): { noHomeBells: true; homeBellsKg: number[] } {
  return { noHomeBells: true, homeBellsKg: [] };
}

export function selectHomeBell(
  homeBellsKg: readonly number[],
  kg: number,
): { noHomeBells: false; homeBellsKg: number[] } {
  return { noHomeBells: false, homeBellsKg: toggleBell(homeBellsKg, kg) };
}

export function summarizeBellRange(kg: readonly number[]): string {
  if (kg.length === 0) {
    return "None";
  }
  if (kg.length === 1) {
    return `${kg[0]} kg`;
  }
  return `${kg.length} bells · ${Math.min(...kg)}–${Math.max(...kg)} kg`;
}

export function arraysEqualSorted(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}