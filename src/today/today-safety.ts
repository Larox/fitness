import type { NormalizedExercise } from "../library/types";
import type { WeekPlanSessionResult } from "../plan/types";
import {
  effectiveRiskForActiveConditions,
  scheduledRowIsSafeForActiveConditions,
} from "../safety/filter";

export interface TodaySafetyReport {
  ok: boolean;
  highRiskExerciseIds: string[];
}

/** Ensures Today never lists a high-risk exercise for active conditions. */
export function assertTodaySessionSafe(
  session: WeekPlanSessionResult,
  exercisesById: ReadonlyMap<string, NormalizedExercise>,
  activeConditionIds: ReadonlySet<string>,
): TodaySafetyReport {
  const highRiskExerciseIds: string[] = [];
  for (const row of session.scheduled) {
    if (!scheduledRowIsSafeForActiveConditions(row, activeConditionIds)) {
      highRiskExerciseIds.push(row.exerciseId);
      continue;
    }
    const exercise = exercisesById.get(row.exerciseId);
    if (exercise && effectiveRiskForActiveConditions(exercise, activeConditionIds) === "high") {
      highRiskExerciseIds.push(row.exerciseId);
    }
  }
  return { ok: highRiskExerciseIds.length === 0, highRiskExerciseIds };
}

export function sessionHasModerateCaution(session: WeekPlanSessionResult): boolean {
  return session.scheduled.some((row) => row.cautions.length > 0);
}