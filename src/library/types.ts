/** Risk tier used by the coach (slice 2+). Missing source data is normalized to high. */
export type RiskLevel = "low" | "moderate" | "high";

export type SessionLocation = "home" | "gym";

/** Fields the Leeds snapshot does not carry; keyed by exercise ID in overlay.json. */
export interface ExerciseOverlayEntry {
  swap_to?: string;
  max_reps?: number;
  max_hold_s?: number;
  kettlebell?: boolean;
  location?: SessionLocation;
  defaultDose?: {
    sets?: number;
    reps?: string;
    hold_s?: number;
  };
}

export type ExerciseOverlayFile = Record<string, ExerciseOverlayEntry>;

export interface DurationMin {
  /** Display string preserved from the source (e.g. "10-15", "5"). */
  display: string;
  min: number | null;
  max: number | null;
}

/** Raw routine shape from the read-only snapshot (import boundary only). */
export interface SnapshotRoutine {
  id: string;
  source?: string;
  video?: string;
  added?: string;
  title: string;
  category?: string | string[];
  equipment?: string[] | null;
  frequency?: string | null;
  duration_min?: number | string | null;
  difficulty?: string | null;
  notes?: string;
  exercises?: SnapshotExercise[];
  concern_a_risk?: RiskLevel;
  knee_risk?: RiskLevel;
}

export interface SnapshotExercise {
  name: string;
  sets?: number | null;
  reps?: string | number | null;
  equipment?: string | null;
  cues?: string | string[] | null;
  caution?: string;
  concern_a_risk?: RiskLevel;
  knee_risk?: RiskLevel;
}

export interface NormalizedExercise {
  id: string;
  routineId: string;
  name: string;
  sets: number | null;
  reps: string | number | null;
  equipment: string | null;
  cues: string[];
  caution?: string;
  concernARisk: RiskLevel;
  kneeRisk: RiskLevel;
  overlay?: ExerciseOverlayEntry;
}

export interface NormalizedRoutine {
  id: string;
  title: string;
  source?: string;
  categories: string[];
  equipment: string[];
  frequency: string | null;
  durationMin: DurationMin | null;
  difficulty: string | null;
  notes?: string;
  concernARisk: RiskLevel;
  kneeRisk: RiskLevel;
  exerciseIds: string[];
}

export interface SkippedRoutine {
  routineId: string;
  title: string;
  reason: string;
}

export interface LibraryImportResult {
  routines: NormalizedRoutine[];
  exercises: NormalizedExercise[];
  skipped: SkippedRoutine[];
  errors: string[];
}