import { describe, expect, it } from "vitest";
import { mapLandmarksToSkeleton, frameHasPerson } from "../src/pose/joints";
import { shouldFailNoPerson } from "../src/pose/no-person";
import { processLandmarkFrames } from "../src/pose/process";
import { decodePoseClip, encodePoseClip } from "../src/pose/encode";
import { pickKeyFrame, unionBox } from "../src/pose/post-process";
import { emptyRoomLandmarks, syntheticClipLandmarks } from "./pose-fixtures";

describe("pose skeleton mapping", () => {
  it("maps a synthetic frame to 15 joints", () => {
    const frames = syntheticClipLandmarks(1);
    const sk = mapLandmarksToSkeleton(frames[0]!);
    expect(sk).not.toBeNull();
    expect(sk!.length).toBe(15);
    expect(frameHasPerson(frames[0]!)).toBe(true);
  });
});

describe("no-person thresholds", () => {
  it("fails when under half the frames have a person", () => {
    const landmarks = emptyRoomLandmarks();
    expect(
      shouldFailNoPerson({ landmarkFrames: landmarks, durationS: 4 }),
    ).toBe(true);
  });

  it("passes for a full synthetic clip", () => {
    const landmarks = syntheticClipLandmarks(120);
    expect(
      shouldFailNoPerson({ landmarkFrames: landmarks, durationS: 8 }),
    ).toBe(false);
  });
});

describe("pose processing", () => {
  it("encodes and decodes pose blob", async () => {
    const landmarks = syntheticClipLandmarks(45).map((f) => f);
    const result = processLandmarkFrames(landmarks, 3, "test");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const buf = await result.blob.arrayBuffer();
    const decoded = decodePoseClip(buf);
    expect(decoded.frames.length).toBe(result.frames);
    expect(decoded.header.keyFrame).toBeGreaterThanOrEqual(0);
    const box = unionBox(decoded.frames);
    expect(box.x1).toBeGreaterThan(box.x0);
    expect(pickKeyFrame(decoded.frames)).toBe(decoded.header.keyFrame);
    const re = encodePoseClip(decoded.header, decoded.frames);
    expect(re.size).toBeGreaterThan(100);
  });
});