import type { SessionLocation } from "../library/types";
import type { DroppedExercise, ScheduledExercise } from "../safety/types";

export type TrainingSlotKind = "mobility" | "strength" | "light_mobility";
export type WeekSlotKind = TrainingSlotKind | "rest";

export interface WeekPlanSessionResult {
  scheduled: ScheduledExercise[];
  dropped: DroppedExercise[];
}

export interface WeekPlanRow {
  dayIndex: number;
  dayLabel: string;
  slotKind: WeekSlotKind;
  sessionId: string;
  title: string;
  location: SessionLocation | null;
  minutes: number;
  hasCaution: boolean;
  candidateExerciseIds: string[];
}

export interface WeekPlan {
  seed: string;
  rows: WeekPlanRow[];
  sessions: Record<string, WeekPlanSessionResult>;
}