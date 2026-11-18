import { formatDurationMmSs } from "../media/format";
import type { ResolvedVideoSegment } from "./video-segment";

export function renderLibraryClipControls(input: {
  segment: ResolvedVideoSegment | null;
  hasDeviceOverride: boolean;
}): string {
  if (!input.segment || input.segment.usesFullVideo) {
    const reset = input.hasDeviceOverride
      ? `<button type="button" class="clip-reset" data-act="clip-reset">Reset to library times</button>`
      : "";
    return `<div class="clip-controls" role="group" aria-label="Video segment">
      <button type="button" data-act="clip-set-start">Set start here</button>
      <button type="button" data-act="clip-set-end">Set end here</button>
      ${reset}
      <p class="hint">Uses the full routine video until both ends are set.</p>
    </div>`;
  }
  const range = `${formatDurationMmSs(input.segment.startS)} – ${formatDurationMmSs(input.segment.endS)}`;
  return `<div class="clip-controls" role="group" aria-label="Video segment">
    <p class="clip-range" aria-live="polite">Looping ${range}</p>
    <button type="button" data-act="clip-set-start">Set start here</button>
    <button type="button" data-act="clip-set-end">Set end here</button>
    <button type="button" class="clip-reset" data-act="clip-reset">Reset to library times</button>
  </div>`;
}