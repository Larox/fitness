import type { ConditionConfig } from "../config/types";
import type { NormalizedExercise } from "../library/types";
import { filterExercisesForScheduling } from "../safety/filter";
import type { SafetyFilterContext } from "../safety/types";
import { activeConditionIds } from "../setup/defaults";
import { reFilterRemainingWeekSessions } from "../setup/re-filter";
import type { TrainingSettings, WeekSessionCandidate } from "../setup/types";
import type { WeekPlan } from "./types";

export interface ReFilterPlanInput {
  plan: WeekPlan;
  settings: TrainingSettings;
  conditions: ConditionConfig[];
  exercisesById: ReadonlyMap<string, NormalizedExercise>;
  excludedExerciseIds?: ReadonlySet<string>;
  routineNotesById?: ReadonlyMap<string, string | undefined>;
  conditionLabel?: (id: string) => string;
}

export function reFilterWeekPlan(input: ReFilterPlanInput): WeekPlan {
  const context: SafetyFilterContext = {
    conditions: input.conditions,
    activeConditionIds: activeConditionIds(input.settings),
    excludedExerciseIds: input.excludedExerciseIds ?? new Set(),
    exercisesById: input.exercisesById,
    routineNotesById: input.routineNotesById,
    conditionLabel: input.conditionLabel,
  };

  const sessions = { ...input.plan.sessions };
  const rows = input.plan.rows.map((row) => {
    if (row.slotKind === "rest") {
      return row;
    }
    const candidates = row.candidateExerciseIds
      .map((id) => input.exercisesById.get(id))
      .filter((ex): ex is NormalizedExercise => ex !== undefined);
    const filtered = filterExercisesForScheduling(candidates, context);
    sessions[row.sessionId] = {
      scheduled: filtered.scheduled,
      dropped: filtered.dropped,
    };
  return {
    ...row,
    hasCaution: filtered.scheduled.some((s) => s.cautions.length > 0),
  };
  });

  return { ...input.plan, rows, sessions };
}

export function reFilterWeekSessionsFromPlan(
  plan: WeekPlan,
  settings: TrainingSettings,
  conditions: ConditionConfig[],
  exercisesById: ReadonlyMap<string, NormalizedExercise>,
  excludedExerciseIds: ReadonlySet<string> = new Set(),
): WeekSessionCandidate[] {
  const candidates: WeekSessionCandidate[] = plan.rows
    .filter((row) => row.slotKind !== "rest")
    .map((row) => ({
      sessionId: row.sessionId,
      exerciseIds: [...row.candidateExerciseIds],
    }));

  return reFilterRemainingWeekSessions(
    candidates,
    settings,
    conditions,
    exercisesById,
    excludedExerciseIds,
  ).map((row) => ({
    sessionId: row.sessionId,
    exerciseIds: row.exerciseIds,
  }));
}