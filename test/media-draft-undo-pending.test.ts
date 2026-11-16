import { describe, expect, it } from "vitest";
import {
  emptyMediaDraft,
  markMediaRemoved,
  undoMediaRemove,
} from "../src/media/draft";
import type { ExerciseMediaMeta } from "../src/media/types";

const pending: ExerciseMediaMeta = {
  id: "med_pending",
  exerciseId: "uex_new",
  kind: "photo",
  width: 100,
  height: 80,
  bytes: 10,
  posterKey: "p",
  fileKey: "f",
  createdAt: "2026-11-16T12:00:00.000Z",
};

describe("media draft undo pending import", () => {
  it("restores a pending import after Remove on a new exercise", () => {
    let draft = emptyMediaDraft("uex_new");
    draft = { ...draft, pending, display: pending };
    draft = markMediaRemoved(draft);
    expect(draft.display).toBeNull();
    expect(draft.pending).toBeNull();
    draft = undoMediaRemove(draft);
    expect(draft.display).toEqual(pending);
    expect(draft.pending).toEqual(pending);
    expect(draft.removeDraft).toBe(false);
  });
});