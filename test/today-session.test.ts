/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAppConfig } from "../src/config/load";
import { importLibrary } from "../src/library/import";
import type { SnapshotRoutine } from "../src/library/types";
import { buildWeeklyPlan } from "../src/plan/build-week-plan";
import { renderThisWeekList } from "../src/plan/render-week";
import { defaultPlanSeed } from "../src/plan/seed";
import {
  effectiveRiskForActiveConditions,
  scheduledRowIsSafeForActiveConditions,
} from "../src/safety/filter";
import { createConditionLabelContext } from "../src/setup/condition-labels";
import {
  buildConditionOverridePatch,
  mergeConditionOverride,
} from "../src/setup/condition-overrides";
import { activeConditionIds, defaultTrainingSettings } from "../src/setup/defaults";
import type { PersistedAppState } from "../src/setup/types";
import { markSessionCompleted, unmarkSessionCompleted } from "../src/today/completion";
import { moderateCautionBanner } from "../src/today/moderate-caution";
import { deleteSessionLog, getSessionLog, saveSessionLog } from "../src/today/session-log-store";
import { defaultSetLogsForScheduled } from "../src/today/set-logs";
import { assertTodaySessionSafe } from "../src/today/today-safety";
import type { SessionLogRecord } from "../src/today/types";

const root = resolve(import.meta.dirname, "..");
const config = loadAppConfig(resolve(root, "config.example.json"));

function loadFixturePlan() {
  const snapshot = JSON.parse(
    readFileSync(resolve(root, "test/fixtures/weekly-plan.json"), "utf8"),
  ) as SnapshotRoutine[];
  const imported = importLibrary(snapshot, config, {});
  const settings = defaultTrainingSettings(config);
  const exercisesById = new Map(imported.exercises.map((row) => [row.id, row]));
  const routineNotesById = new Map(imported.routines.map((r) => [r.id, r.notes]));
  const labels = createConditionLabelContext(config, {});
  const built = buildWeeklyPlan({
    seed: "today-fixture-seed",
    settings,
    conditions: config.conditions,
    routines: imported.routines,
    exercisesById,
    routineNotesById,
    conditionLabel: labels.conditionLabel,
  });
  return {
    plan: built.plan,
    exercisesById,
    settings,
    active: activeConditionIds(settings),
  };
}

describe("Today session safety and caution", () => {
  it("never surfaces high-risk exercises on any planned session", () => {
    const { plan, exercisesById, active } = loadFixturePlan();
    for (const row of plan.rows) {
      const session = plan.sessions[row.sessionId];
      if (!session) {
        continue;
      }
      const report = assertTodaySessionSafe(session, exercisesById, active);
      expect(report.ok).toBe(true);
      expect(report.highRiskExerciseIds).toEqual([]);
      for (const sched of session.scheduled) {
        expect(scheduledRowIsSafeForActiveConditions(sched, active)).toBe(true);
        const exercise = exercisesById.get(sched.exerciseId);
        expect(exercise).toBeDefined();
        expect(effectiveRiskForActiveConditions(exercise!, active)).not.toBe("high");
      }
    }
  });

  it("shows moderate caution copy with renamed condition labels", () => {
    const { exercisesById, active } = loadFixturePlan();
    const concernA = config.conditions.find((c) => c.id === "concern_a");
    expect(concernA).toBeDefined();
    const overrides = mergeConditionOverride(
      {},
      concernA!.id,
      buildConditionOverridePatch(
        concernA!,
        { label: "Concern A display", notes: "" },
        "2026-11-16T12:00:00.000Z",
      ),
    );
    const labels = createConditionLabelContext(config, overrides);

    const moderate = [...exercisesById.values()].find(
      (exercise) => exercise.conditionRisks.concern_a === "moderate",
    );
    expect(moderate).toBeDefined();
    const banner = moderateCautionBanner(
      moderate!,
      config.conditions,
      active,
      labels.conditionLabel,
    );
    expect(banner?.labelLine).toContain("Concern A display");
  });
});

describe("Today logging and week completion", () => {
  it("persists session logs to IndexedDB and reloads them", async () => {
    const record: SessionLogRecord = {
      id: "train-0:2026-11-16T12:00:00.000Z",
      sessionId: "train-0",
      dayIndex: 0,
      completedAt: "2026-11-16T12:00:00.000Z",
      partial: false,
      location: "home",
      title: "Strength session",
      exercises: [
        {
          exerciseId: "ex_fixture_a",
          sourceExerciseId: "ex_fixture_a",
          done: true,
          hurt: false,
          bellKg: 2,
          sets: defaultSetLogsForScheduled({
            exerciseId: "ex_fixture_a",
            sourceExerciseId: "ex_fixture_a",
            reasons: [],
            cautions: [],
            reps: 10,
            sets: 3,
            hold_s: null,
            conditionRisks: {},
          }),
        },
      ],
    };
    await saveSessionLog(record);
    const loaded = await getSessionLog(record.id);
    expect(loaded).toEqual(record);
    await deleteSessionLog(record.id);
    expect(await getSessionLog(record.id)).toBeNull();
  });

  it("marks sessions done in the This week list", () => {
    const { plan } = loadFixturePlan();
    const row = plan.rows.find((r) => r.slotKind !== "rest");
    expect(row).toBeDefined();
    let state: PersistedAppState = {
      settings: defaultTrainingSettings(config),
      setupComplete: true,
      weekPlan: plan,
    };
    const before = renderThisWeekList(plan, state.completedSessions);
    expect(before).not.toContain("Done");

    state = markSessionCompleted(state, row!.sessionId, {
      completedAt: "2026-11-16T08:00:00.000Z",
      partial: false,
    });
    const after = renderThisWeekList(plan, state.completedSessions);
    expect(after).toContain("Done");
    expect(after).toContain("prow-done");

    state = unmarkSessionCompleted(state, row!.sessionId);
    expect(renderThisWeekList(plan, state.completedSessions)).not.toContain("prow-done");
  });

  it("builds a deterministic weekly plan seed for fixtures", () => {
    const settings = defaultTrainingSettings(config);
    expect(defaultPlanSeed(settings)).toContain("daysPerWeek");
  });
});