import type { ExerciseMediaMeta, MediaImportError, MediaImportProgress } from "./types";

export type MediaUploadStatus = "idle" | "uploading";

export interface MediaFormDraft {
  exerciseId: string;
  saved: ExerciseMediaMeta | null;
  /** What the form shows right now (saved, pending import, or null after remove draft). */
  display: ExerciseMediaMeta | null;
  /** New import finished locally; committed to the exercise on Save. */
  pending: ExerciseMediaMeta | null;
  /** Prior committed media still on disk until Save replaces or removes it. */
  replaced: ExerciseMediaMeta | null;
  /** Last visible media removed in draft; used for Undo before Save. */
  removedSnapshot: ExerciseMediaMeta | null;
  /** Snapshot had a pose animation (for removed copy). */
  removedHadPose?: boolean;
  /** True when Remove cleared an unsaved import or replace. */
  removedWasUnsaved: boolean;
  removeDraft: boolean;
  status: MediaUploadStatus;
  error?: MediaImportError;
  errorBytes?: number;
  errorDurationS?: number;
  progress?: MediaImportProgress;
}

export function emptyMediaDraft(exerciseId: string): MediaFormDraft {
  return {
    exerciseId,
    saved: null,
    display: null,
    pending: null,
    replaced: null,
    removedSnapshot: null,
    removedWasUnsaved: false,
    removeDraft: false,
    status: "idle",
  };
}

export function loadMediaDraft(
  exerciseId: string,
  saved: ExerciseMediaMeta | null,
): MediaFormDraft {
  return {
    exerciseId,
    saved,
    display: saved,
    pending: null,
    replaced: null,
    removedSnapshot: null,
    removedWasUnsaved: false,
    removeDraft: false,
    status: "idle",
  };
}

export function isMediaDraftDirty(draft: MediaFormDraft): boolean {
  if (draft.pending) {
    return true;
  }
  if (draft.removeDraft && draft.saved) {
    return true;
  }
  return false;
}

export function markMediaRemoved(draft: MediaFormDraft): MediaFormDraft {
  const snapshot = draft.display ?? draft.pending;
  const removedWasUnsaved =
    draft.pending !== null ||
    (snapshot !== null &&
      (draft.saved === null || draft.saved.id !== snapshot.id));
  return {
    ...draft,
    removeDraft: true,
    removedSnapshot: snapshot,
    removedHadPose: Boolean(snapshot?.pose),
    removedWasUnsaved,
    display: null,
    pending: null,
    error: undefined,
    status: "idle",
  };
}

export function undoMediaRemove(draft: MediaFormDraft): MediaFormDraft {
  const snapshot = draft.removedSnapshot ?? draft.saved;
  if (!snapshot) {
    return {
      ...draft,
      removeDraft: false,
      removedSnapshot: null,
      removedWasUnsaved: false,
    };
  }
  const restorePending = draft.removedWasUnsaved;
  return {
    ...draft,
    removeDraft: false,
    removedSnapshot: null,
    removedWasUnsaved: false,
    display: snapshot,
    pending: restorePending ? snapshot : null,
  };
}