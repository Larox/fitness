/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { importMediaForExercise } from "../src/media/service";

const blobs = new Map<string, Blob>();

vi.mock("../src/media/file-store", () => ({
  writeMediaBlob: async (key: string, blob: Blob) => {
    blobs.set(key, blob);
  },
  deleteMediaBlob: async (key: string) => {
    blobs.delete(key);
  },
  estimateDeviceStorage: async () => ({ usage: 900, quota: 1000 }),
  requestPersistentStorage: async () => true,
}));

vi.mock("../src/media/meta-store", () => ({
  loadMediaSettings: async () => ({}),
  saveMediaSettings: async () => {},
}));

vi.mock("../src/media/clip-process", () => ({
  validateClipFile: () => Promise.resolve(),
  probeClipDuration: () => Promise.resolve(12),
  captureClipPoster: () =>
    Promise.resolve({ durationS: 12, poster: new Blob(["p"]), width: 100, height: 100 }),
}));

describe("media import", () => {
  it("storage-full leaves storage untouched", async () => {
    const file = new File([new Uint8Array(500)], "big.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "size", { value: 500 });
    await expect(importMediaForExercise("uex_1", file)).rejects.toThrow("storage-full");
    expect(blobs.size).toBe(0);
  });
});