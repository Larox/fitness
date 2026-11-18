/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAppConfig } from "../src/config/load";
import { importLibrary } from "../src/library/import";
import type { SnapshotRoutine } from "../src/library/types";
import { buildWeeklyPlan } from "../src/plan/build-week-plan";
import { defaultPlanSeed } from "../src/plan/seed";
import { defaultTrainingSettings } from "../src/setup/defaults";
import { createConditionLabelContext } from "../src/setup/condition-labels";
import { createMemoryStorage } from "../src/setup/storage";
import type { PersistedAppState } from "../src/setup/types";
import { markSessionCompleted } from "../src/today/completion";
import { resolveTodayView } from "../src/today/resolve-today-session";
import { mountTodayScreen } from "../src/today/today-screen";
import { weekStartForPlanRow } from "../src/today/weekday";

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

describe("issue #43: early save stays on done session", () => {
  let rootEl: HTMLDivElement;
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    document.body.innerHTML = "";
    rootEl = document.createElement("div");
    document.body.appendChild(rootEl);
    storage = createMemoryStorage();
    Object.defineProperty(window, "innerWidth", { value: 360, configurable: true });
  });

  async function waitForTodayMount(): Promise<void> {
    await vi.waitFor(() => {
      expect(rootEl.querySelector(".hdr")).not.toBeNull();
    });
  }

  it("keeps train-early session with Undo after save until reload", async () => {
    const { plan, settings, exercisesById, routines } = loadFixturePlan();
    const sunday = new Date("2026-11-22T12:00:00.000Z");
    const restDay = plan.rows.find((r) => r.slotKind === "rest");
    expect(restDay).toBeDefined();
    const previewBefore = resolveTodayView(plan, restDay!.dayIndex, { referenceDate: sunday });
    expect(previewBefore?.mode).toBe("preview");
    const targetSessionId = previewBefore!.row.sessionId;
    const firstTrainingRow = plan.rows.find((r) => r.slotKind !== "rest");
    const exerciseId = firstTrainingRow
      ? plan.sessions[firstTrainingRow.sessionId]!.scheduled[0]!.exerciseId
      : previewBefore!.session.scheduled[0]!.exerciseId;

    const base: PersistedAppState = {
      settings,
      setupComplete: true,
      weekPlan: plan,
    };
    storage.save(base);

    const routinesById = new Map(routines.map((r) => [r.id, r]));
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
    await waitForTodayMount();

    const bar = document.getElementById("today-bar")!;
    bar.querySelector<HTMLButtonElement>('[data-act="today-train-early"]')!.click();
    expect(rootEl.textContent).toContain("Training early");
    await vi.waitFor(() => {
      expect(rootEl.querySelector(`[data-act="today-done"][data-id="${exerciseId}"]`)).not.toBeNull();
    });
    rootEl.querySelector<HTMLButtonElement>(`[data-act="today-done"][data-id="${exerciseId}"]`)!.click();
    await vi.waitFor(() => {
      expect(bar.querySelector('[data-act="today-save"]:not([disabled])')).not.toBeNull();
    });
    bar.querySelector<HTMLButtonElement>('[data-act="today-save"]')!.click();

    expect(rootEl.textContent).toContain("Session done");
    expect(document.getElementById("today-bar")?.textContent).toContain("Undo");
    expect(rootEl.textContent).not.toContain("Rest day.");
    expect(rootEl.querySelector(`[data-eid="${exerciseId}"]`)).not.toBeNull();

    const sessionWeek = weekStartForPlanRow(sunday, previewBefore!.row.dayIndex);
    const freshView = resolveTodayView(plan, restDay!.dayIndex, {
      referenceDate: sunday,
      trainEarlySessionId: targetSessionId,
      completedSessions: markSessionCompleted(base, targetSessionId, sessionWeek, {
        completedAt: sunday.toISOString(),
        partial: true,
      }).completedSessions,
    });
    expect(freshView?.mode).toBe("preview");
    expect(freshView?.row.sessionId).not.toBe(targetSessionId);

    mount.destroy();
  });

  it("separates exercise name and dose for layout and screen readers at 360px", async () => {
    const { plan, settings, exercisesById, routines } = loadFixturePlan();
    const monday = new Date("2026-11-17T12:00:00.000Z");
    storage.save({ settings, setupComplete: true, weekPlan: plan });
    const routinesById = new Map(routines.map((r) => [r.id, r]));
    mountTodayScreen({
      config,
      storage,
      root: rootEl,
      exercisesById,
      routineSourceById: new Map(),
      routinesById,
      onOpenSettings: () => {},
      now: () => monday,
    });
    await waitForTodayMount();

    const expand = rootEl.querySelector<HTMLButtonElement>(".thead");
    expect(expand).not.toBeNull();
    expect(expand!.querySelector(".etitle .ename")).not.toBeNull();
    expect(expand!.querySelector(".etitle .edose")).not.toBeNull();
    const label = expand!.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/\s/);
    expect(label).not.toMatch(/[a-z]×/);
    expect(label).not.toMatch(/[a-z]Done$/);
  });
});