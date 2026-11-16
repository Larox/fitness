import { mapLandmarksToSkeleton, type MpLandmark } from "./joints";
import { encodePoseClip } from "./encode";
import { frameCountForDuration, shouldFailNoPerson } from "./no-person";
import {
  blendLoopSeam,
  fillGaps,
  headRadiusMedian,
  pickKeyFrame,
  smoothFrames,
  unionBox,
} from "./post-process";
import type { PoseClipHeader } from "./joints";

export type PoseProcessFailure = "no-person" | "empty";

export interface PoseProcessResult {
  ok: true;
  blob: Blob;
  frames: number;
  keyFrame: number;
  headRadius: number;
}

export interface PoseProcessError {
  ok: false;
  reason: PoseProcessFailure;
}

export function processLandmarkFrames(
  landmarkFrames: (MpLandmark[] | null)[],
  durationS: number,
  modelVersion: string,
): PoseProcessResult | PoseProcessError {
  if (shouldFailNoPerson({ landmarkFrames, durationS })) {
    return { ok: false, reason: "no-person" };
  }
  const skeletons = landmarkFrames
    .map((lm) => mapLandmarksToSkeleton(lm))
    .filter((f): f is NonNullable<typeof f> => f !== null);
  if (skeletons.length === 0) {
    return { ok: false, reason: "empty" };
  }
  let frames = fillGaps(skeletons);
  frames = smoothFrames(frames);
  frames = blendLoopSeam(frames);
  const box = unionBox(frames);
  const keyFrame = pickKeyFrame(frames);
  const headRadius = headRadiusMedian(frames);
  const expected = frameCountForDuration(durationS);
  const header: PoseClipHeader = {
    v: 1,
    fps: 15,
    frames: frames.length,
    joints: [],
    box,
    keyFrame,
    modelVersion,
    createdAt: new Date().toISOString(),
  };
  const blob = encodePoseClip(header, frames);
  void expected;
  return {
    ok: true,
    blob,
    frames: frames.length,
    keyFrame,
    headRadius,
  };
}