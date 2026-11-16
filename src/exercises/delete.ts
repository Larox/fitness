import type { UserExercise, DeletedExerciseRecord } from "./types";
import type { WeekSessionCandidate } from "../setup/types";

export interface DeleteExerciseResult {
  userExercises: UserExercise[];
  deletedHistory: DeletedExerciseRecord[];
  weekSessionsRemaining: WeekSessionCandidate[];
  hurtExclusions: { exerciseId: string; markedAt: string; from: string }[];
}

export function deleteUserExercise(
  exerciseId: string,
  userExercises: readonly UserExercise[],
  deletedHistory: readonly DeletedExerciseRecord[],
  weekSessionsRemaining: readonly WeekSessionCandidate[],
  hurtExclusions: readonly { exerciseId: string; markedAt: string; from: string }[],
  deletedAt: Date,
): DeleteExerciseResult | null {
  const target = userExercises.find((e) => e.id === exerciseId);
  if (!target) {
    return null;
  }
  const snapshot: UserExercise = structuredClone(target);
  const historyEntry: DeletedExerciseRecord = {
    exerciseId: target.id,
    deletedAt: deletedAt.toISOString(),
    snapshot,
  };
  return {
    userExercises: userExercises.filter((e) => e.id !== exerciseId),
    deletedHistory: [...deletedHistory, historyEntry],
    weekSessionsRemaining: weekSessionsRemaining.map((session) => ({
      ...session,
      exerciseIds: session.exerciseIds.filter((id) => id !== exerciseId),
    })),
    hurtExclusions: hurtExclusions.filter((row) => row.exerciseId !== exerciseId),
  };
}