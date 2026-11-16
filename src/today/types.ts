export interface ExerciseSetLog {
  setIndex: number;
  status: "done" | "skipped";
  /** Reps completed when the dose is rep-based. */
  reps?: number;
  /** Hold seconds when the dose is hold-based. */
  holdS?: number;
}

export interface ExerciseSessionLog {
  exerciseId: string;
  sourceExerciseId: string;
  done: boolean;
  hurt: boolean;
  bellKg: number | null;
  sets: ExerciseSetLog[];
}

export interface SessionLogRecord {
  id: string;
  sessionId: string;
  dayIndex: number;
  completedAt: string;
  partial: boolean;
  location: "home" | "gym" | null;
  title: string;
  exercises: ExerciseSessionLog[];
}

export interface SessionCompletionSummary {
  completedAt: string;
  partial: boolean;
}