/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commitMediaChanges, deleteExerciseMedia, getExerciseMedia } from "../src/media/service";
import type { ExerciseMediaMeta } from "../src/media/types";

const blobs = new Map<string, Blob>();
const meta = new Map<string, ExerciseMediaMeta>();

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

vi.mock("../src/media/meta-store", () => ({
  getMediaByExerciseId: async (exerciseId: string) =>
    [...meta.values()].find((row) => row.exerciseId === exerciseId) ?? null,
  putMediaMeta: async (row: ExerciseMediaMeta) => {
    meta.set(row.id, row);
  },
  replaceMediaMetaForExercise: async (
    exerciseId: string,
    next: ExerciseMediaMeta,
    dropMediaId: string | null,
  ) => {
    for (const row of [...meta.values()]) {
      if (row.exerciseId === exerciseId || row.id === dropMediaId) {
        meta.delete(row.id);
      }
    }
    meta.set(next.id, { ...next, exerciseId });
  },
  deleteMediaMeta: async (id: string) => {
    meta.delete(id);
  },
  listMediaMeta: async () => [...meta.values()],
  loadMediaSettings: async () => ({}),
  saveMediaSettings: async () => {},
  deleteOrphanMediaMeta: async () => {},
}));

function sample(exerciseId: string): ExerciseMediaMeta {
  return {
    id: "med_test",
    exerciseId,
    kind: "photo",
    width: 100,
    height: 80,
    bytes: 10,
    posterKey: "med_test.poster.jpg",
    fileKey: "med_test.bin",
    createdAt: "2026-11-16T12:00:00.000Z",
  };
}

describe("media store", () => {
  beforeEach(() => {
    blobs.clear();
    meta.clear();
    blobs.set("med_test.bin", new Blob(["full"]));
    blobs.set("med_test.poster.jpg", new Blob(["thumb"]));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keys media by exercise id and survives a rename (id unchanged)", async () => {
    meta.set("med_test", sample("uex_alpha"));
    const before = await getExerciseMedia("uex_alpha");
    expect(before?.id).toBe("med_test");
    const renamed = { ...before!, exerciseId: "uex_alpha" };
    await commitMediaChanges("uex_alpha", renamed, false, before, null);
    const after = await getExerciseMedia("uex_alpha");
    expect(after?.fileKey).toBe("med_test.bin");
  });

  it("delete removes metadata", async () => {
    meta.set("med_test", sample("uex_rm"));
    await deleteExerciseMedia("uex_rm");
    expect(await getExerciseMedia("uex_rm")).toBeNull();
    expect(blobs.has("med_test.bin")).toBe(false);
  });

  it("storage-full commit leaves the prior record in place", async () => {
    const old = sample("uex_full");
    meta.set(old.id, old);
    await expect(
      commitMediaChanges("uex_full", null, false, old, null),
    ).resolves.toBeUndefined();
    expect(await getExerciseMedia("uex_full")).not.toBeNull();
  });
});