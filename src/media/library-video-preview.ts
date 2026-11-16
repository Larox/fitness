import "./media.css";
import { libraryVideoUrl } from "../library/video-path";

export interface MountLibraryVideoPreviewOptions {
  root: HTMLElement;
  relativePath: string;
  ariaLabel: string;
  belowHtml?: string;
}

/** Inline muted looping preview for deploy-served library routine video. */
export class LibraryVideoPreview {
  private video: HTMLVideoElement | null = null;
  private ok = false;

  constructor(private readonly options: MountLibraryVideoPreviewOptions) {}

  async mount(): Promise<boolean> {
    const { root, relativePath, ariaLabel, belowHtml = "" } = this.options;
    const url = libraryVideoUrl(relativePath);
    root.innerHTML = `<div class="media-frame today-media library-routine-video" data-library-video="1">
      <video class="media-cover" playsinline muted loop preload="metadata" aria-label="${escapeAttr(ariaLabel)}"></video>
    </div>${belowHtml}`;
    const video = root.querySelector<HTMLVideoElement>("video");
    if (!video) {
      return false;
    }
    this.video = video;
    const ready = await new Promise<boolean>((resolve) => {
      const finish = (ok: boolean) => {
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("error", onErr);
        resolve(ok);
      };
      const onReady = () => finish(true);
      const onErr = () => finish(false);
      video.addEventListener("loadeddata", onReady, { once: true });
      video.addEventListener("error", onErr, { once: true });
      video.src = url;
      video.load();
    });
    if (!ready) {
      root.innerHTML = belowHtml;
      this.video = null;
      return false;
    }
    this.ok = true;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    try {
      await video.play();
    } catch {
      /* autoplay may be blocked; inline frame still shows first frame */
    }
    return true;
  }

  isPlaying(): boolean {
    return this.ok;
  }

  destroy(): void {
    this.video?.pause();
    if (this.video) {
      this.video.removeAttribute("src");
      this.video.load();
    }
    this.video = null;
    this.ok = false;
  }
}

function escapeAttr(text: string): string {
  return text.replaceAll('"', "&quot;");
}

export async function mountLibraryVideoPreview(
  options: MountLibraryVideoPreviewOptions,
): Promise<LibraryVideoPreview> {
  const preview = new LibraryVideoPreview(options);
  await preview.mount();
  return preview;
}