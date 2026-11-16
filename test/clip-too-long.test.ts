/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { probeClipDuration } from "../src/media/clip-process";

describe("clip too long error", () => {
  it("includes measured duration on the error", async () => {
    const blob = new Blob(["x"], { type: "video/mp4" });
    vi.stubGlobal(
      "URL",
      { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
    );
  const videoProto = HTMLVideoElement.prototype;
  const listen = vi
      .spyOn(videoProto, "addEventListener")
      .mockImplementation(function (this: HTMLVideoElement, type, listener) {
        if (type === "loadedmetadata" && typeof listener === "function") {
          Object.defineProperty(this, "duration", { value: 48 });
          listener.call(this, new Event("loadedmetadata"));
        }
      });

    await expect(probeClipDuration(blob)).rejects.toMatchObject({
      message: "too-long",
      durationS: 48,
    });
    listen.mockRestore();
  });
});