import type { DeletedExerciseRecord, HurtExclusion, UserExercise } from "../exercises/types";

/** User training preferences persisted on device. */
export interface TrainingSettings {
  daysPerWeek: number;
  sessionMinutes: number;
  homeBellsKg: number[];
  noHomeBells: boolean;
  gymBellsKg: number[];
  /** Per condition id: true = cautions and swaps apply. */
  conditionsEnabled: Record<string, boolean>;
}

export interface PersistedAppState {
  settings: TrainingSettings;
  /** Disclaimer version the user acknowledged, if any. */
  disclaimerAcknowledgedVersion?: number;
  /** ISO timestamp of last disclaimer acknowledgement. */
  disclaimerAckAt?: string;
  /** Whether the user finished first-run setup. */
  setupComplete: boolean;
  userExercises?: UserExercise[];
  hurtExclusions?: HurtExclusion[];
  deletedExerciseHistory?: DeletedExerciseRecord[];
  /** Sessions still scheduled in the current plan week (for re-filter and restore semantics). */
  weekSessionsRemaining?: WeekSessionCandidate[];
}

export interface SettingsChangeSummary {
  /** Non-safety fields changed (days, session length, bell additions, etc.). */
  planAffectingChanges: number;
  /** Safety-relevant diff that should re-filter sessions left this week. */
  safetyRelevant: boolean;
}

export interface WeekSessionCandidate {
  sessionId: string;
  /** Exercise ids still scheduled in this session. */
  exerciseIds: string[];
}