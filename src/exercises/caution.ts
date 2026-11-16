import type { ConditionConfig } from "../config/types";
import type { RiskLevel } from "../library/types";

export function genericModerateCautionLine(conditionLabel: string): string {
  return `${conditionLabel}: moderate risk. Go gently and stop if it hurts.`;
}

export function resolveModerateCautionLines(
  conditions: readonly ConditionConfig[],
  riskByCondition: Record<string, RiskLevel>,
  customByCondition: Record<string, string>,
): string[] {
  const lines: string[] = [];
  for (const condition of conditions) {
    if (riskByCondition[condition.id] !== "moderate") {
      continue;
    }
    const custom = customByCondition[condition.id]?.trim();
    lines.push(custom || genericModerateCautionLine(condition.label));
  }
  return lines;
}