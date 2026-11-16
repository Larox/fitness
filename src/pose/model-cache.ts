export const POSE_CACHE_NAME = "fitness-pose-v1";

export async function isPoseModelCached(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  const cache = await caches.open(POSE_CACHE_NAME);
  const keys = await cache.keys();
  return keys.length > 0;
}

export async function clearPoseModelCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  await caches.delete(POSE_CACHE_NAME);
}

export async function poseModelCachedBytes(): Promise<number> {
  if (typeof caches === "undefined") return 0;
  const cache = await caches.open(POSE_CACHE_NAME);
  const keys = await cache.keys();
  let total = 0;
  for (const req of keys) {
    const res = await cache.match(req);
    if (!res) continue;
    const len = res.headers.get("content-length");
    if (len) {
      total += Number(len);
    } else {
      const buf = await res.clone().arrayBuffer();
      total += buf.byteLength;
    }
  }
  return total;
}

export async function writePoseModelToCache(
  files: { url: string; blob: Blob }[],
): Promise<void> {
  if (typeof caches === "undefined") {
    throw new Error("cache-unavailable");
  }
  const cache = await caches.open(POSE_CACHE_NAME);
  await Promise.all(
    files.map(async ({ url, blob }) => {
      await cache.put(url, new Response(blob));
    }),
  );
}

export async function readPoseModelFromCache(url: string): Promise<Response | undefined> {
  if (typeof caches === "undefined") return undefined;
  const cache = await caches.open(POSE_CACHE_NAME);
  return cache.match(url);
}