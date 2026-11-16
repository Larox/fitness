import { describe, expect, it } from "vitest";
import {
  isMediaDraftDirty,
  loadMediaDraft,
  markMediaRemoved,
  undoMediaRemove,
} from "../src/media/draft";
import type { ExerciseMediaMeta } from "../src/media/types";

const saved: ExerciseMediaMeta = {
  id: "med_1",
  exerciseId: "uex_1",
  kind: "photo",
  width: 10,
  height: 10,
  bytes: 12,
  posterKey: "p",
  fileKey: "f",
  createdAt: "2026-11-16T12:00:00.000Z",
};

describe("media draft", () => {
  it("remove plus Undo is a draft-only change for saved media", () => {
    let draft = loadMediaDraft("uex_1", saved);
    draft = markMediaRemoved(draft);
    expect(draft.display).toBeNull();
    expect(isMediaDraftDirty(draft)).toBe(true);
    draft = undoMediaRemove(draft);
    expect(draft.display).toEqual(saved);
    expect(isMediaDraftDirty(draft)).toBe(false);
  });
});