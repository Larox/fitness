import type { TrainingSettings, SettingsChangeSummary } from "./types";
import { arraysEqualSorted } from "./bells";

function conditionsEqual(
  a: Record<string, boolean>,
  b: Record<string, boolean>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (Boolean(a[key]) !== Boolean(b[key])) {
      return false;
    }
  }
  return true;
}

function homeBellsEqual(a: TrainingSettings, b: TrainingSettings): boolean {
  return (
    a.noHomeBells === b.noHomeBells &&
    arraysEqualSorted(a.homeBellsKg, b.homeBellsKg)
  );
}

function removedBellKg(previous: readonly number[], next: readonly number[]): boolean {
  const nextSet = new Set(next);
  return previous.some((kg) => !nextSet.has(kg));
}

/**
 * Compare draft settings to saved settings.
 * Safety-relevant edits apply immediately and re-filter remaining sessions this week.
 */
export function summarizeSettingsChange(
  saved: TrainingSettings,
  draft: TrainingSettings,
): SettingsChangeSummary {
  let planAffectingChanges = 0;
  if (saved.daysPerWeek !== draft.daysPerWeek) {
    planAffectingChanges++;
  }
  if (saved.sessionMinutes !== draft.sessionMinutes) {
    planAffectingChanges++;
  }
  if (!homeBellsEqual(saved, draft)) {
    planAffectingChanges++;
  }
  if (!arraysEqualSorted(saved.gymBellsKg, draft.gymBellsKg)) {
    planAffectingChanges++;
  }
  if (!conditionsEqual(saved.conditionsEnabled, draft.conditionsEnabled)) {
    planAffectingChanges++;
  }

  let safetyRelevant = false;

  for (const [id, enabled] of Object.entries(draft.conditionsEnabled)) {
    const wasEnabled = Boolean(saved.conditionsEnabled[id]);
    if (!wasEnabled && enabled) {
      safetyRelevant = true;
    }
  }

  if (removedBellKg(saved.homeBellsKg, draft.homeBellsKg)) {
    safetyRelevant = true;
  }
  if (saved.noHomeBells && !draft.noHomeBells && draft.homeBellsKg.length > 0) {
    safetyRelevant = true;
  }
  if (removedBellKg(saved.gymBellsKg, draft.gymBellsKg)) {
    safetyRelevant = true;
  }

  return { planAffectingChanges, safetyRelevant };
}