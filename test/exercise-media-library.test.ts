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
import type { NormalizedExercise } from "../src/library/types";

const importedMeta = {
  id: "med_lib",
  exerciseId: "lib_x",
  kind: "photo" as const,
  width: 400,
  height: 300,
  bytes: 1200,
  posterKey: "lib.poster",
  fileKey: "lib.bin",
  createdAt: "2026-11-16T12:00:00.000Z",
};

vi.mock("../src/media/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/media/service")>();
  return {
    ...actual,
    getExerciseMedia: vi.fn(async () => null),
    importMediaForExercise: vi.fn(async () => importedMeta),
    readPosterBlob: vi.fn(async () => new Blob(["thumb"], { type: "image/jpeg" })),
    summarizeMediaUsage: vi.fn(async () => ({
      itemCount: 0,
      bytesUsed: 0,
      quota: 1_000_000,
      usage: 0,
    })),
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

describe("library exercise media attach", () => {
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

  it("attaches media after picking a file", async () => {
    const storage = createMemoryStorage();
    let state = initialPersistedState(config());
    state = acknowledgeDisclaimer(state, config(), new Date("2026-11-16T12:00:00.000Z"));
    state.setupComplete = true;
    storage.save(state);

    const libraryExercises: NormalizedExercise[] = [
      {
        id: "lib_x",
        routineId: "r1",
        name: "Wall sit",
        sets: 3,
        reps: "45 s",
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

    root.querySelector<HTMLButtonElement>('[data-act="open-library"][data-v="lib_x"]')?.click();
    await new Promise((r) => setTimeout(r, 0));

    const input = root.querySelector<HTMLInputElement>("#media-file-input");
    expect(input).not.toBeNull();
    const file = new File([new Uint8Array([1, 2, 3])], "shot.jpg", { type: "image/jpeg" });
    Object.defineProperty(input!, "files", { value: [file] });
    input!.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));

    expect(root.textContent).toContain("Photo");
    expect(root.querySelector('[data-act="media-remove"]')).not.toBeNull();

    flow.destroy();
  });
});