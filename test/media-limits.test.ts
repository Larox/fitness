import { describe, expect, it } from "vitest";
import {
  CLIP_MAX_BYTES,
  CLIP_MAX_DURATION_S,
  clipTooBig,
  clipTooLong,
  hasStorageForNewFile,
  photoSourceTooLarge,
} from "../src/media/limits";

describe("media limits", () => {
  it("rejects clips over 25 MB", () => {
    expect(clipTooBig(CLIP_MAX_BYTES + 1)).toBe(true);
    expect(clipTooBig(CLIP_MAX_BYTES)).toBe(false);
  });

  it("rejects clips over 30.5 s", () => {
    expect(clipTooLong(CLIP_MAX_DURATION_S + 0.1)).toBe(true);
    expect(clipTooLong(30)).toBe(false);
  });

  it("rejects huge photo sources before decode", () => {
    expect(photoSourceTooLarge(60 * 1024 * 1024, 1000, 1000)).toBe(true);
    expect(photoSourceTooLarge(1_000_000, 9000, 9000)).toBe(true);
    expect(photoSourceTooLarge(1_000_000, 3000, 3000)).toBe(false);
  });

  it("requires quota headroom before import", () => {
    expect(hasStorageForNewFile(180, 200, 50)).toBe(false);
    expect(hasStorageForNewFile(50, 200, 50)).toBe(true);
  });
});