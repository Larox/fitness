import type { ConditionConfig } from "../config/types";
import { resolveModerateCautionLines } from "../exercises/caution";
import type { NormalizedExercise, RiskLevel } from "../library/types";
import type {
  DroppedExercise,
  SafetyFilterContext,
  SafetyFilterResult,
  ScheduledExercise,
} from "./types";

const RISK_ORDER: Record<RiskLevel, number> = {
  low: 0,
  moderate: 1,
  high: 2,
};

function maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

function activeHighConditions(
  exercise: NormalizedExercise,
  conditions: ConditionConfig[],
  activeConditionIds: ReadonlySet<string>,
): ConditionConfig[] {
  return conditions.filter((condition) => {
    if (!activeConditionIds.has(condition.id)) {
      return false;
    }
    const level = exercise.conditionRisks[condition.id] ?? "high";
    return level === "high";
  });
}

function activeModerateConditions(
  exercise: NormalizedExercise,
  conditions: ConditionConfig[],
  activeConditionIds: ReadonlySet<string>,
): ConditionConfig[] {
  return conditions.filter((condition) => {
    if (!activeConditionIds.has(condition.id)) {
      return false;
    }
    const level = exercise.conditionRisks[condition.id] ?? "high";
    return level === "moderate";
  });
}

