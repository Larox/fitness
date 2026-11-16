import type { ConditionConfig } from "../config/types";
import type { RiskLevel } from "../library/types";
import type { UserExercise } from "./types";

/** Effective level for scheduling: unset user choice reads as high (fail-closed). */
export function effectiveRiskLevel(
  exercise: Pick<UserExercise, "riskChosen">,
  conditionId: string,
): RiskLevel {
  const chosen = exercise.riskChosen[conditionId];
  if (chosen === "low" || chosen === "moderate" || chosen === "high") {
    return chosen;
  }
  return "high";
}

export function isRiskExplicitlySet(
  exercise: Pick<UserExercise, "riskChosen">,
  conditionId: string,
): boolean {
  const chosen = exercise.riskChosen[conditionId];
  return chosen === "low" || chosen === "moderate" || chosen === "high";
}

export function countRisksSet(
  exercise: Pick<UserExercise, "riskChosen">,
  conditions: readonly ConditionConfig[],
): number {
  return conditions.filter((c) => isRiskExplicitlySet(exercise, c.id)).length;
}

export function unsetRiskCount(
  exercise: Pick<UserExercise, "riskChosen">,
  conditions: readonly ConditionConfig[],
): number {
  return conditions.length - countRisksSet(exercise, conditions);
}

export function hasAnyUnsetRisk(
  exercise: Pick<UserExercise, "riskChosen">,
  conditions: readonly ConditionConfig[],
): boolean {
  return conditions.some((c) => !isRiskExplicitlySet(exercise, c.id));
}

/**
 * User exercises with any unset condition risk are never planned (badge + scheduling).
 * Explicit high is planned only in the sense the filter can reason about it; unset is stricter.
 */
export function userExerciseNeverPlanned(
  exercise: Pick<UserExercise, "riskChosen">,
  conditions: readonly ConditionConfig[],
): boolean {
  return hasAnyUnsetRisk(exercise, conditions);
}

export function buildConditionRiskMapForFilter(
  exercise: Pick<UserExercise, "riskChosen">,
  conditions: readonly ConditionConfig[],
): Record<string, RiskLevel> {
  const map: Record<string, RiskLevel> = {};
  for (const condition of conditions) {
    map[condition.id] = effectiveRiskLevel(exercise, condition.id);
  }
  return map;
}