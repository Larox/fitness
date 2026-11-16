/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config/types";
import { mountExerciseFlow } from "../src/exercises/exercise-screen";
import { commitMediaForSave, createMediaFlowState } from "../src/exercises/exercise-media-flow";
import { loadMediaDraft, markMediaRemoved } from "../src/media/draft";
import { initialPersistedState } from "../src/setup/defaults";
import { acknowledgeDisclaimer } from "../src/setup/disclaimer";
import { createMemoryStorage } from "../src/setup/storage";
import { loadExampleConditions } from "./helpers";
import {
  commitMediaChanges,
  getExerciseMedia,
} from "../src/media/service";
import { putMediaMeta } from "../src/media/meta-store";
import type { ExerciseMediaMeta } from "../src/media/types";

const blobs = new Map<string, Blob>();

vi.mock("../src/media/file-store", () => ({
  deleteMediaBlob: async (key: string) => {
    blobs.delete(key);
  },
  readMediaBlob: async (key: string) => blobs.get(key) ?? null,
  writeMediaBlob: async (key: string, blob: Blob) => {
    blobs.set(key, blob);
  },
  estimateDeviceStorage: async () => ({ usage: 0, quota: 1_000_000_000 }),
  requestPersistentStorage: async () => true,
}));

function oldMeta(exerciseId: string): ExerciseMediaMeta {
  return {
    id: "med_old",
    exerciseId,
    kind: "photo",
    width: 100,
    height: 80,
    bytes: 10,
    posterKey: "med_old.poster",
    fileKey: "med_old.bin",
    createdAt: "2026-11-16T12:00:00.000Z",
  };
}

function newMeta(exerciseId: string): ExerciseMediaMeta {
  return {
    id: "med_new",
    exerciseId,
    kind: "photo",
    width: 200,
    height: 150,
    bytes: 20,
    posterKey: "med_new.poster",
    fileKey: "med_new.bin",
    createdAt: "2026-11-16T12:01:00.000Z",
  };
}

describe("media meta replace save", () => {
  beforeEach(() => {
    blobs.clear();
    indexedDB.deleteDatabase("fitness.media.meta.v1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replaces saved media on commit without unique-index errors", async () => {
    const exerciseId = "uex_form";
    const prior = oldMeta(exerciseId);
    const next = newMeta(exerciseId);
    await putMediaMeta(prior);
    blobs.set(prior.fileKey, new Blob(["old"]));
    blobs.set(prior.posterKey, new Blob(["old-thumb"]));
    blobs.set(next.fileKey, new Blob(["new"]));
    blobs.set(next.posterKey, new Blob(["new-thumb"]));

    await commitMediaChanges(exerciseId, next, false, prior, prior);

    const stored = await getExerciseMedia(exerciseId);
    expect(stored?.id).toBe("med_new");
    expect(blobs.has("med_old.bin")).toBe(false);
    expect(blobs.has("med_new.bin")).toBe(true);
  });

  it("replaces saved media for library exercises the same way", async () => {
    const exerciseId = "lib_item";
    const prior = oldMeta(exerciseId);
    const next = newMeta(exerciseId);
    await putMediaMeta(prior);
    await commitMediaChanges(exerciseId, next, false, prior, null);
    const stored = await getExerciseMedia(exerciseId);
    expect(stored?.id).toBe("med_new");
  });

  it("remove after replace then save deletes saved media", async () => {
    const exerciseId = "uex_rm";
    const prior = oldMeta(exerciseId);
    const next = newMeta(exerciseId);
    await putMediaMeta(prior);
    blobs.set(prior.fileKey, new Blob(["old"]));
    blobs.set(next.fileKey, new Blob(["new"]));

    const state = createMediaFlowState(exerciseId);
    state.draft = loadMediaDraft(exerciseId, prior);
    state.draft = {
      ...state.draft,
      pending: next,
      display: next,
      replaced: prior,
    };
    state.draft = markMediaRemoved(state.draft);

    await commitMediaForSave(state, exerciseId);
    expect(await getExerciseMedia(exerciseId)).toBeNull();
    expect(blobs.has("med_new.bin")).toBe(false);
    expect(blobs.has("med_old.bin")).toBe(false);
  });

  it("keeps draft edits visible when media save fails", async () => {
    const storage = createMemoryStorage();
    const config: AppConfig = {
      libraryPath: "data/sample-library.json",
      disclaimerVersion: 1,
      conditions: loadExampleConditions(),
      equipment: { availableBellsKg: [6], home: { bellsKg: [6] }, gym: { bellsKg: [8] } },
    };
    let state = initialPersistedState(config);
    state = acknowledgeDisclaimer(state, config, new Date("2026-11-16T12:00:00.000Z"));
    state.setupComplete = true;
    storage.save(state);

    const root = document.createElement("div");
    document.body.appendChild(root);

    const flow = mountExerciseFlow({
      config,
      storage,
      root,
      libraryExercises: [],
      libraryRoutines: [{ categories: ["mobility"] }],
      initialView: "form",
      onBackToSettings: () => {},
    });

    const nameInput = root.querySelector<HTMLInputElement>("#ex-name");
    nameInput!.value = "Farmer carry";
    nameInput!.dispatchEvent(new Event("input", { bubbles: true }));

    const media = await import("../src/media/service");
    vi.spyOn(media, "commitMediaChanges").mockRejectedValueOnce(new Error("idb-write-failed"));

    document.querySelector<HTMLButtonElement>(".exercise-bar .primary")?.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(root.textContent).toContain("Couldn't save the photo or clip");
    expect(root.querySelector<HTMLInputElement>("#ex-name")?.value).toBe("Farmer carry");
    flow.destroy();
    root.remove();
  });
});