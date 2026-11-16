/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachPoseToMedia, replacePoseOnMedia } from "../src/pose/pose-persist";
import { putMediaMeta, getMediaByExerciseId } from "../src/media/meta-store";
import type { ExerciseMediaMeta } from "../src/media/types";
import { processLandmarkFrames } from "../src/pose/process";
import { syntheticClipLandmarks } from "./pose-fixtures";

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

function clipMeta(exerciseId: string, id: string): ExerciseMediaMeta {
  return {
    id,
    exerciseId,
    kind: "clip",
    width: 480,
    height: 360,
    durationS: 3,
    bytes: 1000,
    posterKey: `${id}.poster`,
    fileKey: `${id}.bin`,
    createdAt: "2026-11-16T12:00:00.000Z",
  };
}

describe("pose meta race guards", () => {
  beforeEach(() => {
    blobs.clear();
    indexedDB.deleteDatabase("fitness.media.meta.v1");
  });

  it("skips attach when media was replaced", async () => {
    const exerciseId = "uex_pose";
    const old = clipMeta(exerciseId, "med_old");
    const neu = clipMeta(exerciseId, "med_new");
    await putMediaMeta(neu);
    const landmarks = syntheticClipLandmarks(30);
    const processed = processLandmarkFrames(landmarks, 2, "test");
    expect(processed.ok).toBe(true);
    if (!processed.ok) return;
    const ok = await attachPoseToMedia(exerciseId, old.id, processed.blob, {
      frames: processed.frames,
      fps: 15,
      keyFrame: processed.keyFrame,
      createdAt: new Date().toISOString(),
      modelVersion: "test",
    });
    expect(ok).toBe(false);
    const stored = await getMediaByExerciseId(exerciseId);
    expect(stored?.pose).toBeUndefined();
  });

  it("replaces pose when media id still matches", async () => {
    const exerciseId = "uex_pose_ok";
    const meta = clipMeta(exerciseId, "med_a");
    await putMediaMeta(meta);
    const landmarks = syntheticClipLandmarks(30);
    const processed = processLandmarkFrames(landmarks, 2, "test");
    if (!processed.ok) throw new Error("process failed");
    const ok = await replacePoseOnMedia(exerciseId, meta.id, processed.blob, {
      frames: processed.frames,
      fps: 15,
      keyFrame: processed.keyFrame,
      createdAt: new Date().toISOString(),
      modelVersion: "test",
    });
    expect(ok).toBe(true);
    const stored = await getMediaByExerciseId(exerciseId);
    expect(stored?.pose?.bytes).toBe(processed.blob.size);
    expect(blobs.has(stored!.pose!.key)).toBe(true);
  });
});