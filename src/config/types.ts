export interface ConditionConfig {
  /** Stable id used in normalized import output. */
  id: string;
  /** Human-readable label (from private config, not hardcoded in code). */
  label: string;
  /** Optional one-line description for setup (from private config). */
  description?: string;
  /** Snapshot JSON field on each exercise/routine, e.g. `concern_a_risk`. */
  libraryField: string;
}

export interface EquipmentLocationBells {
  bellsKg: number[];
}

export interface EquipmentConfig {
  /** Kettlebell weights offered as chips in setup. */
  availableBellsKg: number[];
  home: EquipmentLocationBells;
  gym: EquipmentLocationBells;
}

export interface AppConfig {
  /** Path to the exercise library JSON (relative to repo root or absolute). */
  libraryPath: string;
  /** Optional overlay keyed by exercise id. */
  overlayPath?: string;
  conditions: ConditionConfig[];
  /** Shown in disclaimers; supplied via private config only. */
  disclaimerContact?: string;
  /** Bump when disclaimer text or contact changes; users must re-acknowledge. */
  disclaimerVersion: number;
  equipment: EquipmentConfig;
}