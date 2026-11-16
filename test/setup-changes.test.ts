import { describe, expect, it } from "vitest";
import { summarizeSettingsChange } from "../src/setup/changes";
import type { TrainingSettings } from "../src/setup/types";

const saved: TrainingSettings = {
  daysPerWeek: 4,
  sessionMinutes: 30,
  homeBellsKg: [6, 8],
  noHomeBells: false,
  gymBellsKg: [8, 10],
  conditionsEnabled: { concern_a: true, concern_b: true },
};

describe("settings change application", () => {
  it("flags turning a condition on as safety-relevant", () => {
    const draft: TrainingSettings = {
      ...saved,
      conditionsEnabled: { concern_a: true, concern_b: false },
    };
    const offDraft: TrainingSettings = {
      ...saved,
      conditionsEnabled: { concern_a: false, concern_b: true },
    };
    expect(summarizeSettingsChange(saved, offDraft).safetyRelevant).toBe(false);

    const enabling: TrainingSettings = {
      ...draft,
      conditionsEnabled: { concern_a: true, concern_b: true },
    };
    expect(summarizeSettingsChange(draft, enabling).safetyRelevant).toBe(true);
  });

  it("flags removing equipment as safety-relevant", () => {
    const draft: TrainingSettings = {
      ...saved,
      gymBellsKg: [8],
    };
    expect(summarizeSettingsChange(saved, draft).safetyRelevant).toBe(true);
  });

  it("treats schedule edits as plan-affecting but not immediate safety", () => {
    const draft: TrainingSettings = { ...saved, daysPerWeek: 3 };
    const summary = summarizeSettingsChange(saved, draft);
    expect(summary.planAffectingChanges).toBe(1);
    expect(summary.safetyRelevant).toBe(false);
  });
});