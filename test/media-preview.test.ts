/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountTodayMediaPreview } from "../src/media/preview";
import type { ExerciseMediaMeta } from "../src/media/types";

const meta: ExerciseMediaMeta = {
  id: "med_clip",
  exerciseId: "uex_1",
  kind: "clip",
  width: 320,
  height: 240,
  durationS: 12,
  bytes: 5000,
  posterKey: "poster",
  fileKey: "clip.bin",
  createdAt: "2026-11-16T12:00:00.000Z",
};

vi.mock("../src/media/service", () => ({
  readPosterBlob: async () => new Blob(["thumb"], { type: "image/jpeg" }),
  readMediaFileBlob: async () => new Blob(["clip"], { type: "video/mp4" }),
}));

describe("Today media preview component", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:preview-test",
      revokeObjectURL: () => {},
    });
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
    vi.restoreAllMocks();
  });

  it("keeps cues and the source link when there is no media", async () => {
    const preview = await mountTodayMediaPreview({
      root,
      exerciseName: "Wall sit",
      meta: null,
      cuesHtml: "<p class='cue'>Stay tall</p>",
      sourceLinkHtml: "<a href='https://example.com'>Watch on example.com</a>",
    });
    expect(root.textContent).toContain("Stay tall");
    expect(root.textContent).toContain("example.com");
    preview.destroy();
  });

  it("shows a quiet missing row when the file is gone", async () => {
    const preview = await mountTodayMediaPreview({
      root,
      exerciseName: "Farmer carry",
      meta,
      fileMissing: true,
      cuesHtml: "<p class='cue'>Grip tight</p>",
    });
    expect(root.textContent).toContain("isn't on this phone anymore");
    expect(root.textContent).toContain("Grip tight");
    preview.destroy();
  });

  it("under reduced motion plays once and returns to Replay", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }),
    );
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    const preview = await mountTodayMediaPreview({
      root,
      exerciseName: "Gentle march",
      meta,
    });
    const play = root.querySelector<HTMLButtonElement>("[data-act=media-play]");
    play?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const video = root.querySelector("video");
    expect(video?.hasAttribute("loop")).toBe(false);
    video?.dispatchEvent(new Event("ended"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const replay = root.querySelector<HTMLButtonElement>("[data-act=media-play]");
    expect(replay?.getAttribute("aria-label") ?? "").toContain("Replay");
    preview.destroy();
  });
});