import { summarizeSettingsChange } from "../setup/changes";
import type { PersistedAppState } from "../setup/types";
import { applyTrainingSettingsSave, type PlanBuildContext } from "./apply-settings-save";

/** Build and persist a week plan when none exists yet (first open defaults). */
export function ensureWeekPlan(
  persisted: PersistedAppState,
  context: PlanBuildContext,
): PersistedAppState {
  if (persisted.weekPlan) {
    return persisted;
  }
  const settings = persisted.settings;
  const summary = summarizeSettingsChange(settings, settings);
  const withPlan = applyTrainingSettingsSave(persisted, settings, summary, context);
  return {
    ...withPlan,
    setupComplete: true,
  };
}