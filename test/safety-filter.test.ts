import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAppConfig } from "../src/config/load";
import { deriveExerciseId } from "../src/library/exercise-id";
import { importLibrary } from "../src/library/import";
import type { ExerciseOverlayFile, NormalizedExercise, SnapshotRoutine } from "../src/library/types";
import {
  effectiveRiskForActiveConditions,
  filterExercisesForScheduling,
  scheduledRowIsSafeForActiveConditions,
} from "../src/safety/filter";
import type { SafetyFilterContext } from "../src/safety/types";
import { loadExampleConditions } from "./helpers";

const root = resolve(import.meta.dirname, "..");
const conditions = loadExampleConditions();

function loadJson<T>(relativePath: string): T {
  const text = readFileSync(resolve(root, relativePath), "utf8");
  return JSON.parse(text) as T;
}

function buildContext(
  exercises: NormalizedExercise[],
  options: {
    activeConditionIds?: ReadonlySet<string>;
    excludedExerciseIds?: ReadonlySet<string>;
    routineNotes?: Record<string, string | undefined>;
  } = {},
): SafetyFilterContext {
  const active = options.activeConditionIds ?? new Set(conditions.map((c) => c.id));
  return {
    conditions,
    activeConditionIds: active,
    excludedExerciseIds: options.excludedExerciseIds ?? new Set(),
    exercisesById: new Map(exercises.map((e) => [e.id, e])),
    routineNotesById: new Map(Object.entries(options.routineNotes ?? {})),
  };
}

function importFixture(overlay: ExerciseOverlayFile = {}): NormalizedExercise[] {
  const snapshot = loadJson<SnapshotRoutine[]>("test/fixtures/safety-filter.json");
  const result = importLibrary(snapshot, { conditions }, overlay);
  expect(result.errors).toEqual([]);
  return result.exercises;
}

