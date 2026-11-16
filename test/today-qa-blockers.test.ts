/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadAppConfig } from "../src/config/load";
import { importLibrary } from "../src/library/import";
import type { SnapshotRoutine } from "../src/library/types";
import { buildWeeklyPlan } from "../src/plan/build-week-plan";
import { defaultPlanSeed } from "../src/plan/seed";
import { renderThisWeekList } from "../src/plan/render-week";
import { acknowledgeDisclaimer } from "../src/setup/disclaimer";
import { defaultTrainingSettings } from "../src/setup/defaults";
import { createConditionLabelContext } from "../src/setup/condition-labels";
import { mountSetupScreen } from "../src/setup/setup-screen";
import { createMemoryStorage } from "../src/setup/storage";
import type { PersistedAppState } from "../src/setup/types";
import { isSessionCompleted, markSessionCompleted } from "../src/today/completion";
import {
  deleteSessionDraft,
  getSessionDraft,
  saveSessionDraft,
} from "../src/today/session-draft-store";
import {
  deleteSessionLog,
  getLatestSessionLogForSession,
  getSessionLog,
  saveSessionLog,
} from "../src/today/session-log-store";
import { resolveSavedSessionLogId } from "../src/today/session-restore";
import { defaultSetLogsForScheduled } from "../src/today/set-logs";
import { weekStartKey } from "../src/today/weekday";
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
    seed: defaultPlanSeed(settings),
    settings,
    conditions: config.conditions,
    routines: imported.routines,
    exercisesById,
    routineNotesById,
    conditionLabel: labels.conditionLabel,
  });
  return { plan: built.plan, settings, exercisesById: imported.exercises };
}

function ackedState(settings = defaultTrainingSettings(config)): PersistedAppState {
  return acknowledgeDisclaimer({ setupComplete: false, settings }, config, new Date());
}

describe("QA blockers: navigation and completions", () => {
  let rootEl: HTMLDivElement;
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    document.body.innerHTML = "";
    rootEl = document.createElement("div");
    rootEl.id = "app";
    document.body.appendChild(rootEl);
    storage = createMemoryStorage();
  });

  it("leaves only Today mounted after Start training", () => {
    const { settings } = loadFixturePlan();
    const base = ackedState(settings);
    storage.save(base);
    let todayMounted = false;
    mountSetupScreen({
      config,
      storage,
      root: rootEl,
      onSaved: () => {
        rootEl.className = "today-shell";
        rootEl.innerHTML = "<h1>Today mock</h1>";
        document.getElementById("setup-bar")?.remove();
        todayMounted = true;
      },
      getPlanContext: () => ({
        conditions: config.conditions,
        routines: [],
        exercisesById: new Map(),
        excludedExerciseIds: new Set(),
        routineNotesById: new Map(),
        conditionLabel: (id: string) => id,
      }),
    });
    document.querySelector<HTMLButtonElement>('[data-act="save"]')!.click();
    expect(todayMounted).toBe(true);
    expect(rootEl.className).toBe("today-shell");
    expect(document.getElementById("setup-bar")).toBeNull();
    expect(rootEl.textContent).toContain("Today mock");
  });

  it("leaves only Today mounted after Settings save when onSaved navigates away", () => {
    const { plan, settings } = loadFixturePlan();
    const complete = { ...ackedState(settings), setupComplete: true, weekPlan: plan };
    storage.save(complete);
    let navigated = false;
    mountSetupScreen({
      config,
      storage,
      root: rootEl,
      onSaved: () => {
        rootEl.className = "today-shell";
        rootEl.innerHTML = "<h1>Back on Today</h1>";
        document.getElementById("setup-bar")?.remove();
        navigated = true;
      },
      getPlanContext: () => ({
        conditions: config.conditions,
        routines: [],
        exercisesById: new Map(),
        excludedExerciseIds: new Set(),
        routineNotesById: new Map(),
        conditionLabel: (id: string) => id,
      }),
    });
    rootEl.querySelector<HTMLButtonElement>('[data-act="mins"][data-v="45"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-act="save"]')!.click();
    expect(navigated).toBe(true);
    expect(rootEl.className).toBe("today-shell");
    expect(document.getElementById("setup-bar")).toBeNull();
  });

  it("treats a session done last week as not done this week", () => {
    const { plan } = loadFixturePlan();
    const row = plan.rows.find((r) => r.slotKind !== "rest");
    expect(row).toBeDefined();
    const lastWeek = new Date("2026-11-09T10:00:00.000Z");
    const thisWeek = new Date("2026-11-16T10:00:00.000Z");
    const lastKey = weekStartKey(lastWeek);
    const thisKey = weekStartKey(thisWeek);
    expect(lastKey).not.toBe(thisKey);

    let state: PersistedAppState = {
      settings: defaultTrainingSettings(config),
      setupComplete: true,
      weekPlan: plan,
    };
    state = markSessionCompleted(state, row!.sessionId, lastKey, {
      completedAt: lastWeek.toISOString(),
      partial: false,
    });
    expect(isSessionCompleted(state.completedSessions, row!.sessionId, thisKey)).toBe(false);
    const html = renderThisWeekList(plan, state.completedSessions, thisKey);
    expect(html).not.toContain("prow-done");
  });

  it("still reads legacy completion keys from the same calendar week", () => {
    const { plan } = loadFixturePlan();
    const row = plan.rows.find((r) => r.slotKind !== "rest");
    const when = new Date("2026-11-16T08:00:00.000Z");
    const weekKey = weekStartKey(when);
    const state: PersistedAppState = {
      settings: defaultTrainingSettings(config),
      setupComplete: true,
      weekPlan: plan,
      completedSessions: {
        [row!.sessionId]: { completedAt: when.toISOString(), partial: false },
      },
    };
    expect(isSessionCompleted(state.completedSessions, row!.sessionId, weekKey)).toBe(true);
  });
});

