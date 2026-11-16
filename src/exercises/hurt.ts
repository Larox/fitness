import type { HurtExclusion } from "./types";
import type { WeekSessionCandidate } from "../setup/types";

export interface HurtRestoreUndo {
  exerciseId: string;
  previous: HurtExclusion;
}

export interface HurtListDisplayRow {
  exerciseId: string;
  markedAt: string;
  from: string;
  showUndoSuccess: boolean;
}

/** Rows for the hurt list UI: active exclusions plus a pending restore slot. */
export function buildHurtListDisplayRows(
  exclusions: readonly HurtExclusion[],
  pending: HurtRestoreUndo | undefined,
): HurtListDisplayRow[] {
  const rows: HurtListDisplayRow[] = exclusions.map((row) => ({
    exerciseId: row.exerciseId,
    markedAt: row.markedAt,
    from: row.from,
    showUndoSuccess: false,
  }));
  if (pending && !exclusions.some((row) => row.exerciseId === pending.exerciseId)) {
    rows.push({
      exerciseId: pending.exerciseId,
      markedAt: pending.previous.markedAt,
      from: pending.previous.from,
      showUndoSuccess: true,
    });
  }
  rows.sort((a, b) => a.markedAt.localeCompare(b.markedAt));
  return rows;
}

export function restoreHurtExercise(
  exclusions: readonly HurtExclusion[],
  exerciseId: string,
): { exclusions: HurtExclusion[]; restored: HurtExclusion | null } {
  const target = exclusions.find((row) => row.exerciseId === exerciseId);
  if (!target) {
    return { exclusions: [...exclusions], restored: null };
  }
  return {
    exclusions: exclusions.filter((row) => row.exerciseId !== exerciseId),
    restored: target,
  };
}

export function undoHurtRestore(
  exclusions: readonly HurtExclusion[],
  undo: HurtRestoreUndo,
): HurtExclusion[] {
  if (exclusions.some((row) => row.exerciseId === undo.exerciseId)) {
    return [...exclusions];
  }
  return [...exclusions, undo.previous];
}

/**
 * Restore lifts the hurt flag for future plans only; current-week sessions stay unchanged.
 */
export function restoreDoesNotChangeCurrentWeek(
  before: readonly WeekSessionCandidate[],
  after: readonly WeekSessionCandidate[],
): boolean {
  if (before.length !== after.length) {
    return false;
  }
  for (let i = 0; i < before.length; i++) {
    const a = before[i]!;
    const b = after[i]!;
    if (a.sessionId !== b.sessionId) {
      return false;
    }
    if (a.exerciseIds.length !== b.exerciseIds.length) {
      return false;
    }
    for (let j = 0; j < a.exerciseIds.length; j++) {
      if (a.exerciseIds[j] !== b.exerciseIds[j]) {
        return false;
      }
    }
  }
  return true;
}

export function formatMarkedDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}