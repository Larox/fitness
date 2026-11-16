export interface ConditionConfig {
  /** Stable id used in normalized import output. */
  id: string;
  /** Human-readable label (from private config, not hardcoded in code). */
  label: string;
  /** Snapshot JSON field on each exercise/routine, e.g. `concern_a_risk`. */
  libraryField: string;
}

export interface AppConfig {
  /** Path to the exercise library JSON (relative to repo root or absolute). */
  libraryPath: string;
  /** Optional overlay keyed by exercise id. */
  overlayPath?: string;
  conditions: ConditionConfig[];
  /** Shown in disclaimers; supplied via private config only. */
  disclaimerContact?: string;
}