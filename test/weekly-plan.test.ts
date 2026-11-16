import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAppConfig } from "../src/config/load";
import { deriveExerciseId } from "../src/library/exercise-id";
import { importLibrary } from "../src/library/import";
import type { ExerciseOverlayFile, SnapshotRoutine } from "../src/library/types";
import { buildWeeklyPlan } from "../src/plan/build-week-plan";
import { applyTrainingSettingsSave } from "../src/plan/apply-settings-save";
import { strengthDayIndices } from "../src/plan/week-layout";
import {
  effectiveRiskForActiveConditions,
  scheduledRowIsSafeForActiveConditions,
} from "../src/safety/filter";
import { defaultTrainingSettings, activeConditionIds } from "../src/setup/defaults";

const root = resolve(import.meta.dirname, "..");
const config = loadAppConfig(resolve(root, "config.example.json"));
const FIXTURE_SEED = "weekly-plan-fixture-seed";

function loadFixture(): ReturnType<typeof importLibrary> {
  const snapshot = JSON.parse(
    readFileSync(resolve(root, "test/fixtures/weekly-plan.json"), "utf8"),
  ) as SnapshotRoutine[];
  const highId = deriveExerciseId("plan_str_a", "Plan high hinge");
  const swapId = deriveExerciseId("plan_str_a", "Plan hinge swap");
  const overlay: ExerciseOverlayFile = {
    [highId]: { swap_to: swapId, kettlebell: true },
    [deriveExerciseId("plan_str_a", "Plan kettlebell hinge")]: { kettlebell: true },
  };
  return importLibrary(snapshot, config, overlay);
}

function baseSettings(overrides: Partial<ReturnType<typeof defaultTrainingSettings>> = {}) {
  return { ...defaultTrainingSettings(config), ...overrides };
}

describe("weekly plan builder", () => {
  const imported = loadFixture();
  const exercisesById = new Map(imported.exercises.map((row) => [row.id, row]));
  const routineNotesById = new Map(imported.routines.map((r) => [r.id, r.notes]));

  function build(
    settings = baseSettings(),
    seed = FIXTURE_SEED,
  ) {
    return buildWeeklyPlan({
      seed,
      settings,
      conditions: config.conditions,
      routines: imported.routines,
      exercisesById,
      routineNotesById,
    });
  }

  it("builds deterministic fixture plans for 4 days at 20 and 30 minutes", () => {
    const at20 = build(baseSettings({ sessionMinutes: 20 }), "pin-20");
    const at20Again = build(baseSettings({ sessionMinutes: 20 }), "pin-20");
    const at30 = build(baseSettings({ sessionMinutes: 30 }), "pin-30");

    expect(at20.plan).toEqual(at20Again.plan);
    expect(at20.plan.rows.filter((row) => row.slotKind !== "rest")).toHaveLength(4);
    expect(at30.plan.rows.filter((row) => row.slotKind !== "rest")).toHaveLength(4);

    const training20 = at20.plan.rows.filter((row) => row.slotKind !== "rest");
    const training30 = at30.plan.rows.filter((row) => row.slotKind !== "rest");
    training20.forEach((row) => expect(row.minutes).toBe(20));
    training30.forEach((row) => expect(row.minutes).toBe(30));
  });

  it("never places strength sessions back to back", () => {
    for (const days of [2, 3, 4, 5] as const) {
      const strengthDays = strengthDayIndices(days);
      for (let i = 1; i < strengthDays.length; i++) {
        expect(strengthDays[i]! - strengthDays[i - 1]!).toBeGreaterThan(1);
      }
    }
  });

  it("never schedules high risk for active conditions (swap or drop)", () => {
    const result = build();
    const active = activeConditionIds(baseSettings());
    for (const row of result.plan.rows) {
      if (row.slotKind === "rest") {
        continue;
      }
      const session = result.plan.sessions[row.sessionId]!;
      for (const scheduled of session.scheduled) {
        expect(scheduledRowIsSafeForActiveConditions(scheduled, active)).toBe(true);
        const exercise = exercisesById.get(scheduled.exerciseId);
        expect(exercise).toBeDefined();
        expect(effectiveRiskForActiveConditions(exercise!, active)).not.toBe("high");
      }
    }
    const highId = deriveExerciseId("plan_str_a", "Plan high hinge");
    for (const row of result.plan.rows) {
      if (!row.candidateExerciseIds.includes(highId)) {
        continue;
      }
      const session = result.plan.sessions[row.sessionId]!;
      expect(session.scheduled.every((scheduled) => scheduled.exerciseId !== highId)).toBe(
        true,
      );
      const handled =
        session.scheduled.some((scheduled) => scheduled.sourceExerciseId === highId) ||
        session.dropped.some((dropped) => dropped.sourceExerciseId === highId);
      expect(handled).toBe(true);
    }
  });

  it("marks moderate-risk sessions with a caution", () => {
    const result = build();
    const moderateRow = result.plan.rows.find((row) => row.hasCaution);
    expect(moderateRow).toBeDefined();
    const session = result.plan.sessions[moderateRow!.sessionId]!;
    expect(session.scheduled.some((row) => row.cautions.length > 0)).toBe(true);
  });

  it("drops exercises with unset risk (fail-closed)", () => {
    const missingId = deriveExerciseId("plan_str_b", "Plan missing risk");
    const result = build();
    const dropped = Object.values(result.plan.sessions).flatMap((session) => session.dropped);
    expect(dropped.some((row) => row.sourceExerciseId === missingId)).toBe(true);
    for (const session of Object.values(result.plan.sessions)) {
      expect(session.scheduled.every((row) => row.exerciseId !== missingId)).toBe(true);
    }
  });

  it("re-filters when a condition is turned on", () => {
    const highId = deriveExerciseId("plan_str_a", "Plan high hinge");
    const persisted = {
      setupComplete: true,
      settings: baseSettings({ conditionsEnabled: { concern_a: false, concern_b: true } }),
      weekPlan: build(
        baseSettings({ conditionsEnabled: { concern_a: false, concern_b: true } }),
      ).plan,
      weekSessionsRemaining: [{ sessionId: "train-2", exerciseIds: [highId] }],
    };
    const summary = { planAffectingChanges: 1, safetyRelevant: true };
    const updated = applyTrainingSettingsSave(
      persisted,
      baseSettings({ conditionsEnabled: { concern_a: true, concern_b: true } }),
      summary,
      {
        conditions: config.conditions,
        routines: imported.routines,
        exercisesById,
        excludedExerciseIds: new Set(),
        routineNotesById,
      },
    );
    const scheduledHigh = Object.values(updated.weekPlan!.sessions).some((session) =>
      session.scheduled.some((row) => row.exerciseId === highId),
    );
    expect(scheduledHigh).toBe(false);
  });
});