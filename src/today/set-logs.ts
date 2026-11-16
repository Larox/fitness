import type { ScheduledExercise } from "../safety/types";
import type { ExerciseSetLog } from "./types";

function parseReps(reps: string | number | null): number | undefined {
  if (typeof reps === "number" && Number.isFinite(reps)) {
    return reps;
  }
  if (reps === null || reps === undefined) {
    return undefined;
  }
  const match = /^(\d+)/.exec(String(reps).trim());
  return match ? Number(match[1]) : undefined;
}

export function defaultSetLogsForScheduled(row: ScheduledExercise): ExerciseSetLog[] {
  const setCount = Math.max(1, row.sets ?? 3);
  const holdS = row.hold_s ?? undefined;
  const reps = holdS === undefined ? parseReps(row.reps) : undefined;
  const logs: ExerciseSetLog[] = [];
  for (let i = 0; i < setCount; i++) {
    logs.push({
      setIndex: i,
      status: "done",
      ...(holdS !== undefined ? { holdS } : {}),
      ...(reps !== undefined ? { reps } : {}),
    });
  }
  return logs;
}