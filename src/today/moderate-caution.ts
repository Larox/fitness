import { genericModerateCautionLine } from "../exercises/caution";
import type { ConditionConfig } from "../config/types";
import type { NormalizedExercise, RiskLevel } from "../library/types";

export interface ModerateCautionBanner {
  labelLine: string;
  body: string;
}

function stripLabelPrefix(text: string, label: string): string {
  const prefix = `${label}:`;
  const trimmed = text.trimStart();
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return trimmed.slice(prefix.length).trimStart();
  }
  return trimmed;
}

function activeModerateConditionIds(
  exercise: NormalizedExercise,
  activeConditionIds: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  for (const [conditionId, level] of Object.entries(exercise.conditionRisks)) {
    if (!activeConditionIds.has(conditionId)) {
      continue;
    }
    if (level === "moderate") {
      ids.push(conditionId);
    }
  }
  return ids;
}

export function moderateCautionBanner(
  exercise: NormalizedExercise,
  _conditions: readonly ConditionConfig[],
  activeConditionIds: ReadonlySet<string>,
  conditionLabel: (id: string) => string,
): ModerateCautionBanner | null {
  const moderateIds = activeModerateConditionIds(exercise, activeConditionIds);
  if (moderateIds.length === 0) {
    return null;
  }
  const labels = moderateIds.map((id) => conditionLabel(id));
  const labelLine =
    labels.length === 1
      ? `${labels[0]}: moderate risk`
      : `${labels.join(" and ")}: moderate risk`;

  const custom = exercise.moderateCautionsByCondition;
  let body = "";
  if (custom) {
    const parts: string[] = [];
    for (const id of moderateIds) {
      const line = custom[id]?.trim();
      if (line) {
        parts.push(stripLabelPrefix(line, conditionLabel(id)));
      }
    }
    if (parts.length > 0) {
      body = parts.join(" ");
    }
  }
  if (!body && exercise.caution?.trim()) {
    body = stripLabelPrefix(exercise.caution, labels[0] ?? "");
  }
  if (!body) {
    body = genericModerateCautionLine(labels[0]!).replace(/^[^:]+:\s*/, "");
    if (labels.length > 1) {
      body = "Go gently and stop if it hurts.";
    }
  }
  return { labelLine, body };
}

export function scheduledExerciseIsHighForActive(
  conditionRisks: Record<string, RiskLevel>,
  activeConditionIds: ReadonlySet<string>,
): boolean {
  for (const [conditionId, level] of Object.entries(conditionRisks)) {
    if (!activeConditionIds.has(conditionId)) {
      continue;
    }
    if (level === "high") {
      return true;
    }
  }
  return false;
}