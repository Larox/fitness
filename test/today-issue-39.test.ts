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
import { acknowledgeDisclaimer, needsDisclaimerAcknowledgement } from "../src/setup/disclaimer";
import { defaultTrainingSettings } from "../src/setup/defaults";
import { mergePersistedState } from "../src/setup/merge";
import { createConditionLabelContext } from "../src/setup/condition-labels";
import { createMemoryStorage } from "../src/setup/storage";
import type { PersistedAppState } from "../src/setup/types";
import {
  isSessionCompleted,
  markSessionCompleted,
  sessionCompletionSummary,
} from "../src/today/completion";
import {
  buildSessionDraftId,
  getSessionDraft,
  saveSessionDraft,
} from "../src/today/session-draft-store";
import { resolveTodayView } from "../src/today/resolve-today-session";
import { mountTodayScreen } from "../src/today/today-screen";
import { defaultSetLogsForScheduled } from "../src/today/set-logs";
import { weekPlanDayIndex, weekStartForPlanRow, weekStartKey } from "../src/today/weekday";

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
  return { plan: built.plan, settings, exercisesById, routines: imported.routines };
}

describe("B38-1 disclaimer acknowledgement survives Today persist", () => {
  let rootEl: HTMLDivElement;
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    document.body.innerHTML = "";
    rootEl = document.createElement("div");
    document.body.appendChild(rootEl);
    storage = createMemoryStorage();
  });

  it("does not overwrite disclaimer fields when Today saves exercise state", () => {
    const { plan, settings, exercisesById, routines } = loadFixturePlan();
    const base: PersistedAppState = {
      settings,
      setupComplete: true,
      weekPlan: plan,
    };
    storage.save(base);
    const routinesById = new Map(routines.map((r) => [r.id, r]));
    const sunday = new Date("2026-11-22T15:00:00.000Z");
    const mount = mountTodayScreen({
      config,
      storage,
      root: rootEl,
      exercisesById,
      routineSourceById: new Map(),
      routinesById,
      onOpenSettings: () => {},
      now: () => sunday,
    });

    let acked = acknowledgeDisclaimer(mergePersistedState(storage.load(), config), config, sunday);
    storage.save(acked);
    mount.reloadPersisted();

    rootEl.querySelector<HTMLButtonElement>('[data-act="today-train-early"]')?.click();
    const firstExercise = plan.rows.find((r) => r.slotKind !== "rest")?.sessionId;
    const session = firstExercise ? plan.sessions[firstExercise] : undefined;
    const exerciseId = session?.scheduled[0]?.exerciseId;
    expect(exerciseId).toBeDefined();
    rootEl.querySelector<HTMLButtonElement>(`[data-act="today-done"][data-id="${exerciseId}"]`)?.click();

    const after = mergePersistedState(storage.load(), config);
    expect(needsDisclaimerAcknowledgement(after, config)).toBe(false);
    expect(after.disclaimerAcknowledgedVersion).toBe(config.disclaimerVersion);
    mount.destroy();
  });
});

describe("B38-2 train-early session survives reload", () => {
  it("restores train-early mode and draft from persisted week state", async () => {
    const { plan, settings } = loadFixturePlan();
    const sunday = new Date("2026-11-22T12:00:00.000Z");
    const viewerWeek = weekStartKey(sunday);
    const restDay = plan.rows.find((r) => r.slotKind === "rest");
    expect(restDay).toBeDefined();
    const preview = resolveTodayView(plan, restDay!.dayIndex, {
      referenceDate: sunday,
    });
    expect(preview?.mode).toBe("preview");
    const row = preview!.row;
    const session = preview!.session;
    const sched = session.scheduled[0]!;
    const sessionWeek = weekStartForPlanRow(sunday, row.dayIndex);

    await saveSessionDraft({
      id: buildSessionDraftId(sessionWeek, row.sessionId),
      sessionId: row.sessionId,
      weekStart: sessionWeek,
      dayIndex: row.dayIndex,
      updatedAt: sunday.toISOString(),
      cards: {
        [sched.exerciseId]: {
          expanded: true,
          done: true,
          hurt: false,
          bellKg: null,
          setLogs: defaultSetLogsForScheduled(sched),
        },
      },
    });

    const state: PersistedAppState = {
      settings,
      setupComplete: true,
      weekPlan: plan,
      trainEarlySessionByWeek: { [viewerWeek]: row.sessionId },
    };

    const view = resolveTodayView(plan, weekPlanDayIndex(sunday), {
      trainEarlySessionId: state.trainEarlySessionByWeek?.[viewerWeek] ?? null,
      completedSessions: state.completedSessions,
      referenceDate: sunday,
    });
    expect(view?.mode).toBe("trained_early");
    const draft = await getSessionDraft(sessionWeek, row.sessionId);
    expect(draft?.cards[sched.exerciseId]?.done).toBe(true);
  });
});

describe("B38-3 completed early sessions are not offered again", () => {
  it("skips completed sessions in preview and blocks partial overwrite", () => {
    const { plan, settings } = loadFixturePlan();
    const sunday = new Date("2026-11-22T10:00:00.000Z");
    const restDay = plan.rows.find((r) => r.slotKind === "rest");
    const preview = resolveTodayView(plan, restDay!.dayIndex, { referenceDate: sunday });
    expect(preview?.mode).toBe("preview");
    const row = preview!.row;
    const sessionWeek = weekStartForPlanRow(sunday, row.dayIndex);
    expect(sessionWeek).toBe("2026-11-23");

    let state: PersistedAppState = {
      settings,
      setupComplete: true,
      weekPlan: plan,
      trainEarlySessionByWeek: { [weekStartKey(sunday)]: row.sessionId },
    };
    state = markSessionCompleted(state, row.sessionId, sessionWeek, {
      completedAt: sunday.toISOString(),
      partial: false,
    });

    expect(isSessionCompleted(state.completedSessions, row.sessionId, sessionWeek)).toBe(true);

    const resolved = resolveTodayView(plan, restDay!.dayIndex, {
      trainEarlySessionId: row.sessionId,
      completedSessions: state.completedSessions,
      referenceDate: sunday,
    });
    expect(resolved?.mode).not.toBe("trained_early");
    if (resolved?.mode === "preview") {
      expect(resolved.row.sessionId).not.toBe(row.sessionId);
    }

    state = markSessionCompleted(state, row.sessionId, sessionWeek, {
      completedAt: new Date("2026-11-22T11:00:00.000Z").toISOString(),
      partial: true,
    });
    expect(sessionCompletionSummary(state.completedSessions, row.sessionId, sessionWeek)?.partial).toBe(
      false,
    );
    expect(isSessionCompleted(state.completedSessions, row.sessionId, sessionWeek)).toBe(true);
  });
});