describe("QA blockers: draft and session logs", () => {
  it("persists and reloads an in-progress session draft", async () => {
    const week = weekStartKey(new Date("2026-11-16T12:00:00.000Z"));
    const sessionId = "train-0";
    const sched = {
      exerciseId: "ex_fixture_a",
      sourceExerciseId: "ex_fixture_a",
      reasons: [],
      cautions: [],
      reps: 10,
      sets: 3,
      hold_s: null,
      conditionRisks: {},
    };
    const record = {
      id: `${week}:${sessionId}`,
      sessionId,
      weekStart: week,
      dayIndex: 0,
      updatedAt: "2026-11-16T12:00:00.000Z",
      cards: {
        ex_fixture_a: {
          expanded: true,
          done: true,
          hurt: false,
          bellKg: 2,
          setLogs: defaultSetLogsForScheduled(sched),
        },
      },
    };
    await saveSessionDraft(record);
    const loaded = await getSessionDraft(week, sessionId);
    expect(loaded?.cards.ex_fixture_a?.done).toBe(true);
    await deleteSessionDraft(record.id);
    expect(await getSessionDraft(week, sessionId)).toBeNull();
  });

  it("resolves the saved log id for undo and does not leave two logs after re-save", async () => {
    const sessionId = "train-undo";
    const completedAt = "2026-11-16T09:00:00.000Z";
    const log: SessionLogRecord = {
      id: `${sessionId}:${completedAt}`,
      sessionId,
      dayIndex: 0,
      completedAt,
      partial: false,
      location: "home",
      title: "Undo test",
      exercises: [
        {
          exerciseId: "ex_fixture_a",
          sourceExerciseId: "ex_fixture_a",
          done: true,
          hurt: false,
          bellKg: null,
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
    await saveSessionLog(log);
    const resolved = await resolveSavedSessionLogId(sessionId, completedAt);
    expect(resolved).toBe(log.id);
    await deleteSessionLog(resolved!);
    expect(await getSessionLog(log.id)).toBeNull();

    const againAt = "2026-11-16T09:05:00.000Z";
    const second: SessionLogRecord = { ...log, id: `${sessionId}:${againAt}`, completedAt: againAt };
    await saveSessionLog(second);
    expect(await getLatestSessionLogForSession(sessionId)).toEqual(second);
    await deleteSessionLog(second.id);
  });
});