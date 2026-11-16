export interface PoseModelManifest {
  version: string;
  totalBytes: number;
  files: { path: string; bytes: number }[];
}

export const POSE_MANIFEST_CACHE_NAME = "fitness-pose-manifest-v1";

function manifestStorageUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/manifest.json`;
}

export function formatModelTotal(manifest: PoseModelManifest): string {
  const mb = manifest.totalBytes / (1024 * 1024);
  if (mb >= 10) {
    return `${Math.round(mb)} MB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export async function savePoseModelManifestCopy(
  baseUrl: string,
  manifest: PoseModelManifest,
): Promise<void> {
  if (typeof caches === "undefined") return;
  const cache = await caches.open(POSE_MANIFEST_CACHE_NAME);
  await cache.put(
    manifestStorageUrl(baseUrl),
    new Response(JSON.stringify(manifest), {
      headers: { "Content-Type": "application/json" },
    }),
  );
}

export async function readSavedPoseModelManifest(baseUrl: string): Promise<PoseModelManifest | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(POSE_MANIFEST_CACHE_NAME);
  const res = await cache.match(manifestStorageUrl(baseUrl));
  if (!res?.ok) return null;
  try {
    const data = (await res.clone().json()) as PoseModelManifest;
    if (!data.totalBytes || !Array.isArray(data.files)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function fetchPoseModelManifest(baseUrl: string): Promise<PoseModelManifest | null> {
  const saved = await readSavedPoseModelManifest(baseUrl);
  try {
    const url = manifestStorageUrl(baseUrl);
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return saved;
    const data = (await res.json()) as PoseModelManifest;
    if (!data.totalBytes || !Array.isArray(data.files)) return saved;
    await savePoseModelManifestCopy(baseUrl, data);
    return data;
  } catch {
    return saved;
  }
}