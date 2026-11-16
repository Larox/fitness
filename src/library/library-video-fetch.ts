import { libraryVideoUrl } from "./video-path";

export async function fetchLibraryVideoBlob(relativePath: string): Promise<Blob | null> {
  try {
    const response = await fetch(libraryVideoUrl(relativePath));
    if (!response.ok) {
      return null;
    }
    return await response.blob();
  } catch {
    return null;
  }
}

export function probeLibraryVideoDuration(relativePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const url = libraryVideoUrl(relativePath);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const done = (value: number | null) => {
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };
    video.addEventListener(
      "loadedmetadata",
      () => {
        const duration = video.duration;
        if (!Number.isFinite(duration) || duration <= 0) {
          done(null);
          return;
        }
        done(duration);
      },
      { once: true },
    );
    video.addEventListener("error", () => done(null), { once: true });
    video.src = url;
    video.load();
  });
}