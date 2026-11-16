import type { ExerciseDose } from "./types";

export function clampSets(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)));
}

export function clampReps(value: number): number {
  return Math.min(50, Math.max(1, Math.round(value)));
}

export function clampHoldSeconds(value: number): number {
  const stepped = Math.round(value / 5) * 5;
  return Math.min(300, Math.max(5, stepped));
}

/** Today-style dose label, e.g. "3 × 45 s per side". */
export function formatDosePreview(dose: ExerciseDose): string {
  const sets = dose.sets;
  const side = dose.perSide ? " per side" : "";
  if (dose.mode === "hold") {
    const seconds = dose.holdS ?? 30;
    return `${sets} × ${seconds} s${side}`;
  }
  const reps = dose.reps ?? 10;
  return `${sets} × ${reps}${side}`;
}

export function doseToRepsField(dose: ExerciseDose): string {
  const side = dose.perSide ? " per side" : "";
  if (dose.mode === "hold") {
    return `${dose.holdS ?? 30} s${side}`;
  }
  return `${dose.reps ?? 10}${side}`;
}

export function defaultDose(): ExerciseDose {
  return { mode: "reps", sets: 3, reps: 10, perSide: false };
}