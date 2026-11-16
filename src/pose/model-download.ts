import type { PoseModelManifest } from "./model-manifest";
import { writePoseModelToCache } from "./model-cache";

const STALL_MS = 30_000;

export type PoseDownloadAbort = AbortSignal;

export async function downloadPoseModelFiles(
  baseUrl: string,
  manifest: PoseModelManifest,
  onProgress: (loaded: number, total: number) => void,
  signal: PoseDownloadAbort,
): Promise<void> {
  const total = manifest.totalBytes || manifest.files.reduce((s, f) => s + f.bytes, 0);
  let loaded = 0;
  const blobs: { url: string; blob: Blob }[] = [];
  for (const file of manifest.files) {
    const path = file.path.replace(/^\//, "");
    const url = `${baseUrl.replace(/\/$/, "")}/${path}`;
    let lastByteAt = Date.now();
    const stallTimer = setInterval(() => {
      if (Date.now() - lastByteAt > STALL_MS && !signal.aborted) {
        clearInterval(stallTimer);
      }
    }, 1000);
    try {
      const res = await fetch(url, { signal });
      if (!res.ok || !res.body) {
        throw new Error("download-failed");
      }
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.byteLength;
          lastByteAt = Date.now();
          onProgress(loaded, total);
        }
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      }
      const merged = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
      let off = 0;
      for (const c of chunks) {
        merged.set(c, off);
        off += c.length;
      }
      blobs.push({ url, blob: new Blob([merged]) });
    } finally {
      clearInterval(stallTimer);
    }
  }
  await writePoseModelToCache(blobs);
}