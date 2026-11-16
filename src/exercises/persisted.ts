import type { DoseMode, UserExercise, HurtExclusion, DeletedExerciseRecord } from "./types";
import type { WeekSessionCandidate } from "../setup/types";
import type { RiskLevel } from "../library/types";
import { clampHoldSeconds, clampReps, clampSets } from "./dose";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRiskLevel(value: unknown): RiskLevel | undefined {
  if (value === "low" || value === "moderate" || value === "high") {
    return value;
  }
  return undefined;
}

export function sanitizeUserExercises(raw: unknown): UserExercise[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: UserExercise[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) {
      continue;
    }
    if (typeof item.id !== "string" || typeof item.routineId !== "string") {
      continue;
    }
    if (typeof item.name !== "string" || typeof item.createdAt !== "string") {
      continue;
    }
    const doseRaw = item.dose;
    if (!isPlainObject(doseRaw)) {
      continue;
    }
    const mode: DoseMode = doseRaw.mode === "hold" ? "hold" : "reps";
    const dose = {
      mode,
      sets: clampSets(typeof doseRaw.sets === "number" ? doseRaw.sets : 3),
      reps:
        mode === "reps" && typeof doseRaw.reps === "number"
          ? clampReps(doseRaw.reps)
          : undefined,
      holdS:
        mode === "hold" && typeof doseRaw.holdS === "number"
          ? clampHoldSeconds(doseRaw.holdS)
          : undefined,
      perSide: Boolean(doseRaw.perSide),
    };
    const riskChosen: Record<string, RiskLevel> = {};
    if (isPlainObject(item.riskChosen)) {
      for (const [key, value] of Object.entries(item.riskChosen)) {
        const level = parseRiskLevel(value);
        if (level) {
          riskChosen[key] = level;
        }
      }
    }
    const moderateCautions: Record<string, string> = {};
    if (isPlainObject(item.moderateCautions)) {
      for (const [key, value] of Object.entries(item.moderateCautions)) {
        if (typeof value === "string") {
          moderateCautions[key] = value;
        }
      }
    }
    const categories = Array.isArray(item.categories)
      ? item.categories.filter((c): c is string => typeof c === "string")
      : [];
    const cues = Array.isArray(item.cues)
      ? item.cues.filter((c): c is string => typeof c === "string")
      : [];
    const location =
      item.location === "home" || item.location === "gym" ? item.location : undefined;
    result.push({
      id: item.id,
      routineId: item.routineId,
      name: item.name,
      categories,
      equipment: typeof item.equipment === "string" ? item.equipment : "",
      cues,
      link: typeof item.link === "string" ? item.link : undefined,
      dose,
      riskChosen,
      moderateCautions,
      kettlebell: Boolean(item.kettlebell),
      location,
      createdAt: item.createdAt,
      newUntil: typeof item.newUntil === "string" ? item.newUntil : undefined,
    });
  }
  return result;
}

export function sanitizeHurtExclusions(raw: unknown): HurtExclusion[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rows: HurtExclusion[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) {
      continue;
    }
    if (typeof item.exerciseId !== "string" || typeof item.markedAt !== "string") {
      continue;
    }
    rows.push({
      exerciseId: item.exerciseId,
      markedAt: item.markedAt,
      from: typeof item.from === "string" ? item.from : "today",
    });
  }
  return rows;
}

export function sanitizeDeletedHistory(raw: unknown): DeletedExerciseRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rows: DeletedExerciseRecord[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) {
      continue;
    }
    if (typeof item.exerciseId !== "string" || typeof item.deletedAt !== "string") {
      continue;
    }
    if (!isPlainObject(item.snapshot)) {
      continue;
    }
    const exercises = sanitizeUserExercises([item.snapshot]);
    const snapshot = exercises[0];
    if (!snapshot) {
      continue;
    }
    rows.push({
      exerciseId: item.exerciseId,
      deletedAt: item.deletedAt,
      snapshot,
    });
  }
  return rows;
}

export function sanitizeWeekSessions(raw: unknown): WeekSessionCandidate[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rows: WeekSessionCandidate[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) {
      continue;
    }
    if (typeof item.sessionId !== "string" || !Array.isArray(item.exerciseIds)) {
      continue;
    }
    const exerciseIds = item.exerciseIds.filter((id): id is string => typeof id === "string");
    rows.push({ sessionId: item.sessionId, exerciseIds });
  }
  return rows;
}

export function renameUserExercise(
  exercises: readonly UserExercise[],
  exerciseId: string,
  newName: string,
): UserExercise[] {
  return exercises.map((row) =>
    row.id === exerciseId ? { ...row, name: newName.trim() } : row,
  );
}