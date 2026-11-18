import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAppConfig } from "../src/config/load";
import { importLibrary } from "../src/library/import";
import type { SnapshotRoutine } from "../src/library/types";
import { ensureWeekPlan } from "../src/plan/ensure-week-plan";
import { createConditionLabelContext } from "../src/setup/condition-labels";
import { activeConditionIds, initialPersistedState } from "../src/setup/defaults";
import { mergeExercisesById } from "../src/exercises/planning";
import {
  resolveTodayView,
  isPlannedTrainingDay,
} from "../src/today/resolve-today-session";
import { assertTodaySessionSafe } from "../src/today/today-safety";
import { rowForDay } from "../src/today/resolve-session";

const root = resolve(import.meta.dirname, "..");
const config = loadAppConfig(resolve(root, "config.example.json"));

const snapshot = JSON.parse(
  readFileSync(resolve(root, "data/sample-library.json"), "utf8"),
) as SnapshotRoutine[];

function freshStateWithPlan() {
  const imported = importLibrary(snapshot, config, {});
  expect(imported.errors).toEqual([]);
  const persisted = initialPersistedState(config);
  const exercisesById = mergeExercisesById(imported.exercises, [], config.conditions);
  const routineNotesById = new Map(imported.routines.map((r) => [r.id, r.notes]));
  const labels = createConditionLabelContext(config, {});
  const withPlan = ensureWeekPlan(persisted, {
    conditions: config.conditions,
    routines: imported.routines,
    exercisesById,
    excludedExerciseIds: new Set(),
    routineNotesById,
    conditionLabel: labels.conditionLabel,
  });
  expect(withPlan.weekPlan).toBeDefined();
  expect(withPlan.setupComplete).toBe(true);
  return {
    plan: withPlan.weekPlan!,
    exercisesById,
    active: activeConditionIds(withPlan.settings),
  };
}

describe("first open: ready Today from sample library", () => {
  it("builds a week plan from fresh storage and defaults", () => {
    const { plan } = freshStateWithPlan();
    expect(plan.rows.filter((row) => row.slotKind !== "rest").length).toBe(4);
    expect(Object.keys(plan.sessions).length).toBeGreaterThan(0);
  });

  it("never leaves Today empty on any weekday", () => {
    const { plan, exercisesById, active } = freshStateWithPlan();
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const view = resolveTodayView(plan, dayIndex, {});
      expect(view, `dayIndex ${dayIndex}`).not.toBeNull();
      expect(view!.session.scheduled.length).toBeGreaterThan(0);
      const report = assertTodaySessionSafe(view!.session, exercisesById, active);
      expect(report.ok).toBe(true);
      const calendarRow = rowForDay(plan, dayIndex);
      if (isPlannedTrainingDay(calendarRow)) {
        expect(view!.mode).toBe("scheduled");
      } else {
        expect(view!.mode).toBe("preview");
      }
    }
  });

  it("picks a concrete next session on rest days", () => {
    const { plan } = freshStateWithPlan();
    const restDay = plan.rows.find((row) => row.slotKind === "rest");
    expect(restDay).toBeDefined();
    const view = resolveTodayView(plan, restDay!.dayIndex, {});
    expect(view?.mode).toBe("preview");
    expect(view?.row.slotKind).not.toBe("rest");
  });
});