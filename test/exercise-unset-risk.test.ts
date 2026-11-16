import { describe, expect, it } from "vitest";
import { loadExampleConditions } from "./helpers";
import { effectiveRiskLevel, userExerciseNeverPlanned } from "../src/exercises/risk";
import { scheduleUserExercise } from "../src/exercises/planning";
import { filterExercisesForScheduling } from "../src/safety/filter";
import { userExerciseToNormalized } from "../src/exercises/to-normalized";
import { activeConditionIds } from "../src/setup/defaults";
import { defaultTrainingSettings } from "../src/setup/defaults";
import type { AppConfig } from "../src/config/types";
import type { UserExercise } from "../src/exercises/types";

function minimalConfig(): AppConfig {
  return {
    libraryPath: "data/sample-library.json",
    disclaimerVersion: 1,
    conditions: loadExampleConditions(),
    equipment: {
      availableBellsKg: [6],
      home: { bellsKg: [6] },
      gym: { bellsKg: [8] },
    },
  };
}

function sampleUserExercise(partial?: Partial<UserExercise>): UserExercise {
  return {
    id: "uex_test123",
    routineId: "user_abc",
    name: "Wall sit",
    categories: ["stability"],
    equipment: "",
    cues: [],
    dose: { mode: "hold", sets: 3, holdS: 45, perSide: false },
    riskChosen: {},
    moderateCautions: {},
    kettlebell: false,
    createdAt: "2026-11-16T12:00:00.000Z",
    ...partial,
  };
}

describe("unset user condition risk", () => {
  const config = minimalConfig();

  it("counts as high for effective risk", () => {
    const ex = sampleUserExercise();
    expect(effectiveRiskLevel(ex, config.conditions[0]!.id)).toBe("high");
  });

  it("is never planned while any risk stays unset", () => {
    const ex = sampleUserExercise();
    expect(userExerciseNeverPlanned(ex, config.conditions)).toBe(true);
    const settings = defaultTrainingSettings(config);
    const context = {
      conditions: config.conditions,
      activeConditionIds: activeConditionIds(settings),
      excludedExerciseIds: new Set<string>(),
      exercisesById: new Map(),
    };
    const result = scheduleUserExercise(ex, context, config.conditions);
    expect(result.scheduled).toHaveLength(0);
    expect(result.dropped).toHaveLength(1);
    const viaFilter = filterExercisesForScheduling(
      [userExerciseToNormalized(ex, config.conditions)],
      { ...context, exercisesById: new Map() },
    );
    expect(viaFilter.scheduled).toHaveLength(0);
  });

  it("can be planned once every condition has an explicit level", () => {
    const ex = sampleUserExercise({
      riskChosen: Object.fromEntries(config.conditions.map((c) => [c.id, "low" as const])),
    });
    const normalized = userExerciseToNormalized(ex, config.conditions);
    const settings = defaultTrainingSettings(config);
    const result = filterExercisesForScheduling([normalized], {
      conditions: config.conditions,
      activeConditionIds: activeConditionIds(settings),
      excludedExerciseIds: new Set(),
      exercisesById: new Map([[normalized.id, normalized]]),
    });
    expect(result.scheduled).toHaveLength(1);
  });
});