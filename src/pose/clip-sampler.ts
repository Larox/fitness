import { frameCountForDuration, POSE_SAMPLE_FPS } from "./no-person";
import type { MpLandmark } from "./joints";
import type { PoseDetector } from "./detect";

export async function sampleClipLandmarks(
  videoBlob: Blob,
  durationS: number,
  detector: PoseDetector,
  onFrame: (frame: number, total: number) => void,
  signal: AbortSignal,
  segmentStartS = 0,
): Promise<(MpLandmark[] | null)[]> {
  const url = URL.createObjectURL(videoBlob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("video-decode"));
  });
  const total = frameCountForDuration(durationS);
  const out: (MpLandmark[] | null)[] = [];
  let lastUi = 0;
  for (let i = 0; i < total; i++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const t = segmentStartS + i / POSE_SAMPLE_FPS;
    const maxT = segmentStartS + Math.max(0, durationS - 0.001);
    video.currentTime = Math.min(t, maxT);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(video, { resizeWidth: 480, resizeQuality: "medium" });
      const lm = await detector.detect(bitmap, Math.round(i * (1000 / POSE_SAMPLE_FPS)));
      out.push(lm);
    } catch {
      out.push(null);
    } finally {
      bitmap?.close();
    }
    const now = performance.now();
    if (now - lastUi > 250) {
      onFrame(i + 1, total);
      lastUi = now;
    }
    if (i % 4 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  URL.revokeObjectURL(url);
  video.remove();
  return out;
}