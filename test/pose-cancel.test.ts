import { describe, expect, it, vi } from "vitest";
import { cancelPoseJob, getPoseJob, subscribePoseJob } from "../src/pose/pose-job-service";

describe("pose job cancel", () => {
  it("returns to offer phase on cancel", async () => {
    const seen: string[] = [];
    const unsub = subscribePoseJob((s) => {
      if (s) seen.push(s.phase);
    });
    vi.stubGlobal(
      "caches",
      {
        open: async () => ({ keys: async () => [], put: async () => {}, match: async () => undefined }),
        delete: async () => true,
      },
    );
    await cancelPoseJob();
    unsub();
    expect(getPoseJob()).toBeNull();
    expect(seen).toEqual([]);
  });
});