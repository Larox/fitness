import { escapeHtml } from "../setup/icons";
import type { ExerciseMediaMeta } from "../media/types";
import { formatDurationMmSs, formatMegabytes } from "../media/format";
import type { PoseJobState } from "./pose-job-service";
import { modelSizeLabel } from "./pose-job-service";

export interface AnimAttachOptions {
  meta: ExerciseMediaMeta;
  posterUrl?: string;
  exerciseName: string;
  job: PoseJobState | null;
  modelCached: boolean;
  modelOnDevice: boolean;
  unfinished: boolean;
  view: "anim" | "clip";
  poseRemovedDraft: boolean;
  manifestTotal?: string;
  showToggle: boolean;
}

function animRowOffer(opts: AnimAttachOptions): string {
  const size = opts.manifestTotal ?? modelSizeLabel(opts.job?.modelManifest);
  const sub = opts.modelOnDevice
    ? "Takes about a minute · works offline"
    : `One-time download · ${size} · works offline after`;
  const btn = opts.modelOnDevice ? "Make animation" : "Download and make";
  const unfinished = opts.unfinished
    ? `<p class="hint"><b>The animation wasn’t finished.</b> Make it again: about a minute, works offline.</p>`
    : "";
  return `${unfinished}<div class="anim-row" id="anim-row">
    <div class="anim-offer">
      <span class="anim-icon" aria-hidden="true">🦴</span>
      <p><b>Make a stick-figure animation</b><span>${escapeHtml(sub)}</span></p>
    </div>
    <p class="hint anim-note">📱 It runs on this phone. Your clip never leaves it.</p>
    <button type="button" class="anim-btn full" data-act="pose-start">${escapeHtml(btn)}</button>
  </div>`;
}

function progressBar(
  title: string,
  pct: number,
  meta: string,
  valuetext: string,
  cancelAct: string,
): string {
  return `<div class="anim-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${escapeAttr(valuetext)}">
    <span class="anim-icon" aria-hidden="true">⬇</span>
    <p><b>${escapeHtml(title)}</b></p>
    <div class="media-import-track"><i style="width:${pct}%"></i></div>
    <p class="media-import-meta">${escapeHtml(meta)}</p>
    <button type="button" class="media-cancel" data-act="${cancelAct}">Cancel</button>
  </div>`;
}

function escapeAttr(s: string): string {
  return s.replaceAll('"', "&quot;");
}

