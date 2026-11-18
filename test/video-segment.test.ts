import { describe, expect, it } from "vitest";
import {
  libraryVideoUrlWithFragment,
  mergeClipTimes,
  resolveExerciseVideoSegment,
} from "../src/library/video-segment";

describe("resolveExerciseVideoSegment", () => {
  const duration = 60;

  it("uses library times when valid", () => {
    const result = resolveExerciseVideoSegment(
      { startS: 5, endS: 15 },
      undefined,
      duration,
    );
    expect(result).toEqual({
      startS: 5,
      endS: 15,
      spanS: 10,
      usesFullVideo: false,
    });
    expect(libraryVideoUrlWithFragment("media/reels/a.mp4", result!)).toBe(
      "/media/reels/a.mp4#t=5,15",
    );
  });

  it("prefers device override over library times", () => {
    const result = resolveExerciseVideoSegment(
      { startS: 1, endS: 9 },
      { startS: 4, endS: 12 },
      duration,
    );
    expect(result?.startS).toBe(4);
    expect(result?.endS).toBe(12);
  });

  it("merges partial device override onto library", () => {
    expect(mergeClipTimes({ startS: 2, endS: 8 }, { startS: 3 })).toEqual({
      startS: 3,
      endS: 8,
    });
  });

  it("falls back to full video when pair is missing", () => {
    const result = resolveExerciseVideoSegment({ startS: 5 }, undefined, duration);
    expect(result?.usesFullVideo).toBe(true);
    expect(result?.startS).toBe(0);
    expect(result?.endS).toBe(60);
  });

  it("falls back when start and end are reversed or negative", () => {
    expect(resolveExerciseVideoSegment({ startS: 20, endS: 10 }, undefined, duration)?.usesFullVideo).toBe(
      true,
    );
    expect(resolveExerciseVideoSegment({ startS: -1, endS: 5 }, undefined, duration)?.usesFullVideo).toBe(
      true,
    );
  });

  it("keeps a valid pair when duration is not known yet", () => {
    expect(resolveExerciseVideoSegment({ startS: 1, endS: 2 }, undefined, null)).toEqual({
      startS: 1,
      endS: 2,
      spanS: 1,
      usesFullVideo: false,
    });
  });

  it("returns full span when no times are set", () => {
    const result = resolveExerciseVideoSegment(undefined, undefined, duration);
    expect(result?.usesFullVideo).toBe(true);
    expect(result?.spanS).toBe(60);
  });
});