function parseHoldSeconds(reps: string | number | null): number | null {
  if (reps === null || reps === undefined) {
    return null;
  }
  const text = String(reps);
  const match = /(\d+)\s*s(?:ec(?:ond)?s?)?/i.exec(text);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

function parseLeadingRepCount(reps: string | number | null): number | null {
  if (typeof reps === "number" && Number.isFinite(reps)) {
    return reps;
  }
  if (reps === null || reps === undefined) {
    return null;
  }
  const match = /^(\d+)/.exec(String(reps).trim());
  if (!match) {
    return null;
  }
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function clampDose(
  exercise: NormalizedExercise,
): Pick<ScheduledExercise, "reps" | "sets" | "hold_s"> {
  const overlay = exercise.overlay;
  let reps: string | number | null = exercise.reps;
  let sets: number | null = exercise.sets;
  let hold_s =
    overlay?.defaultDose?.hold_s ?? parseHoldSeconds(exercise.reps);

  if (overlay?.max_reps !== undefined) {
    const current = parseLeadingRepCount(reps);
    if (current !== null && current > overlay.max_reps) {
      if (typeof reps === "number") {
        reps = overlay.max_reps;
      } else if (typeof reps === "string") {
        reps = reps.replace(/^(\d+)/, String(overlay.max_reps));
      }
    }
  }

  if (overlay?.max_hold_s !== undefined) {
    if (hold_s === null) {
      hold_s = overlay.max_hold_s;
    } else if (hold_s > overlay.max_hold_s) {
      hold_s = overlay.max_hold_s;
      if (typeof reps === "string" && /\d+\s*s/i.test(reps)) {
        reps = reps.replace(/(\d+)\s*s/i, `${overlay.max_hold_s} s`);
      }
    }
  }

  if (overlay?.defaultDose?.sets !== undefined && sets === null) {
    sets = overlay.defaultDose.sets;
  }

  return { reps, sets, hold_s };
}

function buildScheduled(
  source: NormalizedExercise,
  scheduled: NormalizedExercise,
  reasons: string[],
  conditions: ConditionConfig[],
  activeConditionIds: ReadonlySet<string>,
): ScheduledExercise {
  const cautions: string[] = [];
  const moderate = activeModerateConditions(scheduled, conditions, activeConditionIds);
  if (moderate.length > 0) {
    if (scheduled.moderateCautionsByCondition) {
      cautions.push(
        ...resolveModerateCautionLines(
          moderate,
          scheduled.conditionRisks,
          scheduled.moderateCautionsByCondition,
        ),
      );
    } else if (scheduled.caution) {
      cautions.push(scheduled.caution);
    } else {
      cautions.push(
        ...resolveModerateCautionLines(
          moderate,
          scheduled.conditionRisks,
          {},
        ),
      );
    }
  }

  const dose = clampDose(scheduled);

  return {
    exerciseId: scheduled.id,
    sourceExerciseId: source.id,
    reasons,
    cautions,
    ...dose,
    conditionRisks: { ...scheduled.conditionRisks },
  };
}

function dropHighRisk(
  source: NormalizedExercise,
  blocking: ConditionConfig[],
  context: SafetyFilterContext,
): DroppedExercise {
  const labelList = blocking.map((c) => c.label).join(", ");
  const notes = context.routineNotesById?.get(source.routineId);
  return {
    sourceExerciseId: source.id,
    reasons: [
      `Not scheduled: high risk for active condition(s) (${labelList}).`,
    ],
    saferMoveSuggestion: notes?.trim() || undefined,
    conditionRisks: { ...source.conditionRisks },
  };
}

function resolveSwapTarget(
  source: NormalizedExercise,
  context: SafetyFilterContext,
): NormalizedExercise | undefined {
  const swapId = source.overlay?.swap_to;
  if (!swapId) {
    return undefined;
  }
  const target = context.exercisesById.get(swapId);
  if (!target) {
    return undefined;
  }
  if (context.excludedExerciseIds.has(target.id)) {
    return undefined;
  }
  if (activeHighConditions(target, context.conditions, context.activeConditionIds).length > 0) {
    return undefined;
  }
  return target;
}

/**
 * Deterministic safety filter: given candidate exercises and the user's conditions,
 * returns what may be scheduled (with reasons) and what was dropped.
 */
export function filterExercisesForScheduling(
  candidates: NormalizedExercise[],
  context: SafetyFilterContext,
): SafetyFilterResult {
  const scheduled: ScheduledExercise[] = [];
  const dropped: DroppedExercise[] = [];

  for (const candidate of candidates) {
    if (context.excludedExerciseIds.has(candidate.id)) {
      dropped.push({
        sourceExerciseId: candidate.id,
        reasons: ["Not scheduled: excluded because it hurt."],
        conditionRisks: { ...candidate.conditionRisks },
      });
      continue;
    }

    const blocking = activeHighConditions(
      candidate,
      context.conditions,
      context.activeConditionIds,
    );

    if (blocking.length === 0) {
      const reasons: string[] = [];
      const moderate = activeModerateConditions(
        candidate,
        context.conditions,
        context.activeConditionIds,
      );
      if (moderate.length > 0) {
        reasons.push(
          `Scheduled with caution: moderate risk for ${moderate.map((c) => c.label).join(", ")}.`,
        );
      } else {
        reasons.push("Scheduled.");
      }
      scheduled.push(
        buildScheduled(candidate, candidate, reasons, context.conditions, context.activeConditionIds),
      );
      continue;
    }

    const swapTarget = resolveSwapTarget(candidate, context);
    if (swapTarget) {
      const labelList = blocking.map((c) => c.label).join(", ");
      scheduled.push(
        buildScheduled(
          candidate,
          swapTarget,
          [
            `Swapped from high-risk ${candidate.name}: ${labelList}.`,
            `Performing ${swapTarget.name} instead (overlay swap_to).`,
          ],
          context.conditions,
          context.activeConditionIds,
        ),
      );
      continue;
    }

    dropped.push(dropHighRisk(candidate, blocking, context));
  }

  return { scheduled, dropped };
}

/** True when no active condition has high risk on this scheduled row. */
export function scheduledRowIsSafeForActiveConditions(
  row: ScheduledExercise,
  activeConditionIds: ReadonlySet<string>,
): boolean {
  for (const [conditionId, level] of Object.entries(row.conditionRisks)) {
    if (!activeConditionIds.has(conditionId)) {
      continue;
    }
    if (level === "high") {
      return false;
    }
  }
  return true;
}

/** Highest risk across active conditions (for assertions on performed exercise). */
export function effectiveRiskForActiveConditions(
  exercise: NormalizedExercise,
  activeConditionIds: ReadonlySet<string>,
): RiskLevel {
  let level: RiskLevel = "low";
  for (const [conditionId, risk] of Object.entries(exercise.conditionRisks)) {
    if (!activeConditionIds.has(conditionId)) {
      continue;
    }
    level = maxRiskLevel(level, risk);
  }
  return level;
}