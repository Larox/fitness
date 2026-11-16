import type { NormalizedExercise } from "../library/types";

export function exerciseUsesKettlebell(exercise: NormalizedExercise): boolean {
  const equipment = (exercise.equipment ?? "").toLowerCase();
  if (exercise.overlay?.kettlebell) {
    return true;
  }
  return /kettlebell|\bkb\b/.test(equipment);
}