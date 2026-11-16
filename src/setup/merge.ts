import type { AppConfig } from "../config/types";
import {
  sanitizeDeletedHistory,
  sanitizeHurtExclusions,
  sanitizePendingHurtRestore,
  sanitizeUserExercises,
  sanitizeWeekSessions,
} from "../exercises/persisted";
import { sanitizeWeekPlan } from "../plan/persisted";
import type { PersistedAppState, TrainingSettings } from "./types";
import { pruneConditionOverrides, sanitizeConditionOverrides } from "./condition-overrides";
import { defaultTrainingSettings } from "./defaults";
import {
  normalizeDaysPerWeek,
  normalizeSessionMinutes,
} from "./schedule";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeBellList(
  value: unknown,
  available: readonly number[],
  fallback: readonly number[],
): number[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const allowed = new Set(available);
  const filtered = value.filter(
    (n): n is number =>
      typeof n === "number" && Number.isFinite(n) && allowed.has(n),
  );
  return [...new Set(filtered)].sort((a, b) => a - b);
}

function pickDisclaimerFields(
  stored: Record<string, unknown>,
): Pick<PersistedAppState, "disclaimerAcknowledgedVersion" | "disclaimerAckAt"> {
  const fields: Pick<
    PersistedAppState,
    "disclaimerAcknowledgedVersion" | "disclaimerAckAt"
  > = {};
  if (
    typeof stored.disclaimerAcknowledgedVersion === "number" &&
    Number.isFinite(stored.disclaimerAcknowledgedVersion)
  ) {
    fields.disclaimerAcknowledgedVersion = stored.disclaimerAcknowledgedVersion;
  }
  if (typeof stored.disclaimerAckAt === "string") {
    fields.disclaimerAckAt = stored.disclaimerAckAt;
  }
  return fields;
}

/** Coerce unknown persisted settings into safe training settings. */
export function sanitizeTrainingSettings(
  raw: unknown,
  config: AppConfig,
): TrainingSettings {
  const defaults = defaultTrainingSettings(config);
  if (!isPlainObject(raw)) {
    return defaults;
  }

  const daysPerWeek =
    typeof raw.daysPerWeek === "number"
      ? normalizeDaysPerWeek(raw.daysPerWeek)
      : defaults.daysPerWeek;
  const sessionMinutes =
    typeof raw.sessionMinutes === "number"
      ? normalizeSessionMinutes(raw.sessionMinutes)
      : defaults.sessionMinutes;

  const noHomeBells =
    typeof raw.noHomeBells === "boolean" ? raw.noHomeBells : defaults.noHomeBells;
  let homeBellsKg = sanitizeBellList(
    raw.homeBellsKg,
    config.equipment.availableBellsKg,
    defaults.homeBellsKg,
  );
  if (noHomeBells) {
    homeBellsKg = [];
  }

  const gymBellsKg = sanitizeBellList(
    raw.gymBellsKg,
    config.equipment.availableBellsKg,
    defaults.gymBellsKg,
  );

  const conditionsEnabled: Record<string, boolean> = {};
  for (const condition of config.conditions) {
    conditionsEnabled[condition.id] = true;
  }
  if (isPlainObject(raw.conditionsEnabled)) {
    for (const condition of config.conditions) {
      const stored = raw.conditionsEnabled[condition.id];
      if (typeof stored === "boolean") {
        conditionsEnabled[condition.id] = stored;
      }
    }
  }

  return {
    daysPerWeek,
    sessionMinutes,
    homeBellsKg,
    noHomeBells,
    gymBellsKg,
    conditionsEnabled,
  };
}

/** Reconcile stored settings with the current config (new conditions default on). */
export function mergePersistedState(
  stored: PersistedAppState | null,
  config: AppConfig,
): PersistedAppState {
  if (!stored || !isPlainObject(stored) || !isPlainObject(stored.settings)) {
    return {
      setupComplete: false,
      settings: defaultTrainingSettings(config),
      userExercises: [],
      hurtExclusions: [],
      deletedExerciseHistory: [],
      weekSessionsRemaining: [],
      weekPlan: undefined,
      ...(stored && isPlainObject(stored) ? pickDisclaimerFields(stored) : {}),
    };
  }

  const conditionOverrides = pruneConditionOverrides(
    sanitizeConditionOverrides(stored.conditionOverrides, config),
    config,
  );

  return {
    ...pickDisclaimerFields(stored),
    setupComplete: stored.setupComplete === true,
    settings: sanitizeTrainingSettings(stored.settings, config),
    conditionOverrides:
      Object.keys(conditionOverrides).length > 0 ? conditionOverrides : undefined,
    userExercises: sanitizeUserExercises(stored.userExercises),
    hurtExclusions: sanitizeHurtExclusions(stored.hurtExclusions),
    pendingHurtRestore: sanitizePendingHurtRestore(stored.pendingHurtRestore),
    deletedExerciseHistory: sanitizeDeletedHistory(stored.deletedExerciseHistory),
    weekSessionsRemaining: sanitizeWeekSessions(stored.weekSessionsRemaining),
    weekPlan: sanitizeWeekPlan(stored.weekPlan),
  };
}