import "./media.css";
import { formatDurationMmSs } from "./format";
import type { ExerciseMediaMeta } from "./types";
import { readMediaFileBlob, readPosterBlob } from "./service";

export type TodayMediaState = "none" | "photo" | "clip" | "playing" | "missing";

export interface MountMediaPreviewOptions {
  root: HTMLElement;
  exerciseName: string;
  meta: ExerciseMediaMeta | null;
  fileMissing?: boolean;
  cuesHtml?: string;
  sourceLinkHtml?: string;
  cautionHtml?: string;
  collapsedThumb?: boolean;
  onPauseClip?: () => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export class ExerciseMediaPreview {
  private posterUrl: string | null = null;
  private fileUrl: string | null = null;
  private playing = false;
  private ended = false;
  private muted = true;
  private video: HTMLVideoElement | null = null;
  private readonly reducedMotion: boolean;

  constructor(private readonly options: MountMediaPreviewOptions) {
    this.reducedMotion = prefersReducedMotion();
  }

  async load(): Promise<TodayMediaState> {
    if (this.options.fileMissing && this.options.meta) {
      return "missing";
    }
    if (!this.options.meta) {
      return "none";
    }
    const poster = await readPosterBlob(this.options.meta);
    if (!poster) {
      return "missing";
    }
    this.posterUrl = URL.createObjectURL(poster);
    return this.options.meta.kind === "clip" ? "clip" : "photo";
  }

  render(state: TodayMediaState): void {
    const { root, exerciseName, meta, cuesHtml = "", sourceLinkHtml = "", cautionHtml = "" } =
      this.options;
    if (state === "none") {
      root.innerHTML = `${cautionHtml}<div class="today-body-fallback">${cuesHtml}${sourceLinkHtml}</div>`;
      return;
    }
    if (state === "missing") {
      root.innerHTML = `${cautionHtml}<p class="media-missing" role="status">Your photo isn't on this phone anymore. Add it again in My exercises.</p>
        <div class="today-body-fallback">${cuesHtml}${sourceLinkHtml}</div>`;
      return;
    }
    const caution = cautionHtml;
    if (state === "photo" && this.posterUrl) {
      root.innerHTML = `${caution}<div class="media-frame today-media">
        <img src="${this.posterUrl}" class="media-cover" alt="Your photo of ${escapeAttr(exerciseName)}" />
        <button type="button" class="media-photo-open" data-act="media-fullscreen" aria-label="Open your photo of ${escapeAttr(exerciseName)} full screen"></button>
        <span class="media-expand" aria-hidden="true">⤢</span>
      </div>${cuesHtml}${sourceLinkHtml}`;
      this.wirePhoto(root);
      return;
    }
    if ((state === "clip" || state === "playing") && this.posterUrl && meta) {
      const dur = formatDurationMmSs(meta.durationS ?? 0);
      const replay = this.ended && this.reducedMotion;
      const playLabel = replay
        ? `Replay your clip of ${exerciseName}, ${dur}, muted`
        : `Play your clip of ${exerciseName}, ${dur}, muted`;
      root.innerHTML = `${caution}<div class="media-frame today-media" data-playing="${this.playing}">
        ${this.playing && this.fileUrl
          ? `<video class="media-cover" playsinline muted loop="${this.reducedMotion ? "" : "loop"}" preload="none" poster="${this.posterUrl}"></video>`
          : `<img src="${this.posterUrl}" class="media-cover" alt="" />`}
        ${!this.playing
          ? `<button type="button" class="media-clip-play" data-act="media-play" aria-label="${escapeAttr(playLabel)}">▶</button><span class="media-duration-badge">${dur}</span>`
          : `<div class="media-clip-controls" role="group" aria-label="Clip controls">
              <button type="button" data-act="media-pause">Pause</button>
              <button type="button" data-act="media-sound" aria-pressed="${!this.muted}">Sound</button>
            </div>`}
      </div>${cuesHtml}${sourceLinkHtml}`;
      this.wireClip(root, meta);
    }
  }

  private wirePhoto(root: HTMLElement): void {
    const open = root.querySelector<HTMLButtonElement>("[data-act=media-fullscreen]");
    open?.addEventListener("click", () => this.openFullscreen(root));
  }

  private openFullscreen(root: HTMLElement): void {
    const dialog = document.createElement("div");
    dialog.className = "media-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.innerHTML = `<div class="media-dialog-inner">
      <div class="media-dialog-bar"><b>${escapeHtml(this.options.exerciseName)}</b>
      <button type="button" data-act="media-close" aria-label="Close">×</button></div>
      <img src="${this.posterUrl ?? ""}" alt="Your photo of ${escapeAttr(this.options.exerciseName)}" />
      <p class="media-dialog-hint">Pinch to zoom · swipe down or tap ✕ to close</p>
    </div>`;
    const returnFocus = document.activeElement;
    document.body.appendChild(dialog);
    const closeBtn = dialog.querySelector<HTMLButtonElement>("[data-act=media-close]");
    closeBtn?.focus();
    const close = () => {
      dialog.remove();
      if (returnFocus instanceof HTMLElement) {
        returnFocus.focus();
      }
    };
    closeBtn?.addEventListener("click", close);
    dialog.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        close();
      }
    });
    const trigger = root.querySelector("[data-act=media-fullscreen]");
    if (!(trigger instanceof HTMLElement)) {
      return;
    }
    void trigger;
  }

  private async wireClip(root: HTMLElement, meta: ExerciseMediaMeta): Promise<void> {
    const play = root.querySelector<HTMLButtonElement>("[data-act=media-play]");
    play?.addEventListener("click", async () => {
      if (!this.fileUrl) {
        const blob = await readMediaFileBlob(meta);
        if (!blob) {
          this.render("missing");
          return;
        }
        this.fileUrl = URL.createObjectURL(blob);
      }
      this.playing = true;
      this.ended = false;
      this.render("playing");
      const video = root.querySelector<HTMLVideoElement>("video");
      if (!video) {
        return;
      }
      this.video = video;
      if (this.reducedMotion) {
        video.removeAttribute("loop");
      } else {
        video.setAttribute("loop", "");
      }
      video.muted = this.muted;
      video.src = this.fileUrl;
      await video.play();
      const pause = root.querySelector<HTMLButtonElement>("[data-act=media-pause]");
      pause?.focus();
      video.addEventListener("ended", () => {
        if (this.reducedMotion) {
          this.ended = true;
          this.playing = false;
          this.options.onPauseClip?.();
          this.render("clip");
        }
      });
    });
    const pause = root.querySelector<HTMLButtonElement>("[data-act=media-pause]");
    pause?.addEventListener("click", () => {
      this.video?.pause();
      this.playing = false;
      this.options.onPauseClip?.();
      this.render("clip");
      root.querySelector<HTMLButtonElement>("[data-act=media-play]")?.focus();
    });
    const sound = root.querySelector<HTMLButtonElement>("[data-act=media-sound]");
    sound?.addEventListener("click", () => {
      this.muted = !this.muted;
      if (this.video) {
        this.video.muted = this.muted;
      }
      sound.setAttribute("aria-pressed", String(!this.muted));
    });
  }

  pauseClip(): void {
    this.video?.pause();
    this.playing = false;
  }

  destroy(): void {
    this.pauseClip();
    if (this.posterUrl) {
      URL.revokeObjectURL(this.posterUrl);
    }
    if (this.fileUrl) {
      URL.revokeObjectURL(this.fileUrl);
    }
  }
}

function escapeAttr(text: string): string {
  return text.replaceAll('"', "&quot;");
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function mountTodayMediaPreview(
  options: MountMediaPreviewOptions,
): Promise<ExerciseMediaPreview> {
  const preview = new ExerciseMediaPreview(options);
  const state = await preview.load();
  preview.render(state);
  return preview;
}