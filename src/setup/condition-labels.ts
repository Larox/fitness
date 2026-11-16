import type { AppConfig, ConditionConfig } from "../config/types";
import type { ConditionOverrides } from "./condition-overrides";
import {
  conditionOverrideIsEdited,
  resolvedConditionLabel,
  resolvedConditionNotes,
} from "./condition-overrides";

export interface ConditionLabelContext {
  conditionLabel: (id: string) => string;
  conditionNotes: (id: string) => string;
  isEdited: (id: string) => boolean;
  configById: (id: string) => ConditionConfig | undefined;
}

export function createConditionLabelContext(
  config: AppConfig,
  overrides: ConditionOverrides = {},
): ConditionLabelContext {
  const byId = new Map(config.conditions.map((c) => [c.id, c]));
  return {
    conditionLabel(id: string): string {
      const condition = byId.get(id);
      if (!condition) {
        return id;
      }
      return resolvedConditionLabel(condition, overrides);
    },
    conditionNotes(id: string): string {
      const condition = byId.get(id);
      if (!condition) {
        return "";
      }
      return resolvedConditionNotes(condition, overrides);
    },
    isEdited(id: string): boolean {
      return conditionOverrideIsEdited(overrides, id);
    },
    configById(id: string): ConditionConfig | undefined {
      return byId.get(id);
    },
  };
}