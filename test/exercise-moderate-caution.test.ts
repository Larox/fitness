import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { importLibrary } from "../src/library/import";
import { filterExercisesForScheduling } from "../src/safety/filter";
import { userExerciseToNormalized } from "../src/exercises/to-normalized";
import { genericModerateCautionLine } from "../src/exercises/caution";
import { loadExampleConditions } from "./helpers";
import type { UserExercise } from "../src/exercises/types";

const snapshot = JSON.parse(
  readFileSync(new URL("../data/sample-library.json", import.meta.url), "utf8"),
);

describe("moderate caution on user exercises", () => {
  const conditions = loadExampleConditions().slice(0, 1);
  const condition = conditions[0]!;

  const userExercise: UserExercise = {
    id: "uex_mod",
    routineId: "user_r",
    name: "Farmer carry",
    categories: [],
    equipment: "kettlebell",
    cues: [],
    dose: { mode: "reps", sets: 3, reps: 10, perSide: false },
    riskChosen: { [condition.id]: "moderate" },
    moderateCautions: {},
    kettlebell: true,
    createdAt: "2026-11-16T12:00:00.000Z",
  };

  it("attaches a generic line when caution text is empty", () => {
    const normalized = userExerciseToNormalized(userExercise, conditions);
    const library = importLibrary(snapshot, { conditions });
    const exercisesById = new Map(library.exercises.map((e) => [e.id, e]));
    exercisesById.set(normalized.id, normalized);
    const result = filterExercisesForScheduling([normalized], {
      conditions,
      activeConditionIds: new Set([condition.id]),
      excludedExerciseIds: new Set(),
      exercisesById,
    });
    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0]!.cautions).toContain(
      genericModerateCautionLine(condition.label),
    );
  });

  it("attaches custom caution text when provided", () => {
    const custom = "Use a lighter load and keep a tall posture.";
    const withCustom: UserExercise = {
      ...userExercise,
      moderateCautions: { [condition.id]: custom },
    };
    const normalized = userExerciseToNormalized(withCustom, conditions);
    const result = filterExercisesForScheduling([normalized], {
      conditions,
      activeConditionIds: new Set([condition.id]),
      excludedExerciseIds: new Set(),
      exercisesById: new Map([[normalized.id, normalized]]),
    });
    expect(result.scheduled[0]!.cautions).toEqual([custom]);
  });
});