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

vi.mock("../src/media/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/media/service")>();
  return {
    ...actual,
    listMediaMeta: vi.fn(async () => []),
    getExerciseMedia: vi.fn(async () => null),
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

describe("exercise save bar", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("URL", { createObjectURL: () => "blob:t", revokeObjectURL: () => {} });
    document.body.innerHTML = "";
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.getElementById("exercise-bar")?.remove();
  });

  it("keeps Save exercise enabled on a new untouched form", async () => {
    const storage = createMemoryStorage();
    let state = initialPersistedState(config());
    state = acknowledgeDisclaimer(state, config(), new Date("2026-11-16T12:00:00.000Z"));
    state.setupComplete = true;
    storage.save(state);

    const flow = mountExerciseFlow({
      config: config(),
      storage,
      root,
      libraryExercises: [],
      libraryRoutines: [],
      initialView: "my",
      onBackToSettings: () => {},
    });

    root.querySelector<HTMLButtonElement>('[data-act="add-new"]')?.click();
    await new Promise((r) => setTimeout(r, 0));

    const save = document.querySelector<HTMLButtonElement>(".exercise-bar .primary");
    expect(save?.hasAttribute("disabled")).toBe(false);
    flow.destroy();
  });
});