import { renderMediaAttachSection } from "../media/attach-html";
import {
  emptyMediaDraft,
  isMediaDraftDirty,
  loadMediaDraft,
  markMediaRemoved,
  undoMediaRemove,
  type MediaFormDraft,
} from "../media/draft";
import { formatMegabytes } from "../media/format";
import {
  commitMediaChanges,
  deleteExerciseMedia,
  discardPendingMedia,
  getExerciseMedia,
  importMediaForExercise,
  listMediaMeta,
  readPosterBlob,
  detachMediaMeta,
  deleteMediaFiles,
  putMediaMeta,
  summarizeMediaUsage,
} from "../media/service";
import type { ExerciseMediaMeta, MediaImportError } from "../media/types";

export interface MediaFlowState {
  draft: MediaFormDraft;
  posterUrl: string | null;
  abort: AbortController | null;
  thumbByExerciseId: Map<string, string>;
  mediaUsageText: string;
  pendingListRemove: ExerciseMediaMeta | null;
}

export function createMediaFlowState(exerciseId: string): MediaFlowState {
  return {
    draft: emptyMediaDraft(exerciseId),
    posterUrl: null,
    abort: null,
    thumbByExerciseId: new Map(),
    mediaUsageText: "",
    pendingListRemove: null,
  };
}

export function revokeMediaPosterUrl(state: MediaFlowState): void {
  if (state.posterUrl) {
    URL.revokeObjectURL(state.posterUrl);
    state.posterUrl = null;
  }
}

export async function hydrateMediaDraft(
  state: MediaFlowState,
  exerciseId: string,
): Promise<void> {
  const saved = await getExerciseMedia(exerciseId);
  state.draft = loadMediaDraft(exerciseId, saved);
  await refreshMediaPoster(state);
}

export async function refreshMediaPoster(state: MediaFlowState): Promise<void> {
  revokeMediaPosterUrl(state);
  const meta = state.draft.display;
  if (!meta) {
    return;
  }
  const blob = await readPosterBlob(meta);
  if (blob) {
    state.posterUrl = URL.createObjectURL(blob);
  }
}

export function mediaAttachHtml(
  state: MediaFlowState,
  exerciseId: string,
): string {
  if (state.draft.exerciseId !== exerciseId) {
    state.draft.exerciseId = exerciseId;
  }
  return renderMediaAttachSection(state.draft, {
    changedDot: isMediaDraftDirty(state.draft),
    posterUrl: state.posterUrl ?? undefined,
    removedStatus: state.draft.removeDraft && !state.draft.display,
  });
}

export async function loadMyExerciseThumbs(state: MediaFlowState): Promise<void> {
  for (const url of state.thumbByExerciseId.values()) {
    URL.revokeObjectURL(url);
  }
  state.thumbByExerciseId.clear();
  const rows = await listMediaMeta();
  await Promise.all(
    rows.map(async (meta: ExerciseMediaMeta) => {
      const blob = await readPosterBlob(meta);
      if (blob) {
        state.thumbByExerciseId.set(meta.exerciseId, URL.createObjectURL(blob));
      }
    }),
  );
  const summary = await summarizeMediaUsage();
  state.mediaUsageText = `${summary.itemCount} items · ${formatMegabytes(summary.bytesUsed)} on this phone`;
}

export async function startMediaImport(
  state: MediaFlowState,
  file: File,
  onChange: () => void,
): Promise<void> {
  state.abort?.abort();
  const controller = new AbortController();
  state.abort = controller;
  state.draft = {
    ...state.draft,
    status: "uploading",
    error: undefined,
    progress: { loaded: 0, total: file.size },
  };
  onChange();
  try {
    const meta = await importMediaForExercise(
      state.draft.exerciseId,
      file,
      (progress) => {
        state.draft.progress = progress;
        onChange();
      },
      controller.signal,
    );
    if (state.draft.replaced == null && state.draft.saved) {
      state.draft.replaced = state.draft.saved;
    }
    state.draft.pending = meta;
    state.draft.display = meta;
    state.draft.removeDraft = false;
    state.draft.status = "idle";
    state.draft.error = undefined;
    await refreshMediaPoster(state);
    onChange();
  } catch (err) {
    if (controller.signal.aborted) {
      state.draft.status = "idle";
      onChange();
      return;
    }
    const message =
      err instanceof Error
        ? (err.message as MediaImportError)
        : "unsupported-format";
    state.draft.status = "idle";
    state.draft.error = message;
    if (err instanceof Error) {
      const extra = err as Error & { durationS?: number; sizeBytes?: number };
      state.draft.errorDurationS = extra.durationS;
      state.draft.errorBytes = extra.sizeBytes ?? file.size;
    }
    onChange();
  } finally {
    state.abort = null;
  }
}

export function cancelMediaImport(state: MediaFlowState, onChange: () => void): void {
  state.abort?.abort();
  state.draft.status = "idle";
  onChange();
}

export async function commitMediaForSave(
  state: MediaFlowState,
  exerciseId: string,
): Promise<void> {
  if (state.draft.removeDraft) {
    const saved = state.draft.saved;
    const snap = state.draft.removedSnapshot;
    if (state.draft.removedWasUnsaved && snap) {
      await discardPendingMedia(snap);
      if (saved) {
        await deleteExerciseMedia(exerciseId);
      }
    } else if (saved) {
      await deleteExerciseMedia(exerciseId);
    }
    state.draft = emptyMediaDraft(exerciseId);
    revokeMediaPosterUrl(state);
    return;
  }
  await commitMediaChanges(
    exerciseId,
    state.draft.pending,
    false,
    state.draft.saved,
    state.draft.replaced,
  );
  if (state.draft.pending) {
    state.draft.saved = state.draft.pending;
    state.draft.pending = null;
    state.draft.replaced = null;
  }
  state.draft.removeDraft = false;
}

export async function discardUnsavedMedia(state: MediaFlowState): Promise<void> {
  if (state.draft.pending) {
    await discardPendingMedia(state.draft.pending);
  }
  if (
    state.draft.removedSnapshot &&
    state.draft.removedWasUnsaved &&
    (!state.draft.saved || state.draft.removedSnapshot.id !== state.draft.saved.id)
  ) {
    await discardPendingMedia(state.draft.removedSnapshot);
  }
  state.abort?.abort();
}

export async function onExerciseDeleted(exerciseId: string): Promise<void> {
  await deleteExerciseMedia(exerciseId);
}

export function markRemove(state: MediaFormDraft): MediaFormDraft {
  return markMediaRemoved(state);
}

export function undoRemove(state: MediaFormDraft): MediaFormDraft {
  return undoMediaRemove(state);
}

export async function commitPendingMediaListRemove(state: MediaFlowState): Promise<void> {
  if (!state.pendingListRemove) {
    return;
  }
  await deleteMediaFiles(state.pendingListRemove);
  state.pendingListRemove = null;
}

export async function removeFromMediaList(
  state: MediaFlowState,
  mediaId: string,
): Promise<boolean> {
  if (state.pendingListRemove?.id === mediaId) {
    return false;
  }
  await commitPendingMediaListRemove(state);
  const removed = await detachMediaMeta(mediaId);
  if (!removed) {
    return false;
  }
  state.pendingListRemove = removed;
  return true;
}

export async function undoMediaListRemove(state: MediaFlowState): Promise<void> {
  const pending = state.pendingListRemove;
  if (!pending) {
    return;
  }
  await putMediaMeta(pending);
  state.pendingListRemove = null;
}