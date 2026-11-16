/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { AppConfig } from "../src/config/types";
import { mountExerciseFlow } from "../src/exercises/exercise-screen";
import { mergePersistedState } from "../src/setup/merge";
import { initialPersistedState } from "../src/setup/defaults";
import { acknowledgeDisclaimer } from "../src/setup/disclaimer";
import { createMemoryStorage } from "../src/setup/storage";
import { loadExampleConditions } from "./helpers";

function appConfig(): AppConfig {
  return {
    libraryPath: "data/sample-library.json",
    disclaimerVersion: 1,
    conditions: loadExampleConditions(),
    equipment: {
      availableBellsKg: [6, 8],
      home: { bellsKg: [6] },
      gym: { bellsKg: [8] },
    },
  };
}

describe("hurt restore UI", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.getElementById("exercise-bar")?.remove();
  });

  it("shows Undo after Restore and persists pending restore across reload", () => {
    const config = appConfig();
    const storage = createMemoryStorage();
    let state = initialPersistedState(config);
    state = acknowledgeDisclaimer(state, config, new Date("2026-11-16T12:00:00.000Z"));
    state.setupComplete = true;
    state.hurtExclusions = [
      { exerciseId: "ex_a", markedAt: "2026-11-12T09:00:00.000Z", from: "today" },
    ];
    storage.save(state);

    const flow = mountExerciseFlow({
      config,
      storage,
      root,
      libraryExercises: [],
      libraryRoutines: [],
      initialView: "hurt",
      onBackToSettings: () => {},
    });

    const restore = root.querySelector<HTMLButtonElement>('[data-act="restore"][data-v="ex_a"]');
    expect(restore).not.toBeNull();
    restore!.click();

    const undo = root.querySelector<HTMLButtonElement>("#undo-restore-ex_a");
    expect(undo).not.toBeNull();
    expect(document.activeElement).toBe(undo);

    const reloaded = mergePersistedState(storage.load(), config);
    expect(reloaded.pendingHurtRestore?.exerciseId).toBe("ex_a");
    expect(reloaded.hurtExclusions).toHaveLength(0);

    flow.destroy();
    mountExerciseFlow({
      config,
      storage,
      root,
      libraryExercises: [],
      libraryRoutines: [],
      initialView: "hurt",
      onBackToSettings: () => {},
    });
    expect(root.querySelector("#undo-restore-ex_a")).not.toBeNull();

    const undoBtn = root.querySelector<HTMLButtonElement>("#undo-restore-ex_a");
    undoBtn!.click();
    const afterUndo = mergePersistedState(storage.load(), config);
    expect(afterUndo.pendingHurtRestore).toBeUndefined();
    expect(afterUndo.hurtExclusions).toHaveLength(1);
    expect(afterUndo.hurtExclusions![0]!.exerciseId).toBe("ex_a");
  });
});