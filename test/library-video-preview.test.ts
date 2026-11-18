/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachSegmentLoop, mountLibraryVideoPreview } from "../src/media/library-video-preview";

describe("library routine video preview", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
    vi.restoreAllMocks();
  });

  it("renders an inline muted looping video when metadata loads", async () => {
    const proto = HTMLVideoElement.prototype;
    vi.spyOn(proto, "load").mockImplementation(function (this: HTMLVideoElement) {
      this.dispatchEvent(new Event("loadeddata"));
    });
    vi.spyOn(proto, "play").mockResolvedValue(undefined);

    const preview = await mountLibraryVideoPreview({
      root,
      relativePath: "media/reels/fixture_one.mp4",
      ariaLabel: "Routine preview",
    });

    const video = root.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("playsinline")).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.preload).toBe("metadata");
    expect(video?.getAttribute("src")).toBe("/media/reels/fixture_one.mp4");
    expect(preview.isPlaying()).toBe(true);
    preview.destroy();
  });

  it("falls back quietly when the video fails to load", async () => {
    const proto = HTMLVideoElement.prototype;
    vi.spyOn(proto, "load").mockImplementation(function (this: HTMLVideoElement) {
      this.dispatchEvent(new Event("error"));
    });

    const preview = await mountLibraryVideoPreview({
      root,
      relativePath: "media/reels/missing.mp4",
      ariaLabel: "Routine preview",
      belowHtml: "<p class='cue'>Cues stay</p>",
    });

    expect(root.querySelector("video")).toBeNull();
    expect(root.textContent).toContain("Cues stay");
    expect(preview.isPlaying()).toBe(false);
    preview.destroy();
  });

  it("loops within a segment via timeupdate", async () => {
    const proto = HTMLVideoElement.prototype;
    vi.spyOn(proto, "load").mockImplementation(function (this: HTMLVideoElement) {
      this.dispatchEvent(new Event("loadeddata"));
    });
    vi.spyOn(proto, "play").mockResolvedValue(undefined);

    const video = document.createElement("video");
    const segment = { startS: 2, endS: 5, spanS: 3, usesFullVideo: false };
    const onLoop = attachSegmentLoop(video, segment, false);
    video.currentTime = 4.96;
    video.dispatchEvent(new Event("timeupdate"));
    expect(video.currentTime).toBe(2);
    video.removeEventListener("timeupdate", onLoop);

    const preview = await mountLibraryVideoPreview({
      root,
      relativePath: "media/reels/fixture_one.mp4",
      ariaLabel: "Segment preview",
      segment,
    });
    const mounted = root.querySelector("video");
    expect(mounted?.getAttribute("src")).toBe("/media/reels/fixture_one.mp4#t=2,5");
    expect(mounted?.loop).toBe(false);
    preview.destroy();
  });

  it("uses full reel without autoplay when editing clip bounds", async () => {
    const proto = HTMLVideoElement.prototype;
    vi.spyOn(proto, "load").mockImplementation(function (this: HTMLVideoElement) {
      this.dispatchEvent(new Event("loadeddata"));
    });
    vi.spyOn(proto, "play").mockResolvedValue(undefined);

    const preview = await mountLibraryVideoPreview({
      root,
      relativePath: "media/reels/fixture_one.mp4",
      ariaLabel: "Edit clip",
      segment: { startS: 5, endS: 10, spanS: 5, usesFullVideo: false },
      editingClip: true,
      autoplay: false,
      initialTimeS: 7,
    });

    const video = root.querySelector("video");
    expect(video?.getAttribute("src")).toBe("/media/reels/fixture_one.mp4");
    expect(video?.paused).toBe(true);
    expect(video?.currentTime).toBe(7);
    expect(vi.mocked(proto.play)).not.toHaveBeenCalled();
    preview.destroy();
  });
});