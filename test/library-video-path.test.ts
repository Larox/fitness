import { describe, expect, it } from "vitest";
import { libraryVideoUrl, parseRoutineVideoPath } from "../src/library/video-path";

describe("parseRoutineVideoPath", () => {
  it("accepts a normal relative path", () => {
    expect(parseRoutineVideoPath("media/reels/id.mp4", "video")).toEqual({
      ok: true,
      path: "media/reels/id.mp4",
    });
  });

  it("rejects absolute URLs and parent segments", () => {
    expect(parseRoutineVideoPath("https://example.com/a.mp4", "video").ok).toBe(false);
    expect(parseRoutineVideoPath("/media/a.mp4", "video").ok).toBe(false);
    expect(parseRoutineVideoPath("media/../secret.mp4", "video").ok).toBe(false);
    expect(parseRoutineVideoPath("file://local.mp4", "video").ok).toBe(false);
  });

  it("maps deploy paths to same-origin URLs", () => {
    expect(libraryVideoUrl("media/reels/id.mp4")).toBe("/media/reels/id.mp4");
  });
});