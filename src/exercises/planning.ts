import type { ConditionConfig } from "../config/types";
import type { NormalizedExercise } from "../library/types";
import { filterExercisesForScheduling } from "../safety/filter";
import type { SafetyFilterContext } from "../safety/types";
import { userExerciseToNormalized } from "./to-normalized";
import type { UserExercise } from "./types";

export function userExercisesToNormalized(
  exercises: readonly UserExercise[],
  conditions: readonly ConditionConfig[],
): NormalizedExercise[] {
  return exercises.map((ex) => userExerciseToNormalized(ex, conditions));
}

export function mergeExercisesById(
  library: readonly NormalizedExercise[],
  user: readonly UserExercise[],
  conditions: readonly ConditionConfig[],
): Map<string, NormalizedExercise> {
  const map = new Map<string, NormalizedExercise>();
  for (const ex of library) {
    map.set(ex.id, ex);
  }
  for (const row of user) {
    map.set(row.id, userExerciseToNormalized(row, conditions));
  }
  return map;
}

export function scheduleUserExercise(
  exercise: UserExercise,
  context: SafetyFilterContext,
  conditions: readonly ConditionConfig[],
): ReturnType<typeof filterExercisesForScheduling> {
  const normalized = userExerciseToNormalized(exercise, conditions);
  return filterExercisesForScheduling([normalized], context);
}