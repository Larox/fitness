import "./media.css";
import {
  libraryVideoUrlWithFragment,
  type ResolvedVideoSegment,
} from "../library/video-segment";

export interface MountLibraryVideoPreviewOptions {
  root: HTMLElement;
  relativePath: string;
  ariaLabel: string;
  belowHtml?: string;
  segment?: ResolvedVideoSegment | null;
  reducedMotion?: boolean;
  /** Full-reel scrub while editing clip bounds (no fragment, no segment loop). */
  editingClip?: boolean;
  autoplay?: boolean;
  initialTimeS?: number;
}

export interface LibraryVideoPreviewHandle {
  getVideo(): HTMLVideoElement | null;
  isPlaying(): boolean;
  destroy(): void;
}

/** Inline muted looping preview for deploy-served library routine video. */
export class LibraryVideoPreview implements LibraryVideoPreviewHandle {
  private video: HTMLVideoElement | null = null;
  private ok = false;
  private onSegmentLoop: (() => void) | null = null;

  constructor(private readonly options: MountLibraryVideoPreviewOptions) {}

  async mount(): Promise<boolean> {
    const {
      root,
      relativePath,
      ariaLabel,
      belowHtml = "",
      segment = null,
      reducedMotion = false,
      editingClip = false,
      autoplay = true,
      initialTimeS,
    } = this.options;
    const playbackSegment = editingClip ? null : segment;
    const url = playbackSegment
      ? libraryVideoUrlWithFragment(relativePath, playbackSegment)
      : libraryVideoUrlWithFragment(relativePath, {
          startS: 0,
          endS: 0,
          usesFullVideo: true,
        });
    const loopAttr =
      editingClip || (playbackSegment && !playbackSegment.usesFullVideo && !reducedMotion)
        ? ""
        : " loop";
    root.innerHTML = `<div class="media-frame today-media library-routine-video" data-library-video="1">
      <video class="media-cover" playsinline muted${loopAttr} preload="metadata" aria-label="${escapeAttr(ariaLabel)}"></video>
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
    if (editingClip) {
      video.loop = false;
      const seek =
        typeof initialTimeS === "number" && Number.isFinite(initialTimeS) && initialTimeS >= 0
          ? initialTimeS
          : 0;
      video.currentTime = seek;
      if (!autoplay) {
        video.pause();
      }
    } else if (!playbackSegment || playbackSegment.usesFullVideo) {
      video.loop = !reducedMotion && !editingClip;
      if (typeof initialTimeS === "number" && Number.isFinite(initialTimeS)) {
        video.currentTime = initialTimeS;
      }
    } else {
      video.loop = false;
      this.onSegmentLoop = attachSegmentLoop(video, playbackSegment, reducedMotion);
      video.currentTime =
        typeof initialTimeS === "number" && Number.isFinite(initialTimeS)
          ? initialTimeS
          : playbackSegment.startS;
    }
    if (autoplay) {
      try {
        await video.play();
      } catch {
        /* autoplay may be blocked; inline frame still shows first frame */
      }
    }
    return true;
  }

  getVideo(): HTMLVideoElement | null {
    return this.video;
  }

  isPlaying(): boolean {
    return this.ok;
  }

  destroy(): void {
    if (this.onSegmentLoop && this.video) {
      this.video.removeEventListener("timeupdate", this.onSegmentLoop);
    }
    this.onSegmentLoop = null;
    this.video?.pause();
    if (this.video) {
      this.video.removeAttribute("src");
      this.video.load();
    }
    this.video = null;
    this.ok = false;
  }
}

export function attachSegmentLoop(
  video: HTMLVideoElement,
  segment: Pick<ResolvedVideoSegment, "startS" | "endS">,
  reducedMotion: boolean,
): () => void {
  const epsilon = 0.05;
  const onTimeUpdate = () => {
    if (reducedMotion) {
      return;
    }
    if (video.currentTime >= segment.endS - epsilon) {
      video.currentTime = segment.startS;
      void video.play().catch(() => undefined);
    }
  };
  video.addEventListener("timeupdate", onTimeUpdate);
  return onTimeUpdate;
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