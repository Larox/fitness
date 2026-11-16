import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { importLibrary } from "../src/library/import";
import {
  findDuplicateByName,
  validateExerciseForm,
} from "../src/exercises/validation";
import { normalizeSourceUrl } from "../src/exercises/url";
import { emptyExerciseDraft } from "../src/exercises/form-helpers";
import { loadExampleConditions } from "./helpers";

const snapshot = JSON.parse(
  readFileSync(new URL("../data/sample-library.json", import.meta.url), "utf8"),
);

describe("exercise form validation", () => {
  const conditions = loadExampleConditions();
  const library = importLibrary(snapshot, { conditions });

  it("reports duplicate names case-insensitively against the library", () => {
    const existing = library.exercises[0]!;
    const dup = findDuplicateByName(existing.name.toUpperCase(), library.exercises, [], undefined);
    expect(dup?.id).toBe(existing.id);
    expect(dup?.imported).toBe(true);
  });

  it("does not suggest editing a library duplicate", () => {
    const existing = library.exercises[0]!;
    const draft = emptyExerciseDraft();
    draft.name = existing.name;
    const issues = validateExerciseForm({
      draft,
      conditions,
      libraryExercises: library.exercises,
      userNames: [],
      validateNow: true,
    });
    const dup = issues.find((i) => i.field === "duplicate");
    expect(dup?.message).not.toMatch(/edit that one/i);
  });

  it("returns validation issues after the first save attempt", () => {
    const draft = emptyExerciseDraft();
    draft.name = "";
    draft.link = "not a url";
    expect(validateExerciseForm({
      draft,
      conditions,
      libraryExercises: library.exercises,
      userNames: [],
      validateNow: false,
    })).toHaveLength(0);
    const issues = validateExerciseForm({
      draft,
      conditions,
      libraryExercises: library.exercises,
      userNames: [],
      validateNow: true,
    });
    expect(issues.some((i) => i.field === "name")).toBe(true);
    expect(issues.some((i) => i.field === "link")).toBe(true);
  });

  it("prefixes https on blur for bare domains", () => {
    expect(normalizeSourceUrl("example.com/video")).toBe("https://example.com/video");
  });
});