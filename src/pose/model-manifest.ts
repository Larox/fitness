export interface PoseModelManifest {
  version: string;
  totalBytes: number;
  files: { path: string; bytes: number }[];
}

export function formatModelTotal(manifest: PoseModelManifest): string {
  const mb = manifest.totalBytes / (1024 * 1024);
  if (mb >= 10) {
    return `${Math.round(mb)} MB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export async function fetchPoseModelManifest(baseUrl: string): Promise<PoseModelManifest | null> {
  try {
    const url = `${baseUrl.replace(/\/$/, "")}/manifest.json`;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as PoseModelManifest;
    if (!data.totalBytes || !Array.isArray(data.files)) return null;
    return data;
  } catch {
    return null;
  }
}