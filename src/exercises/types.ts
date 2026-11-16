import type { RiskLevel, SessionLocation } from "../library/types";

export type DoseMode = "reps" | "hold";

export interface ExerciseDose {
  mode: DoseMode;
  sets: number;
  reps?: number;
  holdS?: number;
  perSide: boolean;
}

/** User-authored exercise stored on device (stable id and routineId at creation). */
export interface UserExercise {
  id: string;
  routineId: string;
  name: string;
  categories: string[];
  equipment: string;
  cues: string[];
  link?: string;
  dose: ExerciseDose;
  /** Only configured conditions the user explicitly chose a level for. */
  riskChosen: Record<string, RiskLevel>;
  /** Optional caution copy per condition when risk is moderate. */
  moderateCautions: Record<string, string>;
  kettlebell: boolean;
  location?: SessionLocation;
  createdAt: string;
  /** ISO time until which the row shows a “New” tag (24h after save). */
  newUntil?: string;
}

export interface HurtExclusion {
  exerciseId: string;
  markedAt: string;
  /** Source surface, e.g. "today". */
  from: string;
}

export interface DeletedExerciseRecord {
  exerciseId: string;
  deletedAt: string;
  snapshot: UserExercise;
}

export interface ExerciseFormDraft {
  name: string;
  categories: string[];
  equipment: string;
  cues: string[];
  link: string;
  dose: ExerciseDose;
  riskChosen: Record<string, RiskLevel>;
  moderateCautions: Record<string, string>;
  kettlebell: boolean;
  location?: SessionLocation;
}