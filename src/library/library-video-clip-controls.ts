import { formatDurationMmSs } from "../media/format";
import type { ResolvedVideoSegment } from "./video-segment";

export function shouldShowClipReset(hasLibraryTimes: boolean, hasDeviceOverride: boolean): boolean {
  return hasLibraryTimes || hasDeviceOverride;
}

export interface LibraryClipControlsInput {
  segment: ResolvedVideoSegment | null;
  hasDeviceOverride: boolean;
  hasLibraryTimes: boolean;
  reducedMotion?: boolean;
  videoReady?: boolean;
  scrubTimeS?: number;
  fullDurationS?: number | null;
  feedback?: string | null;
  validationError?: string | null;
  paused?: boolean;
}

export function renderLibraryClipControls(input: LibraryClipControlsInput): string {
  const disabled = input.videoReady === false;
  const disabledAttr = disabled ? " disabled" : "";
  const reset = shouldShowClipReset(input.hasLibraryTimes, input.hasDeviceOverride)
    ? `<button type="button" class="clip-reset" data-act="clip-reset"${disabledAttr}>Reset to library times</button>`
    : "";

  const fullDuration = input.fullDurationS;
  const scrubMax =
    typeof fullDuration === "number" && Number.isFinite(fullDuration) && fullDuration > 0
      ? fullDuration
      : null;
  const scrubValue =
    typeof input.scrubTimeS === "number" && Number.isFinite(input.scrubTimeS)
      ? Math.min(Math.max(0, input.scrubTimeS), scrubMax ?? input.scrubTimeS)
      : 0;

  const scrubber =
    scrubMax !== null
      ? `<label class="clip-scrub-label">
      <span class="clip-scrub-time" aria-hidden="true">${formatDurationMmSs(scrubValue)}</span>
      <input type="range" class="clip-scrub" data-act="clip-scrub" min="0" max="${scrubMax}" step="0.05" value="${scrubValue}"${disabledAttr} aria-label="Scrub full routine video" />
    </label>`
      : "";

  const pauseLabel = input.paused !== false ? "Play" : "Pause";
  const pauseAct = input.paused !== false ? "clip-play" : "clip-pause";

  const feedback =
    input.feedback != null && input.feedback !== ""
      ? `<p class="clip-feedback" role="status" aria-live="polite">${escapeHtml(input.feedback)}</p>`
      : "";

  const validation =
    input.validationError != null && input.validationError !== ""
      ? `<p class="clip-validation" role="alert">${escapeHtml(input.validationError)}</p>`
      : "";

  const showLooping =
    !input.reducedMotion &&
    input.segment &&
    !input.segment.usesFullVideo &&
    input.segment.endS > input.segment.startS;

  const rangeLine = showLooping
    ? `<p class="clip-range" aria-live="polite">Segment ${formatDurationMmSs(input.segment!.startS)} – ${formatDurationMmSs(input.segment!.endS)}</p>`
    : "";

  const hint =
    input.segment?.usesFullVideo ?? true
      ? `<p class="hint">Pause, scrub the full reel, then set start and end on this device.</p>`
      : `<p class="hint">You can widen or move the segment across the full reel.</p>`;

  return `<div class="clip-controls" role="group" aria-label="Video segment"${disabled ? ' data-clip-loading="1"' : ""}>
    ${rangeLine}
    ${scrubber}
    <button type="button" data-act="${pauseAct}" aria-label="${pauseLabel} preview"${disabledAttr}>${pauseLabel}</button>
    <button type="button" data-act="clip-set-start"${disabledAttr}>Set start here</button>
    <button type="button" data-act="clip-set-end"${disabledAttr}>Set end here</button>
    ${reset}
    ${feedback}
    ${validation}
    ${hint}
  </div>`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}