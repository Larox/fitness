import type { ConditionConfig } from "../config/types";
import type { NormalizedExercise } from "../library/types";
import { filterExercisesForScheduling } from "../safety/filter";
import type { SafetyFilterContext } from "../safety/types";
import type { TrainingSettings, WeekSessionCandidate } from "./types";
import { activeConditionIds } from "./defaults";

export interface ReFilteredWeekSession extends WeekSessionCandidate {
  scheduledExerciseIds: string[];
  droppedExerciseIds: string[];
}

/**
 * Re-run the safety filter on sessions still left in the current week.
 * Used when safety-relevant settings change (condition on, equipment removed).
 */
export function reFilterRemainingWeekSessions(
  sessions: readonly WeekSessionCandidate[],
  settings: TrainingSettings,
  conditions: ConditionConfig[],
  exercisesById: ReadonlyMap<string, NormalizedExercise>,
  excludedExerciseIds: ReadonlySet<string> = new Set(),
): ReFilteredWeekSession[] {
  const context: SafetyFilterContext = {
    conditions,
    activeConditionIds: activeConditionIds(settings),
    excludedExerciseIds,
    exercisesById,
  };

  return sessions.map((session) => {
    const candidates = session.exerciseIds
      .map((id) => exercisesById.get(id))
      .filter((row): row is NormalizedExercise => row !== undefined);
    const result = filterExercisesForScheduling(candidates, context);
    return {
      sessionId: session.sessionId,
      exerciseIds: session.exerciseIds,
      scheduledExerciseIds: result.scheduled.map((row) => row.exerciseId),
      droppedExerciseIds: result.dropped.map((row) => row.sourceExerciseId),
    };
  });
}