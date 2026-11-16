import type { AppConfig } from "../config/types";
import type { PersistedAppState, TrainingSettings } from "./types";
import {
  DEFAULT_DAYS_PER_WEEK,
  DEFAULT_SESSION_MINUTES,
  normalizeSessionMinutes,
} from "./schedule";

export function defaultTrainingSettings(config: AppConfig): TrainingSettings {
  const conditionsEnabled: Record<string, boolean> = {};
  for (const condition of config.conditions) {
    conditionsEnabled[condition.id] = true;
  }
  return {
    daysPerWeek: DEFAULT_DAYS_PER_WEEK,
    sessionMinutes: normalizeSessionMinutes(DEFAULT_SESSION_MINUTES),
    homeBellsKg: [...config.equipment.home.bellsKg],
    noHomeBells: false,
    gymBellsKg: [...config.equipment.gym.bellsKg],
    conditionsEnabled,
  };
}

export function initialPersistedState(config: AppConfig): PersistedAppState {
  return {
    settings: defaultTrainingSettings(config),
    setupComplete: false,
  };
}

export function activeConditionIds(settings: TrainingSettings): Set<string> {
  const active = new Set<string>();
  for (const [id, enabled] of Object.entries(settings.conditionsEnabled)) {
    if (enabled) {
      active.add(id);
    }
  }
  return active;
}