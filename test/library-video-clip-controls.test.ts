/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  renderLibraryClipControls,
  shouldShowClipReset,
} from "../src/library/library-video-clip-controls";

describe("library video clip controls", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { value: 360, configurable: true });
  });

  it("hides reset when there is no library segment and no override", () => {
    expect(shouldShowClipReset(false, false)).toBe(false);
    const html = renderLibraryClipControls({
      segment: {
        startS: 0,
        endS: 60,
        spanS: 60,
        usesFullVideo: true,
      },
      hasDeviceOverride: false,
      hasLibraryTimes: false,
      fullDurationS: 60,
      scrubTimeS: 0,
      videoReady: true,
    });
    expect(html).not.toContain("clip-reset");
  });

  it("shows scrubber and 44px-friendly controls at 360px viewport", () => {
    const html = renderLibraryClipControls({
      segment: { startS: 2, endS: 8, spanS: 6, usesFullVideo: false },
      hasDeviceOverride: true,
      hasLibraryTimes: true,
      fullDurationS: 39,
      scrubTimeS: 5,
      videoReady: true,
      paused: true,
    });
    expect(html).toContain('type="range"');
    expect(html).toContain('data-act="clip-scrub"');
    expect(html).toContain('max="39"');
    expect(html).not.toContain("Looping");
    expect(html).toContain("Segment 0:02 – 0:08");
  });

  it("omits looping line when reduced motion is requested", () => {
    const html = renderLibraryClipControls({
      segment: { startS: 2, endS: 8, spanS: 6, usesFullVideo: false },
      hasDeviceOverride: false,
      hasLibraryTimes: true,
      reducedMotion: true,
      fullDurationS: 60,
      videoReady: false,
    });
    expect(html).not.toContain("Segment");
    expect(html).toContain("disabled");
  });
});