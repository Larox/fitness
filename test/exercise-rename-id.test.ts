import { describe, expect, it } from "vitest";
import { renameUserExercise } from "../src/exercises/persisted";
import type { UserExercise } from "../src/exercises/types";

describe("rename user exercise", () => {
  const original: UserExercise = {
    id: "uex_fixed",
    routineId: "user_routine_fixed",
    name: "Dead hang",
    categories: [],
    equipment: "",
    cues: [],
    dose: { mode: "hold", sets: 3, holdS: 30, perSide: false },
    riskChosen: {},
    moderateCautions: {},
    kettlebell: false,
    createdAt: "2026-11-16T12:00:00.000Z",
  };

  it("keeps stable id and routineId when the name changes", () => {
    const next = renameUserExercise([original], original.id, "  Long dead hang  ");
    expect(next[0]!.id).toBe("uex_fixed");
    expect(next[0]!.routineId).toBe("user_routine_fixed");
    expect(next[0]!.name).toBe("Long dead hang");
  });
});