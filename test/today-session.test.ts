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
import { defaultSetLogsForScheduled, normalizeExerciseSetLogs, scheduledUsesHold } from "../src/today/set-logs";
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

  it("persists edited per-set reps and hold values through IndexedDB", async () => {
    const repsSched = {
      exerciseId: "ex_fixture_a",
      sourceExerciseId: "ex_fixture_a",
      reasons: [],
      cautions: [],
      reps: 10,
      sets: 3,
      hold_s: null,
      conditionRisks: {},
    };
    const holdSched = {
      exerciseId: "ex_fixture_hold",
      sourceExerciseId: "ex_fixture_hold",
      reasons: [],
      cautions: [],
      reps: "45 s",
      sets: 2,
      hold_s: 45,
      conditionRisks: {},
    };
    const editedReps = defaultSetLogsForScheduled(repsSched).map((row, idx) =>
      idx === 1 ? { ...row, reps: 7 } : row,
    );
    const editedHold = defaultSetLogsForScheduled(holdSched).map((row, idx) =>
      idx === 0 ? { ...row, holdS: 52 } : row,
    );

    const record: SessionLogRecord = {
      id: "train-1:2026-11-16T14:00:00.000Z",
      sessionId: "train-1",
      dayIndex: 1,
      completedAt: "2026-11-16T14:00:00.000Z",
      partial: false,
      location: "gym",
      title: "Logged sets",
      exercises: [
        {
          exerciseId: repsSched.exerciseId,
          sourceExerciseId: repsSched.sourceExerciseId,
          done: true,
          hurt: false,
          bellKg: null,
          sets: editedReps,
        },
        {
          exerciseId: holdSched.exerciseId,
          sourceExerciseId: holdSched.sourceExerciseId,
          done: true,
          hurt: false,
          bellKg: null,
          sets: editedHold,
        },
      ],
    };
    await saveSessionLog(record);
    const loaded = await getSessionLog(record.id);
    expect(loaded?.exercises[0]?.sets[1]?.reps).toBe(7);
    expect(loaded?.exercises[1]?.sets[0]?.holdS).toBe(52);
    expect(scheduledUsesHold(holdSched)).toBe(true);
    await deleteSessionLog(record.id);
  });

  it("stores a skipped set on the session log", async () => {
    const sched = {
      exerciseId: "ex_fixture_b",
      sourceExerciseId: "ex_fixture_b",
      reasons: [],
      cautions: [],
      reps: 8,
      sets: 3,
      hold_s: null,
      conditionRisks: {},
    };
    const sets = defaultSetLogsForScheduled(sched).map((row, idx) =>
      idx === 2 ? { setIndex: row.setIndex, status: "skipped" as const, reps: row.reps } : row,
    );
    const record: SessionLogRecord = {
      id: "train-2:2026-11-16T15:00:00.000Z",
      sessionId: "train-2",
      dayIndex: 2,
      completedAt: "2026-11-16T15:00:00.000Z",
      partial: true,
      location: "home",
      title: "Partial",
      exercises: [
        {
          exerciseId: sched.exerciseId,
          sourceExerciseId: sched.sourceExerciseId,
          done: true,
          hurt: false,
          bellKg: null,
          sets,
        },
      ],
    };
    await saveSessionLog(record);
    const loaded = await getSessionLog(record.id);
    expect(loaded?.exercises[0]?.sets[2]?.status).toBe("skipped");
    await deleteSessionLog(record.id);
  });

  it("loads session logs saved before per-set details existed", async () => {
    const legacy = {
      id: "train-legacy:2026-11-15T10:00:00.000Z",
      sessionId: "train-legacy",
      dayIndex: 0,
      completedAt: "2026-11-15T10:00:00.000Z",
      partial: false,
      location: "home",
      title: "Legacy session",
      exercises: [
        {
          exerciseId: "ex_legacy",
          sourceExerciseId: "ex_legacy",
          done: true,
          hurt: false,
          bellKg: 4,
        },
      ],
    } as SessionLogRecord;
    await saveSessionLog(legacy);
    const loaded = await getSessionLog(legacy.id);
    expect(loaded?.exercises[0]?.exerciseId).toBe("ex_legacy");
    expect(loaded?.exercises[0]?.bellKg).toBe(4);
    const sched = {
      exerciseId: "ex_legacy",
      sourceExerciseId: "ex_legacy",
      reasons: [],
      cautions: [],
      reps: 10,
      sets: 3,
      hold_s: null,
      conditionRisks: {},
    };
    expect(normalizeExerciseSetLogs(loaded!.exercises[0]!, sched)).toHaveLength(3);
    await deleteSessionLog(legacy.id);
  });
});