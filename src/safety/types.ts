import type { ConditionConfig } from "../config/types";
import type { NormalizedExercise, RiskLevel } from "../library/types";

export interface SafetyFilterContext {
  conditions: ConditionConfig[];
  /** Condition ids that participate in blocking (typically all on at setup). */
  activeConditionIds: ReadonlySet<string>;
  /** Exercise ids the user marked as painful; never scheduled. */
  excludedExerciseIds: ReadonlySet<string>;
  /** Full imported library, keyed by exercise id (for swap targets). */
  exercisesById: ReadonlyMap<string, NormalizedExercise>;
  /** Optional routine-level notes for safer-move suggestions when dropping high-risk items. */
  routineNotesById?: ReadonlyMap<string, string | undefined>;
}

export interface ScheduledExercise {
  /** Exercise that may be performed (after an optional swap). */
  exerciseId: string;
  /** Original candidate id from the input list. */
  sourceExerciseId: string;
  reasons: string[];
  /** Cautions to show before starting (moderate risk on active conditions). */
  cautions: string[];
  reps: string | number | null;
  sets: number | null;
  hold_s: number | null;
  /** Visible for every configured condition, including inactive ones. */
  conditionRisks: Record<string, RiskLevel>;
}

export interface DroppedExercise {
  sourceExerciseId: string;
  reasons: string[];
  /** Plain-text suggestion from routine notes when no safe swap exists. */
  saferMoveSuggestion?: string;
  conditionRisks: Record<string, RiskLevel>;
}

export interface SafetyFilterResult {
  scheduled: ScheduledExercise[];
  dropped: DroppedExercise[];
}