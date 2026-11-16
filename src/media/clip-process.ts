import { clipTooBig, clipTooLong } from "./limits";
import { PHOTO_JPEG_QUALITY, PHOTO_THUMB_LONG_EDGE } from "./limits";
import { scaleToLongEdge } from "./format";

export interface ProcessedClipMeta {
  durationS: number;
  poster: Blob;
  width: number;
  height: number;
}

export async function validateClipFile(file: Blob): Promise<void> {
  if (clipTooBig(file.size)) {
    throw new Error("too-big");
  }
}

export function probeClipDuration(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    video.addEventListener(
      "loadedmetadata",
      () => {
        const duration = video.duration;
        cleanup();
        if (!Number.isFinite(duration) || duration <= 0) {
          reject(new Error("unsupported-format"));
          return;
        }
        if (clipTooLong(duration)) {
          const err = new Error("too-long") as Error & { durationS: number };
          err.durationS = duration;
          reject(err);
          return;
        }
        resolve(duration);
      },
      { once: true },
    );
    video.addEventListener(
      "error",
      () => {
        cleanup();
        reject(new Error("unsupported-format"));
      },
      { once: true },
    );
    video.src = url;
  });
}

export async function captureClipPoster(file: Blob, durationS: number): Promise<ProcessedClipMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    const onMeta = () => {
      const seekTo = Math.min(1, durationS / 2);
      video.currentTime = seekTo;
    };
    const onSeeked = async () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) {
          throw new Error("unsupported-format");
        }
        const sized = scaleToLongEdge(w, h, PHOTO_THUMB_LONG_EDGE);
        const canvas = document.createElement("canvas");
        canvas.width = sized.width;
        canvas.height = sized.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("unsupported-format");
        }
        ctx.drawImage(video, 0, 0, sized.width, sized.height);
        const poster = await new Promise<Blob>((res, rej) => {
          canvas.toBlob(
            (blob) => (blob ? res(blob) : rej(new Error("unsupported-format"))),
            "image/jpeg",
            PHOTO_JPEG_QUALITY,
          );
        });
        cleanup();
        resolve({ durationS, poster, width: w, height: h });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
    video.addEventListener("loadedmetadata", onMeta, { once: true });
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener(
      "error",
      () => {
        cleanup();
        reject(new Error("unsupported-format"));
      },
      { once: true },
    );
    video.src = url;
  });
}