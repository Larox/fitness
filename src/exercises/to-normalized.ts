import type { ConditionConfig } from "../config/types";
import type { ExerciseOverlayEntry, NormalizedExercise } from "../library/types";
import { doseToRepsField } from "./dose";
import { buildConditionRiskMapForFilter, isRiskExplicitlySet } from "./risk";
import type { UserExercise } from "./types";

export function userExerciseToNormalized(
  exercise: UserExercise,
  conditions: readonly ConditionConfig[],
): NormalizedExercise {
  const overlay: ExerciseOverlayEntry = {
    kettlebell: exercise.kettlebell || undefined,
    location: exercise.location,
    defaultDose: {
      sets: exercise.dose.sets,
      reps: doseToRepsField(exercise.dose),
      hold_s: exercise.dose.mode === "hold" ? exercise.dose.holdS : undefined,
    },
  };

  const userUnsetConditionIds = conditions
    .filter((c) => !isRiskExplicitlySet(exercise, c.id))
    .map((c) => c.id);

  return {
    id: exercise.id,
    routineId: exercise.routineId,
    name: exercise.name,
    sets: exercise.dose.sets,
    reps: doseToRepsField(exercise.dose),
    equipment: exercise.equipment || null,
    cues: exercise.cues,
    moderateCautionsByCondition:
      Object.keys(exercise.moderateCautions).length > 0
        ? { ...exercise.moderateCautions }
        : undefined,
    userUnsetConditionIds: userUnsetConditionIds.length ? userUnsetConditionIds : undefined,
    conditionRisks: buildConditionRiskMapForFilter(exercise, conditions),
    overlay,
  };
}