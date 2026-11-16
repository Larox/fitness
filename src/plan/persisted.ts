import type { WeekPlan, WeekPlanRow, WeekPlanSessionResult } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSessionResult(raw: unknown): WeekPlanSessionResult | undefined {
  if (!isPlainObject(raw)) {
    return undefined;
  }
  if (!Array.isArray(raw.scheduled) || !Array.isArray(raw.dropped)) {
    return undefined;
  }
  return { scheduled: raw.scheduled, dropped: raw.dropped } as WeekPlanSessionResult;
}

function sanitizeWeekPlanRow(raw: unknown): WeekPlanRow | undefined {
  if (!isPlainObject(raw)) {
    return undefined;
  }
  if (
    typeof raw.dayIndex !== "number" ||
    typeof raw.dayLabel !== "string" ||
    typeof raw.slotKind !== "string" ||
    typeof raw.sessionId !== "string" ||
    typeof raw.title !== "string" ||
    typeof raw.minutes !== "number" ||
    typeof raw.hasCaution !== "boolean" ||
    !Array.isArray(raw.candidateExerciseIds)
  ) {
    return undefined;
  }
  const location =
    raw.location === "home" || raw.location === "gym" ? raw.location : null;
  const candidateExerciseIds = raw.candidateExerciseIds.filter(
    (id): id is string => typeof id === "string",
  );
  return {
    dayIndex: raw.dayIndex,
    dayLabel: raw.dayLabel,
    slotKind: raw.slotKind as WeekPlanRow["slotKind"],
    sessionId: raw.sessionId,
    title: raw.title,
    location,
    minutes: raw.minutes,
    hasCaution: raw.hasCaution,
    candidateExerciseIds,
  };
}

export function sanitizeWeekPlan(raw: unknown): WeekPlan | undefined {
  if (!isPlainObject(raw)) {
    return undefined;
  }
  if (typeof raw.seed !== "string" || !Array.isArray(raw.rows)) {
    return undefined;
  }
  const rows: WeekPlanRow[] = [];
  for (const row of raw.rows) {
    const parsed = sanitizeWeekPlanRow(row);
    if (parsed) {
      rows.push(parsed);
    }
  }
  const sessions: Record<string, WeekPlanSessionResult> = {};
  if (isPlainObject(raw.sessions)) {
    for (const [key, value] of Object.entries(raw.sessions)) {
      const parsed = sanitizeSessionResult(value);
      if (parsed) {
        sessions[key] = parsed;
      }
    }
  }
  if (rows.length === 0) {
    return undefined;
  }
  return { seed: raw.seed, rows, sessions };
}