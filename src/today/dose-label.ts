import type { ScheduledExercise } from "../safety/types";

function parseHoldSeconds(reps: string | number | null): number | null {
  if (reps === null || reps === undefined) {
    return null;
  }
  const match = /(\d+)\s*s/i.exec(String(reps));
  return match ? Number(match[1]) : null;
}

/** Dose line for Today from the scheduled planner row. */
export function formatScheduledDose(row: ScheduledExercise): string {
  const sets = row.sets ?? 3;
  const hold = row.hold_s ?? parseHoldSeconds(row.reps);
  if (hold !== null && hold > 0) {
    return `${sets} × ${hold} s`;
  }
  const reps =
    typeof row.reps === "number"
      ? row.reps
      : parseInt(String(row.reps ?? "10").match(/^(\d+)/)?.[1] ?? "10", 10);
  const side = /\bper side\b/i.test(String(row.reps ?? "")) ? " per side" : "";
  return `${sets} × ${reps}${side}`;
}