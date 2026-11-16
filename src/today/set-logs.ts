import type { ScheduledExercise } from "../safety/types";
import type { ExerciseSessionLog, ExerciseSetLog } from "./types";

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

function parseHoldSeconds(reps: string | number | null): number | undefined {
  if (reps === null || reps === undefined) {
    return undefined;
  }
  const match = /(\d+)\s*s/i.exec(String(reps));
  return match ? Number(match[1]) : undefined;
}

export function scheduledUsesHold(row: ScheduledExercise): boolean {
  if (row.hold_s !== null && row.hold_s !== undefined && row.hold_s > 0) {
    return true;
  }
  return parseHoldSeconds(row.reps) !== undefined;
}

export function plannedHoldSeconds(row: ScheduledExercise): number {
  if (row.hold_s !== null && row.hold_s !== undefined && row.hold_s > 0) {
    return row.hold_s;
  }
  return parseHoldSeconds(row.reps) ?? 30;
}

export function plannedReps(row: ScheduledExercise): number {
  return parseReps(row.reps) ?? 10;
}

export function defaultSetLogsForScheduled(row: ScheduledExercise): ExerciseSetLog[] {
  const setCount = Math.max(1, row.sets ?? 3);
  const hold = scheduledUsesHold(row);
  const holdS = hold ? plannedHoldSeconds(row) : undefined;
  const reps = hold ? undefined : plannedReps(row);
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

export function normalizeExerciseSetLogs(
  entry: ExerciseSessionLog,
  scheduled?: ScheduledExercise,
): ExerciseSetLog[] {
  if (Array.isArray(entry.sets) && entry.sets.length > 0) {
    return entry.sets.map((row) => ({
      setIndex: row.setIndex,
      status: row.status === "skipped" ? "skipped" : "done",
      ...(row.reps !== undefined ? { reps: row.reps } : {}),
      ...(row.holdS !== undefined ? { holdS: row.holdS } : {}),
    }));
  }
  if (scheduled) {
    return defaultSetLogsForScheduled(scheduled);
  }
  return [];
}