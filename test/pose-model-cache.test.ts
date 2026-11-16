/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExerciseMediaMeta } from "../src/media/types";
import {
  isPoseModelCached,
  poseModelFileUrl,
  POSE_CACHE_NAME,
  clearPoseModelCache,
} from "../src/pose/model-cache";
import type { PoseModelManifest } from "../src/pose/model-manifest";
import {
  fetchPoseModelManifest,
  formatModelTotal,
  POSE_MANIFEST_CACHE_NAME,
  readSavedPoseModelManifest,
  savePoseModelManifestCopy,
} from "../src/pose/model-manifest";
import { modelSizeLabel } from "../src/pose/pose-job-service";
import * as modelDownload from "../src/pose/model-download";
import {
  cancelPoseJob,
  isModelOnDevice,
  startPoseJob,
  subscribePoseJob,
} from "../src/pose/pose-job-service";

const sampleManifest: PoseModelManifest = {
  version: "pose_landmarker_lite",
  totalBytes: 100,
  files: [
    { path: "pose_landmarker_lite.task", bytes: 60 },
    { path: "wasm/vision_wasm_internal.js", bytes: 40 },
  ],
};

function clipMeta(exerciseId: string): ExerciseMediaMeta {
  return {
    id: "med_clip",
    exerciseId,
    kind: "clip",
    width: 480,
    height: 360,
    durationS: 2,
    bytes: 500,
    posterKey: "med_clip.poster",
    fileKey: "med_clip.bin",
    createdAt: "2026-11-16T12:00:00.000Z",
  };
}

describe("pose model cache completeness", () => {
  const cacheStores = new Map<string, Map<string, Response>>();

  function storeFor(name: string): Map<string, Response> {
    let store = cacheStores.get(name);
    if (!store) {
      store = new Map();
      cacheStores.set(name, store);
    }
    return store;
  }

  beforeEach(() => {
    cacheStores.clear();
    indexedDB.deleteDatabase("fitness.media.meta.v1");
    vi.stubGlobal("caches", {
      open: async (name: string) => {
        const cacheStore = storeFor(name);
        return {
          match: async (req: string | Request) => {
            const url = typeof req === "string" ? req : req.url;
            return cacheStore.get(url);
          },
          put: async (req: string, res: Response) => {
            cacheStore.set(req, res);
          },
          keys: async () => [...cacheStore.keys()].map((url) => ({ url })),
        };
      },
      delete: async (name: string) => {
        cacheStores.delete(name);
        return true;
      },
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/manifest.json")) {
        return new Response(JSON.stringify(sampleManifest), { status: 200 });
      }
      return new Response("missing", { status: 404 });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports not on device when only a stray manifest entry is cached", async () => {
    const base = "https://example.test/models";
    storeFor(POSE_CACHE_NAME).set(`${base}/manifest.json`, new Response("{}"));

    expect(await isPoseModelCached(sampleManifest, base)).toBe(false);
    expect(await isModelOnDevice({ poseModelBaseUrl: base })).toBe(false);
  });

  it("startPoseJob downloads when the cache is incomplete but the UI assumed ready", async () => {
    const base = "https://example.test/models";
    storeFor(POSE_CACHE_NAME).set(`${base}/manifest.json`, new Response("{}"));

    const download = vi.spyOn(modelDownload, "downloadPoseModelFiles").mockResolvedValue();
    const phases: string[] = [];
    const unsub = subscribePoseJob((job) => {
      if (job) phases.push(job.phase);
    });

    await startPoseJob({ poseModelBaseUrl: base }, clipMeta("uex_dl"), "Squat", true);
    await cancelPoseJob();
    unsub();

    expect(phases[0]).toBe("downloading");
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("is on device when every manifest file url is in the cache", async () => {
    const base = "https://example.test/models";
    for (const file of sampleManifest.files) {
      const url = poseModelFileUrl(base, file.path);
      storeFor(POSE_CACHE_NAME).set(url, new Response("x"));
    }
    await savePoseModelManifestCopy(base, sampleManifest);

    expect(await isPoseModelCached(sampleManifest, base)).toBe(true);
    expect(await isModelOnDevice({ poseModelBaseUrl: base })).toBe(true);
  });

  it("can make animation when model files are cached and the network manifest fails", async () => {
    const base = "https://example.test/models";
    for (const file of sampleManifest.files) {
      storeFor(POSE_CACHE_NAME).set(poseModelFileUrl(base, file.path), new Response("x"));
    }
    await savePoseModelManifestCopy(base, sampleManifest);

    vi.mocked(globalThis.fetch).mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(await isModelOnDevice({ poseModelBaseUrl: base })).toBe(true);

    const download = vi.spyOn(modelDownload, "downloadPoseModelFiles").mockResolvedValue();
    const phases: string[] = [];
    const unsub = subscribePoseJob((job) => {
      if (job) phases.push(job.phase);
    });

    await startPoseJob({ poseModelBaseUrl: base }, clipMeta("uex_offline"), "Squat", true);
    await cancelPoseJob();
    unsub();

    expect(download).not.toHaveBeenCalled();
    expect(phases).toContain("processing");
    expect(phases).not.toContain("downloading");
    expect(phases).not.toContain("offline");
  });

  it("shows the stored manifest size when offline", async () => {
    const base = "https://example.test/models";
    await savePoseModelManifestCopy(base, sampleManifest);
    vi.mocked(globalThis.fetch).mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });

    const manifest = await fetchPoseModelManifest(base);
    expect(manifest?.totalBytes).toBe(sampleManifest.totalBytes);
    expect(modelSizeLabel(manifest)).toBe(formatModelTotal(sampleManifest));
  });

  it("clears the saved manifest when the pose model is removed", async () => {
    const base = "https://example.test/models";
    await savePoseModelManifestCopy(base, sampleManifest);
    storeFor(POSE_CACHE_NAME).set(poseModelFileUrl(base, "pose_landmarker_lite.task"), new Response("x"));

    await clearPoseModelCache();

    expect(await readSavedPoseModelManifest(base)).toBeNull();
    expect(storeFor(POSE_MANIFEST_CACHE_NAME).size).toBe(0);
  });
});