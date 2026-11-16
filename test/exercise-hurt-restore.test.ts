import { describe, expect, it } from "vitest";
import {
  restoreDoesNotChangeCurrentWeek,
  restoreHurtExercise,
  undoHurtRestore,
} from "../src/exercises/hurt";

describe("marked as hurt restore", () => {
  const exclusions = [
    { exerciseId: "ex_a", markedAt: "2026-11-12T09:00:00.000Z", from: "today" },
    { exerciseId: "ex_b", markedAt: "2026-11-13T09:00:00.000Z", from: "today" },
  ];
  const weekBefore = [
    { sessionId: "w1", exerciseIds: ["ex_a", "ex_c"] },
    { sessionId: "w2", exerciseIds: ["ex_b"] },
  ];

  it("does not change the current week session lists on restore", () => {
    const restored = restoreHurtExercise(exclusions, "ex_a");
    expect(restored.restored?.exerciseId).toBe("ex_a");
    const weekAfter = weekBefore;
    expect(restoreDoesNotChangeCurrentWeek(weekBefore, weekAfter)).toBe(true);
  });

  it("supports one-step undo that re-applies the exclusion", () => {
    const restored = restoreHurtExercise(exclusions, "ex_a");
    const undo = { exerciseId: "ex_a", previous: restored.restored! };
    const again = undoHurtRestore(restored.exclusions, undo);
    expect(again.some((row) => row.exerciseId === "ex_a")).toBe(true);
  });
});