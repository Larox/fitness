import type { ConditionConfig } from "../config/types";
import type { RiskLevel } from "./types";

export function readLibraryRisk(
  record: Record<string, unknown>,
  libraryField: string,
): RiskLevel | undefined {
  const value = record[libraryField];
  if (value === "low" || value === "moderate" || value === "high") {
    return value;
  }
  return undefined;
}

export function emptyConditionRiskMap(
  conditions: ConditionConfig[],
): Record<string, RiskLevel> {
  const map: Record<string, RiskLevel> = {};
  for (const condition of conditions) {
    map[condition.id] = "high";
  }
  return map;
}