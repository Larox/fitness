import { decodePoseClip } from "./encode";
import { drawStickFigure, interpFrames } from "./figure-draw";
import type { PoseClipBox, PoseFrame } from "./joints";

export interface FigurePlayerOptions {
  canvas: HTMLCanvasElement;
  blob: Blob;
  exerciseName: string;
  reducedMotion: boolean;
  headRadiusNorm?: number;
  onPlayOnceEnd?: () => void;
}

function readCssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export class FigurePlayer {
  private frames: PoseFrame[] = [];
  private box: PoseClipBox = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private keyFrame = 0;
  private fps = 15;
  private raf = 0;
  private start = 0;
  private paused = false;
  private playingOnce = false;
  private visible = true;
  private observer: IntersectionObserver | null = null;
  private headRadiusNorm = 0.08;
  private readonly reducedMotion: boolean;
  private readonly onPlayOnceEnd?: () => void;

  constructor(private readonly opts: FigurePlayerOptions) {
    this.reducedMotion = opts.reducedMotion;
    this.onPlayOnceEnd = opts.onPlayOnceEnd;
    if (opts.headRadiusNorm) this.headRadiusNorm = opts.headRadiusNorm;
    opts.canvas.setAttribute(
      "role",
      "img",
    );
    opts.canvas.setAttribute(
      "aria-label",
      `Stick-figure animation of ${opts.exerciseName}, made from your clip`,
    );
  }

  async load(): Promise<void> {
    const buf = await this.opts.blob.arrayBuffer();
    const { header, frames } = decodePoseClip(buf);
    this.frames = frames;
    this.box = header.box;
    this.keyFrame = header.keyFrame;
    this.fps = header.fps;
  }

  mount(): void {
    const { canvas } = this.opts;
    if (typeof IntersectionObserver !== "undefined") {
      this.observer = new IntersectionObserver(
        (entries) => {
          this.visible = entries.some((e) => e.isIntersecting);
          if (!this.visible) this.stopLoop();
          else if (!this.reducedMotion && !this.paused) this.startLoop();
        },
        { threshold: 0.1 },
      );
      this.observer.observe(canvas);
    }
    document.addEventListener("visibilitychange", this.onVis);
    this.renderStill();
    if (!this.reducedMotion) this.startLoop();
  }

  private onVis = (): void => {
    if (document.hidden) this.stopLoop();
    else if (!this.reducedMotion && !this.paused && this.visible) this.startLoop();
  };

  destroy(): void {
    this.stopLoop();
    this.observer?.disconnect();
    document.removeEventListener("visibilitychange", this.onVis);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.stopLoop();
    else if (!this.reducedMotion) this.startLoop();
    this.paint();
  }

  playOnce(): void {
    if (!this.reducedMotion) return;
    this.playingOnce = true;
    this.paused = false;
    this.start = performance.now();
    this.startLoop();
  }

  private startLoop(): void {
    if (this.raf) return;
    this.start = performance.now();
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      this.paint(now);
      if (this.playingOnce) {
        const elapsed = (now - this.start) / 1000;
        const idx = elapsed * this.fps;
        if (idx >= this.frames.length) {
          this.playingOnce = false;
          this.stopLoop();
          this.paint(this.start + (this.frames.length / this.fps) * 1000);
          this.onPlayOnceEnd?.();
        }
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  renderStill(): void {
    this.paint();
  }

  private paint(now = performance.now()): void {
    if (this.frames.length === 0) return;
    const { canvas } = this.opts;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frameIdx: number;
    if (this.reducedMotion) {
      if (this.playingOnce) {
        const elapsed = (now - this.start) / 1000;
        frameIdx = elapsed * this.fps;
      } else {
        frameIdx = this.keyFrame;
      }
    } else if (this.paused || !this.visible || document.hidden) {
      frameIdx = ((now - this.start) / 1000) * this.fps;
    } else {
      frameIdx = ((now - this.start) / 1000) * this.fps;
    }
    const frame = interpFrames(this.frames, frameIdx);
    drawStickFigure({
      ctx,
      frame,
      box: this.box,
      width: w,
      height: h,
      colors: {
        primary: readCssVar("--primary", "#24456b"),
        surface: readCssVar("--surface", "#fff"),
        track: readCssVar("--track", "#d9d6ce"),
      },
      headRadiusNorm: this.headRadiusNorm,
      dpr,
    });
  }
}