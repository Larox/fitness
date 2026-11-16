import { readPoseModelFromCache } from "./model-cache";

export interface ResolvedPoseModelUrls {
  wasmBaseUrl: string;
  modelUrl: string;
  /** Revoke blob URLs created for the .task file. */
  revoke: () => void;
}

const WASM_JS = "vision_wasm_internal.js";

/**
 * Resolve MediaPipe asset URLs. The .task file uses a blob URL when it is already
 * in Cache Storage (avoids a second network fetch). WASM loads from /models/wasm/
 * and is served cache-first by the service worker after the one-time download.
 */
export async function resolvePoseModelUrls(baseUrl: string): Promise<ResolvedPoseModelUrls> {
  const base = baseUrl.replace(/\/$/, "");
  const modelNetwork = `${base}/pose_landmarker_lite.task`;
  const wasmBaseNetwork = `${base}/wasm`;

  const blobsToRevoke: string[] = [];
  const revoke = () => {
    for (const url of blobsToRevoke) {
      URL.revokeObjectURL(url);
    }
  };

  const modelRes = await readPoseModelFromCache(modelNetwork);
  let modelUrl = modelNetwork;
  if (modelRes) {
    modelUrl = URL.createObjectURL(await modelRes.blob());
    blobsToRevoke.push(modelUrl);
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const wasmJs = await readPoseModelFromCache(`${wasmBaseNetwork}/${WASM_JS}`);
    if (!modelRes || !wasmJs) {
      throw new Error("pose-model-offline");
    }
  }

  return { wasmBaseUrl: wasmBaseNetwork, modelUrl, revoke };
}

export async function isPoseModelAvailableOffline(baseUrl: string): Promise<boolean> {
  const base = baseUrl.replace(/\/$/, "");
  const model = await readPoseModelFromCache(`${base}/pose_landmarker_lite.task`);
  const wasmJs = await readPoseModelFromCache(`${base}/wasm/${WASM_JS}`);
  return Boolean(model && wasmJs);
}