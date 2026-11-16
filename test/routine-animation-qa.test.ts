/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMediaFlowState } from "../src/exercises/exercise-media-flow";
import {
  libraryRoutineAnimContextActive,
  resetMediaFlowForRoutineNavigation,
  resolvePoseStartTarget,
  type PoseStartTarget,
} from "../src/exercises/routine-media-flow";
import {
  clearRoutineLibraryPose,
  getRoutineLibraryPose,
  saveRoutineLibraryPose,
} from "../src/library/routine-pose";
import { getMediaByExerciseId } from "../src/media/meta-store";
import { putMediaMeta } from "../src/media/service";
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

function legacyPoseStartTarget(input: {
  view: string;
  display: ExerciseMediaMeta | null | undefined;
  routineVideo?: string;
  routineId?: string;
  libraryVideoDurationS: number | null;
}): PoseStartTarget {
  if (input.display?.kind === "clip") {
    return { kind: "exercise-clip", meta: input.display };
  }
  const routine = input.routineId;
  if (input.routineVideo && routine && input.libraryVideoDurationS != null) {
    return { kind: "routine", routineId: routine, durationS: input.libraryVideoDurationS };
  }
  return { kind: "none" };
}

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

describe("routine animation QA (#32)", () => {
  beforeEach(() => {
    blobs.clear();
    indexedDB.deleteDatabase("fitness.media.meta.v1");
  });

  it("routes Make animation to the routine when routine view still has a stale exercise clip", () => {
    const staleClip = clipMeta("lex_before", "med_stale", true);
    const input = {
      view: "routine",
      display: staleClip,
      routineVideo: "media/reels/a.mp4",
      routineId: "routine_a",
      libraryVideoDurationS: 12,
    };
    expect(legacyPoseStartTarget(input).kind).toBe("exercise-clip");
    expect(resolvePoseStartTarget(input)).toEqual({
      kind: "routine",
      routineId: "routine_a",
      durationS: 12,
    });
  });

  it("still targets the exercise clip on a library exercise that has user media", () => {
    const clip = clipMeta("lex_user", "med_user", true);
    const target = resolvePoseStartTarget({
      view: "library",
      display: clip,
      routineVideo: "media/reels/a.mp4",
      routineId: "routine_a",
      libraryVideoDurationS: 12,
    });
    expect(target).toEqual({ kind: "exercise-clip", meta: clip });
  });

  it("clears stale exercise media when opening a routine", () => {
    const state = createMediaFlowState("placeholder");
    state.draft.display = clipMeta("lex_old", "med_old", true);
    state.poseRemoveDraft = true;

    resetMediaFlowForRoutineNavigation(state, "placeholder");

    expect(state.draft.display).toBeNull();
    expect(state.poseRemoveDraft).toBe(false);
  });

  it("stores routine pose without changing an exercise clip pose", async () => {
    const exerciseId = "lex_keep";
    const clip = clipMeta(exerciseId, "med_keep", true);
    await putMediaMeta(clip);
    blobs.set(clip.fileKey, new Blob(["clip"]));
    blobs.set(clip.pose!.key, new Blob(["clip-pose"]));

    const routineId = "routine_save";
    const routinePose = await saveRoutineLibraryPose(
      routineId,
      new Blob(["routine-pose"]),
      {
        frames: 20,
        fps: 15,
        keyFrame: 0,
        createdAt: "2026-11-16T12:00:00.000Z",
        modelVersion: "test",
      },
      8,
    );

    const storedClip = await getMediaByExerciseId(exerciseId);
    const storedRoutine = await getRoutineLibraryPose(routineId);
    expect(storedClip?.pose?.key).toBe(clip.pose!.key);
    expect(storedRoutine?.pose.key).toBe(routinePose.key);
    expect(blobs.get(clip.pose!.key)).toBeTruthy();
    expect(blobs.get(routinePose.key)).toBeTruthy();
  });

  it("Remove animation on a routine clears its stored pose", async () => {
    const routineId = "routine_clear";
    const pose = await saveRoutineLibraryPose(
      routineId,
      new Blob(["routine-pose"]),
      {
        frames: 20,
        fps: 15,
        keyFrame: 0,
        createdAt: "2026-11-16T12:00:00.000Z",
        modelVersion: "test",
      },
      5,
    );
    expect(blobs.has(pose.key)).toBe(true);

    await clearRoutineLibraryPose(routineId);

    expect(await getRoutineLibraryPose(routineId)).toBeNull();
    expect(blobs.has(pose.key)).toBe(false);
  });

  it("recognizes library routine animation context on routine view", () => {
    expect(
      libraryRoutineAnimContextActive({
        view: "routine",
        routineVideo: "media/reels/a.mp4",
        libraryVideoDurationS: 10,
        hasUserClip: true,
      }),
    ).toBe(true);
    expect(
      libraryRoutineAnimContextActive({
        view: "library",
        routineVideo: "media/reels/a.mp4",
        libraryVideoDurationS: 10,
        hasUserClip: true,
      }),
    ).toBe(false);
  });
});