describe("filterExercisesForScheduling", () => {
  it("never schedules high risk for an active condition", () => {
    const exercises = importFixture();
    const high = exercises.find((e) => e.name === "Fixture high no swap")!;
    const result = filterExercisesForScheduling([high], buildContext(exercises));

    expect(result.scheduled).toHaveLength(0);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]!.reasons[0]).toContain("high risk");
  });

  it("swaps high risk to an allowed existing target", () => {
    const targetId = deriveExerciseId("fixture_safety", "Fixture swap target");
    const sourceId = deriveExerciseId("fixture_safety", "Fixture high swap ok");
    const overlay: ExerciseOverlayFile = {
      [sourceId]: { swap_to: targetId },
    };
    const exercises = importFixture(overlay);
    const source = exercises.find((e) => e.id === sourceId)!;
    const result = filterExercisesForScheduling([source], buildContext(exercises));

    expect(result.dropped).toHaveLength(0);
    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0]!.exerciseId).toBe(targetId);
    expect(result.scheduled[0]!.sourceExerciseId).toBe(sourceId);
    expect(result.scheduled[0]!.reasons.join(" ")).toContain("Swapped");
  });

  it("does not swap into another high-risk exercise", () => {
    const badTargetId = deriveExerciseId("fixture_safety", "Fixture bad swap target");
    const sourceId = deriveExerciseId("fixture_safety", "Fixture high swap bad");
    const overlay: ExerciseOverlayFile = {
      [sourceId]: { swap_to: badTargetId },
    };
    const exercises = importFixture(overlay);
    const source = exercises.find((e) => e.id === sourceId)!;
    const result = filterExercisesForScheduling([source], buildContext(exercises));

    expect(result.scheduled).toHaveLength(0);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]!.reasons[0]).toContain("high risk");
  });

  it("drops high risk when swap_to points to a missing exercise id", () => {
    const sourceId = deriveExerciseId("fixture_safety", "Fixture high swap ok");
    const overlay: ExerciseOverlayFile = {
      [sourceId]: { swap_to: "ex_missing00000000" },
    };
    const importResult = importLibrary(
      loadJson<SnapshotRoutine[]>("test/fixtures/safety-filter.json"),
      { conditions },
      overlay,
    );
    expect(importResult.errors).toHaveLength(1);
    const exercises = importLibrary(
      loadJson<SnapshotRoutine[]>("test/fixtures/safety-filter.json"),
      { conditions },
      {},
    ).exercises;
    const source = exercises.find((e) => e.id === sourceId)!;
    const localOverlay = { swap_to: "ex_missing00000000" };
    const withFakeSwap: NormalizedExercise = {
      ...source,
      overlay: localOverlay,
    };
    const result = filterExercisesForScheduling(
      [withFakeSwap],
      buildContext(exercises),
    );

    expect(result.scheduled).toHaveLength(0);
    expect(result.dropped).toHaveLength(1);
  });

  it("schedules moderate risk with caution attached", () => {
    const exercises = importFixture();
    const moderate = exercises.find((e) => e.name === "Fixture moderate caution")!;
    const result = filterExercisesForScheduling([moderate], buildContext(exercises));

    expect(result.dropped).toHaveLength(0);
    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0]!.cautions).toEqual(["Ease in slowly"]);
    expect(result.scheduled[0]!.reasons[0]).toContain("moderate risk");
  });

  it("clamps reps with overlay max_reps", () => {
    const capId = deriveExerciseId("fixture_safety", "Fixture cap reps");
    const overlay: ExerciseOverlayFile = { [capId]: { max_reps: 10 } };
    const exercises = importFixture(overlay);
    const cap = exercises.find((e) => e.id === capId)!;
    const result = filterExercisesForScheduling([cap], buildContext(exercises));

    expect(result.scheduled[0]!.reps).toBe("10");
  });

  it("clamps hold time with overlay max_hold_s", () => {
    const capId = deriveExerciseId("fixture_safety", "Fixture cap hold");
    const overlay: ExerciseOverlayFile = { [capId]: { max_hold_s: 30 } };
    const exercises = importFixture(overlay);
    const cap = exercises.find((e) => e.id === capId)!;
    const result = filterExercisesForScheduling([cap], buildContext(exercises));

    expect(result.scheduled[0]!.hold_s).toBe(30);
    expect(String(result.scheduled[0]!.reps)).toContain("30");
  });

  it("never schedules excluded exercises", () => {
    const exercises = importFixture();
    const excluded = exercises.find((e) => e.name === "Fixture excluded")!;
    const result = filterExercisesForScheduling(
      [excluded],
      buildContext(exercises, { excludedExerciseIds: new Set([excluded.id]) }),
    );

    expect(result.scheduled).toHaveLength(0);
    expect(result.dropped[0]!.reasons[0]).toContain("excluded");
  });

  it("does not block when a condition is off but keeps its risk visible", () => {
    const exercises = importFixture();
    const high = exercises.find((e) => e.name === "Fixture inactive blocks off")!;
    const result = filterExercisesForScheduling(
      [high],
      buildContext(exercises, { activeConditionIds: new Set(["concern_b"]) }),
    );

    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0]!.conditionRisks.concern_a).toBe("high");
    expect(result.scheduled[0]!.exerciseId).toBe(high.id);
  });

  it("records routine notes as a safer-move suggestion when dropping", () => {
    const exercises = importFixture();
    const high = exercises.find((e) => e.name === "Fixture high no swap")!;
    const result = filterExercisesForScheduling(
      [high],
      buildContext(exercises, {
        routineNotes: {
          fixture_safety: "Safer option: try the gentle march pattern instead.",
        },
      }),
    );

    expect(result.dropped[0]!.saferMoveSuggestion).toContain("gentle march");
  });
});

describe("filterExercisesForScheduling on sample library", () => {
  it("leaves no high-risk exercise in the schedule when all conditions are active", () => {
    const config = loadAppConfig("config.example.json");
    const snapshot = loadJson<SnapshotRoutine[]>(config.libraryPath);
    const overlay = loadJson<ExerciseOverlayFile>(config.overlayPath ?? "data/overlay.json");
    const imported = importLibrary(snapshot, { conditions }, overlay);
    expect(imported.errors).toEqual([]);

    const active = new Set(conditions.map((c) => c.id));
    const context = buildContext(imported.exercises, { activeConditionIds: active });
    const result = filterExercisesForScheduling(imported.exercises, context);

    expect(
      result.scheduled.every((row) => scheduledRowIsSafeForActiveConditions(row, active)),
    ).toBe(true);

    for (const row of result.scheduled) {
      const performed = context.exercisesById.get(row.exerciseId)!;
      expect(effectiveRiskForActiveConditions(performed, active)).not.toBe("high");
    }

    const bounceId = deriveExerciseId("sample_routine_two", "Aggressive bounce");
    const swapped = result.scheduled.find((r) => r.sourceExerciseId === bounceId);
    expect(swapped?.exerciseId).toBe(
      deriveExerciseId("sample_routine_two", "Swap target stretch"),
    );
  });
});