import { escapeHtml } from "../setup/icons";
import type { MediaFormDraft } from "./draft";
import { formatDurationMmSs, formatMegabytes } from "./format";
import type { MediaImportError } from "./types";

function errorBlock(draft: MediaFormDraft): string {
  if (!draft.error) {
    return "";
  }
  const messages: Record<MediaImportError, { title: string; hint: string }> = {
    "too-long": {
      title: `That clip is ${formatDurationMmSs(draft.errorDurationS ?? 0)}. Clips can be up to 30 seconds.`,
      hint: "Trim it in your Photos app first, then add it again.",
    },
    "too-big": {
      title: `That clip is ${formatMegabytes(draft.errorBytes ?? 0)}. Clips can be up to 25 MB.`,
      hint: "Trim it shorter, or record at 1080p instead of 4K in your camera settings.",
    },
    "storage-full": {
      title: "Not enough space on this phone.",
      hint: "Remove media you no longer need, then try again.",
    },
    "unsupported-format": {
      title: "This photo format isn't supported here.",
      hint: "Pick a JPEG or PNG, or take a new photo.",
    },
    "source-too-large": {
      title: "This file is too large to import here.",
      hint: "Pick a smaller photo or clip, then try again.",
    },
  };
  const copy = messages[draft.error];
  return `<div class="media-err" role="alert"><b>${escapeHtml(copy.title)}</b><p>${escapeHtml(copy.hint)}</p></div>`;
}

function uploadRow(draft: MediaFormDraft): string {
  const total = draft.progress?.total ?? 1;
  const loaded = draft.progress?.loaded ?? 0;
  const pct = Math.min(100, Math.round((loaded / total) * 100));
  const label = draft.display?.kind === "clip" ? "Saving clip…" : "Saving photo…";
  return `<div class="media-import" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
    <p><b>${escapeHtml(label)}</b></p>
    <div class="media-import-track"><i style="width:${pct}%"></i></div>
    <p class="media-import-meta">${pct}% · ${formatMegabytes(loaded)} of ${formatMegabytes(total)}</p>
    <button type="button" class="media-cancel" data-act="media-cancel">Cancel</button>
  </div>`;
}

function attachedPreview(draft: MediaFormDraft, posterUrl: string): string {
  const m = draft.display!;
  if (m.kind === "photo") {
    const from =
      m.sourceWidth && m.sourceHeight
        ? `<span>Resized from ${m.sourceWidth} × ${m.sourceHeight}</span>`
        : "";
    return `<div class="media-frame"><img src="${posterUrl}" alt="" class="media-cover" /></div>
      <p class="media-meta"><b>Photo</b><span>${m.width} × ${m.height}</span><span>${formatMegabytes(m.bytes)}</span>${from}</p>
      <div class="media-actions">
        <button type="button" data-act="media-replace">Replace</button>
        <button type="button" data-act="media-remove" class="danger">Remove</button>
      </div>`;
  }
  const dur = formatDurationMmSs(m.durationS ?? 0);
  return `<div class="media-frame media-clip-idle">
      <img src="${posterUrl}" alt="" class="media-cover" />
      <span class="media-duration-badge">${dur}</span>
    </div>
    <p class="media-meta"><b>Clip</b><span>${dur}</span><span>${formatMegabytes(m.bytes)}</span><span>Plays muted in Today</span></p>
    <div class="media-actions">
      <button type="button" data-act="media-replace">Replace</button>
      <button type="button" data-act="media-remove" class="danger">Remove</button>
    </div>`;
}

export function renderMediaAttachSection(
  draft: MediaFormDraft,
  options: { changedDot: boolean; posterUrl?: string; removedStatus?: boolean },
): string {
  const changed = options.changedDot ? '<span class="changed-dot" aria-hidden="true"></span>' : "";
  let body = "";
  if (draft.status === "uploading") {
    body = uploadRow(draft);
  } else if (draft.display && options.posterUrl) {
    body = attachedPreview(draft, options.posterUrl);
  } else {
    const tileLabel = draft.error ? "Choose another photo or clip" : "Add photo or clip";
    const removed =
      options.removedStatus
        ? `<div class="media-removed" role="status">Photo removed. It's deleted from this phone when you save.
            <button type="button" id="media-undo" data-act="media-undo">Undo</button></div>`
        : "";
    body = `${removed}<button type="button" class="media-add" data-act="media-pick" id="media-pick-tile">
      <span class="media-add-icon" aria-hidden="true">📷</span>
      <span><b>${escapeHtml(tileLabel)}</b><span>Take one now or choose from your library</span></span>
    </button>
    <p class="hint" id="m-hint">Saved only on this phone. Big photos are resized to 1600 px. Clips up to 30 s and 25 MB.</p>`;
  }
  return `<div class="sect"><h2>Photo or clip${changed}</h2><span>Optional · one per exercise</span></div>
    <div class="group"><div class="field" id="media-field">${errorBlock(draft)}${body}
      <input type="file" id="media-file-input" accept="image/*,video/*" class="visually-hidden" tabindex="-1" aria-hidden="true" />
    </div></div>`;
}