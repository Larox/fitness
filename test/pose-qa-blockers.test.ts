/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderMediaAttachSection } from "../src/media/attach-html";
import { loadMediaDraft } from "../src/media/draft";
import { getMediaByExerciseId } from "../src/media/meta-store";
import type { ExerciseMediaMeta } from "../src/media/types";
import {
  commitMediaForSave,
  createMediaFlowState,
  isMediaFormDirty,
} from "../src/exercises/exercise-media-flow";
import { isMediaDraftDirty } from "../src/media/draft";
import * as modelCache from "../src/pose/model-cache";
import { resolvePoseModelUrls } from "../src/pose/model-resolve";
import { writePendingPoseFile } from "../src/pose/pose-persist";

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

function clipMeta(exerciseId: string, id: string, withPose = false): ExerciseMediaMeta {
  const base: ExerciseMediaMeta = {
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
  if (!withPose) return base;
  return {
    ...base,
    pose: {
      key: `pose/${id}.pose`,
      bytes: 50,
      frames: 30,
      fps: 15,
      keyFrame: 0,
      createdAt: "2026-11-16T12:00:00.000Z",
      modelVersion: "test",
    },
  };
}

describe("QA blockers B1–B4", () => {
  beforeEach(() => {
    blobs.clear();
    indexedDB.deleteDatabase("fitness.media.meta.v1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("B1: saves draft pose in the same commit transaction as a new clip", async () => {
    const exerciseId = "uex_b1";
    const pending = clipMeta(exerciseId, "med_pending");
    blobs.set(pending.fileKey, new Blob(["clip"]));
    blobs.set(pending.posterKey, new Blob(["poster"]));
    const pose = await writePendingPoseFile(pending.id, new Blob(["pose-bytes"]), {
      frames: 30,
      fps: 15,
      keyFrame: 0,
      createdAt: "2026-11-16T12:00:00.000Z",
      modelVersion: "test",
    });
    const state = createMediaFlowState(exerciseId);
    state.draft = {
      ...loadMediaDraft(exerciseId, null),
      display: { ...pending, pose },
      pending,
    };
    state.pendingPoseOnDraft = true;

    await commitMediaForSave(state, exerciseId);

    const stored = await getMediaByExerciseId(exerciseId);
    expect(stored?.id).toBe(pending.id);
    expect(stored?.pose?.key).toBe(pose.key);
    expect(stored?.pose?.bytes).toBe(pose.bytes);
    expect(blobs.has(pose.key)).toBe(true);
    expect(state.pendingPoseOnDraft).toBe(false);
  });

  it("B2: pending animation removal counts as a form change", () => {
    const exerciseId = "uex_b2";
    const saved = clipMeta(exerciseId, "med_saved", true);
    const state = createMediaFlowState(exerciseId);
    state.draft = loadMediaDraft(exerciseId, saved);
    state.poseRemoveDraft = true;

    expect(isMediaDraftDirty(state.draft)).toBe(false);
    expect(isMediaFormDirty(state)).toBe(true);
  });

  it("B3: clip toggle view keeps one media frame and one replace row", () => {
    const exerciseId = "uex_b3";
    const meta = clipMeta(exerciseId, "med_clip", true);
    const draft = loadMediaDraft(exerciseId, meta);
    const html = renderMediaAttachSection(draft, {
      changedDot: false,
      posterUrl: "blob:poster",
      anim: {
        meta,
        posterUrl: "blob:poster",
        exerciseName: "Squat",
        job: null,
        modelCached: true,
        modelOnDevice: true,
        unfinished: false,
        view: "clip",
        poseRemovedDraft: false,
        manifestTotal: "12.3 MB",
        showToggle: true,
      },
    });
    expect(html.match(/class="media-frame/g)?.length).toBe(1);
    expect(html.match(/data-act="media-replace"/g)?.length).toBe(1);
    expect(html).toContain('data-v="clip"');
    expect(html).not.toMatch(/anim-divider[\s\S]*media-frame[\s\S]*anim-divider/);
  });

  it("B4: cached model path is read from Cache Storage for detect", async () => {
    const base = "https://example.test/models";
    const networkModel = `${base}/pose_landmarker_lite.task`;
    const readSpy = vi.spyOn(modelCache, "readPoseModelFromCache").mockImplementation(async (url) => {
      if (url !== networkModel) return undefined;
      return { blob: async () => new Blob(["task-bytes"]) } as Response;
    });

    const createObjectURL = vi.fn(() => "blob:from-cache");
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    });

    const resolved = await resolvePoseModelUrls(base);
    expect(readSpy).toHaveBeenCalledWith(networkModel);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(resolved.modelUrl).toBe("blob:from-cache");
    resolved.revoke();
    readSpy.mockRestore();
  });
});