export function renderAnimSection(opts: AnimAttachOptions): string {
  if (opts.meta.kind !== "clip") return "";
  const job = opts.job;
  const phase = job?.mediaId === opts.meta.id ? job.phase : "idle";
  const live = `<span id="anim-live" class="visually-hidden" role="status" aria-live="polite"></span>`;

  if (opts.poseRemovedDraft) {
    return `${live}<div class="media-removed" role="status">Animation removed. The clip stays. It's deleted from this phone when you save.
      <button type="button" data-act="pose-undo-remove">Undo</button></div>`;
  }

  if (opts.meta.pose && opts.showToggle) {
    const dur = formatDurationMmSs(opts.meta.durationS ?? 0);
    const toggle = `<div class="seg aseg" role="radiogroup" aria-label="Show the animation or the clip">
      <button type="button" role="radio" aria-checked="${opts.view === "anim"}" data-act="pose-view" data-v="anim">Animation</button>
      <button type="button" role="radio" aria-checked="${opts.view === "clip"}" data-act="pose-view" data-v="clip">Clip</button>
    </div>`;
    const animFrame =
      opts.view === "anim"
        ? `<canvas class="pose-canvas" data-role="pose-canvas" width="400" height="300"></canvas>
           <button type="button" class="fpause" data-act="pose-pause" aria-label="Pause animation">⏸</button>`
        : "";
    const clipFrame =
      opts.view === "clip"
        ? `${opts.posterUrl ? `<img src="${opts.posterUrl}" alt="" class="media-cover" />` : ""}
           <span class="media-duration-badge">${dur}</span>
           <button type="button" class="media-clip-play" data-act="media-clip-preview" aria-label="Play clip preview">▶</button>`
        : "";
    const metaLine =
      opts.view === "anim"
        ? `<b>Animation</b><span>Made on this phone</span><span>From the ${dur} clip</span>`
        : `<b>Clip</b><span>${dur}</span><span>${formatMegabytes(opts.meta.bytes)}</span><span>Plays muted in Today</span>`;
    return `${live}${toggle}
      <div class="media-frame media-anim media-clip-idle ${opts.view === "anim" ? "show-canvas" : ""}" data-view="${opts.view}">
        ${opts.view === "anim" ? animFrame : clipFrame}
      </div>
      <p class="media-meta">${metaLine}</p>
      <div class="media-actions">
        <button type="button" data-act="media-replace">Replace</button>
        <button type="button" data-act="media-remove" class="danger">Remove</button>
      </div>
      <div class="anim-divider"></div>
      <button type="button" class="anim-remove" data-act="pose-remove">Remove animation</button>
      <p class="hint">The clip stays</p>`;
  }

  if (phase === "downloading" && job) {
    const total = job.downloadTotal ?? 1;
    const loaded = job.downloadLoaded ?? 0;
    const pct = Math.min(100, Math.round((loaded / total) * 100));
    const meta = `${formatMegabytes(loaded)} of ${formatMegabytes(total)} · ${pct}%`;
    return `${live}${progressBar("Downloading model", pct, meta, `${formatMegabytes(loaded)} of ${formatMegabytes(total)} · ${pct} percent`, "pose-cancel")}
      <p class="hint anim-note">You can keep editing or save. The animation is made on this phone right after the download.</p>`;
  }

  if (phase === "processing" && job) {
    const total = job.processTotal ?? 1;
    const frame = job.processFrame ?? 0;
    const pct = Math.min(100, Math.round((frame / total) * 100));
  const cover = opts.posterUrl
      ? `<img src="${opts.posterUrl}" alt="" class="media-cover" />`
      : "";
    return `${live}<div class="media-frame media-clip-idle processing">
      ${cover}
      <div class="ovl">
        <b>Making the animation</b>
        <div class="obar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="Finding the pose · frame ${frame} of ${total}">
          <i style="width:${pct}%"></i>
        </div>
        <span aria-hidden="true">Finding the pose · frame ${frame} of ${total}</span>
        <button type="button" class="ocancel" data-act="pose-cancel">Cancel</button>
      </div>
    </div>
    <p class="hint anim-note">📱 You can keep editing or save. It keeps going while the app is open and is added to this clip when it's done.</p>`;
  }

  if (phase === "offline") {
    return `${live}<div class="anim-row fail-quiet">
      <p><b>Needs a connection the first time</b><span>The ${escapeHtml(modelSizeLabel(job?.modelManifest))} model downloads once. After that, animations work offline.</span></p>
      <p class="hint">Connect to Wi-Fi or mobile data, then try again. Your clip is safe.</p>
      <button type="button" class="anim-btn full" data-act="pose-start">Try again</button>
    </div>`;
  }

  if (phase === "failed-noperson") {
    return `${live}<div class="anim-row fail-quiet">
      <p><b>No person found in this clip</b><span>For an animation, film the whole body in frame, in good light, with the phone held still.</span></p>
      <p class="hint">Your clip is kept as it is. Replace it above to try another one.</p>
    </div>`;
  }

  if (phase === "failed") {
    return `${live}<div class="anim-row fail-quiet">
      <p><b>Couldn't make the animation</b><span>Something went wrong on this phone. Your clip is kept as it is.</span></p>
      <button type="button" class="anim-btn full" data-act="pose-retry">Try again</button>
    </div>`;
  }

  if (opts.meta.pose) {
    return "";
  }

  return `${live}${animRowOffer(opts)}`;
}

export function poseBarHelper(job: PoseJobState | null, mediaId: string): string | null {
  if (!job || job.mediaId !== mediaId) return null;
  if (job.phase === "downloading" || job.phase === "processing") {
    return "Ready to save · the animation is added when it's done";
  }
  return null;
}