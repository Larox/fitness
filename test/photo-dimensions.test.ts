import { describe, expect, it } from "vitest";
import { rejectOversizedPhotoSource } from "../src/media/photo-dimensions";

describe("photo dimensions guard", () => {
  it("rejects by file size before decode", async () => {
    const huge = new Blob([new Uint8Array(51 * 1024 * 1024)]);
    await expect(rejectOversizedPhotoSource(huge)).rejects.toThrow("source-too-large");
  });
});