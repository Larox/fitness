import type { ConditionConfig } from "../config/types";
import type { NormalizedExercise, NormalizedRoutine } from "../library/types";
import type { PersistedAppState, SettingsChangeSummary, TrainingSettings } from "../setup/types";
import { buildWeeklyPlan } from "./build-week-plan";
import { defaultPlanSeed } from "./seed";
import { reFilterWeekPlan, reFilterWeekSessionsFromPlan } from "./re-filter-plan";

export interface PlanBuildContext {
  conditions: ConditionConfig[];
  routines: readonly NormalizedRoutine[];
  exercisesById: ReadonlyMap<string, NormalizedExercise>;
  excludedExerciseIds: ReadonlySet<string>;
  routineNotesById: ReadonlyMap<string, string | undefined>;
}

export function applyTrainingSettingsSave(
  persisted: PersistedAppState,
  draft: TrainingSettings,
  summary: SettingsChangeSummary,
  context: PlanBuildContext,
): PersistedAppState {
  const next: PersistedAppState = { ...persisted, settings: draft };

  const shouldRebuild = summary.planAffectingChanges > 0 || !persisted.weekPlan;

  if (shouldRebuild) {
    const built = buildWeeklyPlan({
      seed: defaultPlanSeed(draft),
      settings: draft,
      conditions: context.conditions,
      routines: context.routines,
      exercisesById: context.exercisesById,
      excludedExerciseIds: context.excludedExerciseIds,
      routineNotesById: context.routineNotesById,
    });
    return {
      ...next,
      weekPlan: built.plan,
      weekSessionsRemaining: built.weekSessionsRemaining,
    };
  }

  if (summary.safetyRelevant && persisted.weekPlan) {
    const plan = reFilterWeekPlan({
      plan: persisted.weekPlan,
      settings: draft,
      conditions: context.conditions,
      exercisesById: context.exercisesById,
      excludedExerciseIds: context.excludedExerciseIds,
      routineNotesById: context.routineNotesById,
    });
    return {
      ...next,
      weekPlan: plan,
      weekSessionsRemaining: reFilterWeekSessionsFromPlan(
        plan,
        draft,
        context.conditions,
        context.exercisesById,
        context.excludedExerciseIds,
      ),
    };
  }

  return next;
}