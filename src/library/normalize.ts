import type { ConditionConfig } from "../config/types";
import type { DurationMin, RiskLevel, SnapshotRoutine } from "./types";

const RISK_LEVELS: readonly RiskLevel[] = ["low", "moderate", "high"];

export function normalizeRisk(value: RiskLevel | undefined): RiskLevel {
  if (value === undefined || !RISK_LEVELS.includes(value)) {
    return "high";
  }
  return value;
}

/** Turn category string or list into a trimmed, non-empty string array. */
export function normalizeCategories(raw: string | string[] | undefined): string[] {
  if (raw === undefined) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.map((c) => c.trim()).filter(Boolean);
  }
  return raw
    .split(/[/,]/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Normalize duration_min: number, range string ("3-10"), plain number string, or null.
 */
export function normalizeDurationMin(
  raw: number | string | null | undefined,
): DurationMin | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "number") {
    return { display: String(raw), min: raw, max: raw };
  }
  const trimmed = raw.trim();
  const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(trimmed);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    return { display: trimmed, min, max };
  }
  const single = Number(trimmed);
  if (!Number.isNaN(single)) {
    return { display: trimmed, min: single, max: single };
  }
  return { display: trimmed, min: null, max: null };
}

export function normalizeCues(cues: string | string[] | null | undefined): string[] {
  if (cues === null || cues === undefined) {
    return [];
  }
  if (Array.isArray(cues)) {
    return cues.map((c) => String(c).trim()).filter(Boolean);
  }
  const s = String(cues).trim();
  return s ? [s] : [];
}

const maxRisk = (levels: RiskLevel[]): RiskLevel => {
  if (levels.includes("high")) return "high";
  if (levels.includes("moderate")) return "moderate";
  return "low";
};

export function aggregateRoutineRisks(
  conditions: ConditionConfig[],
  exerciseRisksByCondition: Record<string, RiskLevel[]>,
  readRoutineRisk: (libraryField: string) => RiskLevel | undefined,
): Record<string, RiskLevel> {
  const result: Record<string, RiskLevel> = {};

  for (const condition of conditions) {
    const routineLevel = normalizeRisk(readRoutineRisk(condition.libraryField));
    const exerciseLevels = exerciseRisksByCondition[condition.id] ?? [];
    result[condition.id] = maxRisk([routineLevel, ...exerciseLevels]);
  }

  return result;
}

/** Read a routine-level risk field when present on the snapshot object. */
export function readRoutineLibraryRisk(
  routine: SnapshotRoutine,
  libraryField: string,
): RiskLevel | undefined {
  const value = (routine as unknown as Record<string, unknown>)[libraryField];
  if (value === "low" || value === "moderate" || value === "high") {
    return value;
  }
  return undefined;
}