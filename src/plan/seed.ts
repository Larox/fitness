import type { TrainingSettings } from "../setup/types";

/** Deterministic PRNG (mulberry32) from a string seed. */
export function createSeededRng(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return function mulberry32(): number {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function defaultPlanSeed(settings: TrainingSettings): string {
  return JSON.stringify({
    v: 1,
    daysPerWeek: settings.daysPerWeek,
    sessionMinutes: settings.sessionMinutes,
    noHomeBells: settings.noHomeBells,
    homeBellsKg: [...settings.homeBellsKg].sort((a, b) => a - b),
    gymBellsKg: [...settings.gymBellsKg].sort((a, b) => a - b),
  });
}