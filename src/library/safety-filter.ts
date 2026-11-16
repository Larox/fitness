import type { NormalizedExercise, RiskLevel } from "./types";

export interface SafetyConditions {
  hernia: boolean;
  genuValgo: boolean;
}

export type SafetyFilterItem =
  | {
      kind: "scheduled";
      exerciseId: string;
      caution?: string;
      maxReps?: number;
      maxHoldS?: number;
    }
  | {
      kind: "swapped";
      exerciseId: string;
      fromExerciseId: string;
      reason: string;
      caution?: string;
      maxReps?: number;
      maxHoldS?: number;
    }
  | {
      kind: "dropped";
      exerciseId: string;
      reasons: string[];
      suggestedSaferMove?: string;
    };

const RISK_RANK: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2 };

function maxRisk(levels: RiskLevel[]): RiskLevel {
  let best: RiskLevel = "low";
  for (const level of levels) {
    if (RISK_RANK[level] > RISK_RANK[best]) {
      best = level;
    }
  }
  return best;
}

/** Effective blocking risk for active conditions only (inactive conditions do not block). */
export function effectiveRisk(
  exercise: NormalizedExercise,
  conditions: SafetyConditions,
): RiskLevel {
  const active: RiskLevel[] = [];
  if (conditions.hernia) {
    active.push(exercise.herniaRisk);
  }
  if (conditions.genuValgo) {
    active.push(exercise.kneeRisk);
  }
  if (active.length === 0) {
    return "low";
  }
  return maxRisk(active);
}

export function extractSuggestedSaferMove(caution: string | undefined): string | undefined {
  if (!caution) {
    return undefined;
  }
  const swapColon = /\b[Ss]wap(?:\s+in)?\s*:\s*(.+?)(?:\.|$)/.exec(caution);
  if (swapColon) {
    return swapColon[1]!.trim();
  }
  const swapFor = /\bswap for\s+(.+?)(?:\.|$)/i.exec(caution);
  if (swapFor) {
    return swapFor[1]!.trim();
  }
  return undefined;
}

function highRiskReason(
  exercise: NormalizedExercise,
  conditions: SafetyConditions,
): string {
  const parts: string[] = [];
  if (conditions.hernia && exercise.herniaRisk === "high") {
    parts.push("high hernia risk");
  }
  if (conditions.genuValgo && exercise.kneeRisk === "high") {
    parts.push("high knee risk (genu valgo)");
  }
  if (parts.length === 0) {
    return "high risk for active conditions";
  }
  return parts.join(" and ");
}

function overlayCaps(exercise: NormalizedExercise): {
  maxReps?: number;
  maxHoldS?: number;
} {
  const overlay = exercise.overlay;
  if (!overlay) {
    return {};
  }
  return {
    maxReps: overlay.max_reps,
    maxHoldS: overlay.max_hold_s,
  };
}

function scheduleFrom(
  exercise: NormalizedExercise,
  conditions: SafetyConditions,
  swap?: { from: NormalizedExercise },
): Exclude<SafetyFilterItem, { kind: "dropped" }> {
  const risk = effectiveRisk(exercise, conditions);
  const caps = overlayCaps(exercise);
  const base = {
    exerciseId: exercise.id,
    ...caps,
    ...(risk === "moderate" && exercise.caution ? { caution: exercise.caution } : {}),
  };

  if (swap !== undefined) {
    return {
      kind: "swapped",
      fromExerciseId: swap.from.id,
      reason: `Swapped due to ${highRiskReason(swap.from, conditions)}`,
      ...base,
    };
  }

  return { kind: "scheduled", ...base };
}

function resolveHighRisk(
  exercise: NormalizedExercise,
  exercises: ReadonlyMap<string, NormalizedExercise>,
  conditions: SafetyConditions,
): SafetyFilterItem {
  const swapTargetId = exercise.overlay?.swap_to;
  if (swapTargetId !== undefined) {
    const target = exercises.get(swapTargetId);
    if (target && effectiveRisk(target, conditions) !== "high") {
      return scheduleFrom(target, conditions, { from: exercise });
    }
    const targetMissing = !target;
    const reasons = [
      targetMissing
        ? `High risk: overlay swap_to id not in library (${swapTargetId})`
        : `High risk: swap target ${swapTargetId} is also blocked for active conditions`,
    ];
    return {
      kind: "dropped",
      exerciseId: exercise.id,
      reasons,
      suggestedSaferMove: extractSuggestedSaferMove(exercise.caution),
    };
  }

  return {
    kind: "dropped",
    exerciseId: exercise.id,
    reasons: [`Not scheduled: ${highRiskReason(exercise, conditions)}`],
    suggestedSaferMove: extractSuggestedSaferMove(exercise.caution),
  };
}

/**
 * Deterministic safety filter for candidate exercises. Every changed item includes a reason.
 * Swaps are single-hop only (never chain through another high-risk exercise).
 */
export function filterExercisesForSafety(
  candidateIds: readonly string[],
  exercises: ReadonlyMap<string, NormalizedExercise>,
  conditions: SafetyConditions,
  excluded: ReadonlySet<string>,
): SafetyFilterItem[] {
  const results: SafetyFilterItem[] = [];

  for (const id of candidateIds) {
    if (excluded.has(id)) {
      results.push({
        kind: "dropped",
        exerciseId: id,
        reasons: ['Excluded ("this hurt")'],
      });
      continue;
    }

    const exercise = exercises.get(id);
    if (!exercise) {
      results.push({
        kind: "dropped",
        exerciseId: id,
        reasons: ["Exercise id not found in library"],
      });
      continue;
    }

    const risk = effectiveRisk(exercise, conditions);
    if (risk === "high") {
      results.push(resolveHighRisk(exercise, exercises, conditions));
      continue;
    }

    results.push(scheduleFrom(exercise, conditions));
  }

  return results;
}

/** Convenience helper for tests and planner wiring. */
export function exercisesById(
  exercises: readonly NormalizedExercise[],
): Map<string, NormalizedExercise> {
  return new Map(exercises.map((e) => [e.id, e]));
}