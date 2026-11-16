import { describe, expect, it } from "vitest";
import { renderLibraryVideoSection } from "../src/library/library-video-section";
import { shouldShowLibraryRoutineVideo } from "../src/library/library-video-visibility";
import type { NormalizedRoutine } from "../src/library/types";

const routine: NormalizedRoutine = {
  id: "routine_a",
  title: "Routine A",
  source: "https://example.com/watch",
  video: "media/reels/a.mp4",
  categories: ["mobility"],
  equipment: [],
  frequency: null,
  durationMin: null,
  difficulty: null,
  conditionRisks: { concern_a: "low", concern_b: "low" },
  exerciseIds: ["ex_one"],
};

describe("library video visibility", () => {
  it("hides routine video on a library exercise when the user attached media", () => {
    expect(
      shouldShowLibraryRoutineVideo("media/reels/a.mp4", true, "library-exercise"),
    ).toBe(false);
    expect(
      shouldShowLibraryRoutineVideo("media/reels/a.mp4", false, "library-exercise"),
    ).toBe(true);
    expect(shouldShowLibraryRoutineVideo("media/reels/a.mp4", true, "routine")).toBe(
      true,
    );
  });
});

describe("library video section", () => {
  it("renders preview markup when a video path and duration are known", () => {
    const html = renderLibraryVideoSection({
      routine,
      durationS: 12,
      job: null,
      modelOnDevice: true,
      modelCached: true,
      unfinished: false,
      formAnimView: "clip",
    });
    expect(html).toContain('id="library-video-mount"');
    expect(html).toContain("Watch on example.com");
    expect(html).toContain("Make a stick-figure animation");
  });

  it("omits preview when duration is unknown (missing media)", () => {
    const html = renderLibraryVideoSection({
      routine,
      durationS: null,
      job: null,
      modelOnDevice: false,
      modelCached: false,
      unfinished: false,
      formAnimView: "clip",
    });
    expect(html).not.toContain("library-video-mount");
    expect(html).toContain("Watch on example.com");
  });

  it("skips routine video path when duration is null even with video field set", () => {
    const noVideo: NormalizedRoutine = { ...routine, video: undefined };
    const html = renderLibraryVideoSection({
      routine: noVideo,
      durationS: 12,
      job: null,
      modelOnDevice: true,
      modelCached: true,
      unfinished: false,
      formAnimView: "clip",
    });
    expect(html).not.toContain("library-video-mount");
  });
});