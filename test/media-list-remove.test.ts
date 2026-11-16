/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config/types";
import { mountExerciseFlow } from "../src/exercises/exercise-screen";
import { initialPersistedState } from "../src/setup/defaults";
import { acknowledgeDisclaimer } from "../src/setup/disclaimer";
import { createMemoryStorage } from "../src/setup/storage";
import { loadExampleConditions } from "./helpers";
import type { ExerciseMediaMeta } from "../src/media/types";
import type { NormalizedExercise } from "../src/library/types";

const mediaRows = vi.hoisted(() => ({
  rows: [
    {
      id: "med_a",
      exerciseId: "lib_a",
      kind: "photo" as const,
      width: 10,
      height: 10,
      bytes: 100,
      posterKey: "a.poster",
      fileKey: "a.bin",
      createdAt: "2026-11-16T12:00:00.000Z",
    },
  ] satisfies ExerciseMediaMeta[],
}));

vi.mock("../src/media/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/media/service")>();
  let meta = [...mediaRows.rows];
  let pending: ExerciseMediaMeta | null = null;
  return {
    ...actual,
    listMediaMeta: vi.fn(async () => [...meta]),
    detachMediaMeta: vi.fn(async (id: string) => {
      const hit = meta.find((row) => row.id === id) ?? null;
      meta = meta.filter((row) => row.id !== id);
      return hit;
    }),
    putMediaMeta: vi.fn(async (row: ExerciseMediaMeta) => {
      meta = [...meta.filter((r) => r.id !== row.id), row] as typeof meta;
    }),
    deleteMediaFiles: vi.fn(async () => {
      pending = null;
    }),
    readPosterBlob: vi.fn(async () => new Blob(["x"], { type: "image/jpeg" })),
    summarizeMediaUsage: vi.fn(async () => ({
      itemCount: meta.length,
      bytesUsed: 100,
      quota: 1000,
      usage: 100,
    })),
    __test: { getPending: () => pending, setPending: (v: ExerciseMediaMeta | null) => { pending = v; } },
  };
});

function config(): AppConfig {
  return {
    libraryPath: "data/sample-library.json",
    disclaimerVersion: 1,
    conditions: loadExampleConditions(),
    equipment: { availableBellsKg: [6], home: { bellsKg: [6] }, gym: { bellsKg: [8] } },
  };
}

describe("photos and clips list remove", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => {},
    });
    document.body.innerHTML = "";
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.getElementById("exercise-bar")?.remove();
  });

  it("shows undo and makes a second Remove a no-op", async () => {
    const storage = createMemoryStorage();
    let state = initialPersistedState(config());
    state = acknowledgeDisclaimer(state, config(), new Date("2026-11-16T12:00:00.000Z"));
    state.setupComplete = true;
    storage.save(state);
    const libraryExercises: NormalizedExercise[] = [
      {
        id: "lib_a",
        routineId: "r1",
        name: "Gentle march",
        sets: 2,
        reps: "30 s",
        equipment: null,
        cues: [],
        conditionRisks: { concern_a: "low", concern_b: "low", concern_c: "low" },
      },
    ];

    const flow = mountExerciseFlow({
      config: config(),
      storage,
      root,
      libraryExercises,
      libraryRoutines: [],
      initialView: "my",
      onBackToSettings: () => {},
    });

    root.querySelector<HTMLButtonElement>('[data-act="open-media-list"]')?.click();
    await new Promise((r) => setTimeout(r, 0));

    const remove = root.querySelector<HTMLButtonElement>('[data-act="media-list-remove"]');
    expect(remove).not.toBeNull();
    remove!.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(root.textContent).toContain("Undo");
    expect(root.querySelector('[data-act="media-list-remove"]')).toBeNull();

    const removeAgain = root.querySelector<HTMLButtonElement>('[data-act="media-list-remove"]');
    expect(removeAgain).toBeNull();

    flow.destroy();
  });
});