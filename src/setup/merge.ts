import type { AppConfig } from "../config/types";
import type { PersistedAppState, TrainingSettings } from "./types";
import { defaultTrainingSettings } from "./defaults";

/** Reconcile stored settings with the current config (new conditions default on). */
export function mergePersistedState(
  stored: PersistedAppState | null,
  config: AppConfig,
): PersistedAppState {
  const base = stored ?? {
    setupComplete: false,
    settings: defaultTrainingSettings(config),
  };

  const settings: TrainingSettings = {
    ...base.settings,
    conditionsEnabled: { ...base.settings.conditionsEnabled },
  };

  for (const condition of config.conditions) {
    if (settings.conditionsEnabled[condition.id] === undefined) {
      settings.conditionsEnabled[condition.id] = true;
    }
  }

  for (const id of Object.keys(settings.conditionsEnabled)) {
    if (!config.conditions.some((c) => c.id === id)) {
      delete settings.conditionsEnabled[id];
    }
  }

  return {
    ...base,
    settings,
  };
}