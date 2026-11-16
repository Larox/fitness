import { describe, expect, it } from "vitest";
import { filterExercisesForScheduling } from "../src/safety/filter";
import { userExerciseToNormalized } from "../src/exercises/to-normalized";
import { loadExampleConditions } from "./helpers";
import type { UserExercise } from "../src/exercises/types";

describe("unset user risk in safety filter", () => {
  const conditions = loadExampleConditions();

  const userExercise: UserExercise = {
    id: "uex_unset",
    routineId: "user_r",
    name: "Jump rope",
    categories: [],
    equipment: "",
    cues: [],
    dose: { mode: "reps", sets: 3, reps: 20, perSide: false },
    riskChosen: { [conditions[0]!.id]: "low" },
    moderateCautions: {},
    kettlebell: false,
    createdAt: "2026-11-16T12:00:00.000Z",
  };

  it("never schedules when any configured condition risk is unset, even if conditions are off", () => {
    const normalized = userExerciseToNormalized(userExercise, conditions);
    const result = filterExercisesForScheduling([normalized], {
      conditions,
      activeConditionIds: new Set(),
      excludedExerciseIds: new Set(),
      exercisesById: new Map([[normalized.id, normalized]]),
    });
    expect(result.scheduled).toHaveLength(0);
    expect(result.dropped[0]?.reasons[0]).toMatch(/not set/i);
  });
});