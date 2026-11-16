import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveExerciseId } from "../src/library/exercise-id";
import { importLibrary } from "../src/library/import";
import type { ExerciseOverlayFile, SnapshotRoutine } from "../src/library/types";

const root = resolve(import.meta.dirname, "..");

function loadJson<T>(relativePath: string): T {
  const text = readFileSync(resolve(root, relativePath), "utf8");
  return JSON.parse(text) as T;
}

describe("importLibrary", () => {
  it("imports the real snapshot with routines and stable exercise IDs", () => {
    const snapshot = loadJson<SnapshotRoutine[]>("data/snapshot/index.json");
    const result = importLibrary(snapshot, {});

    expect(result.errors).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.routines.length).toBe(20);
    expect(result.exercises.length).toBe(74);

    const legsUp = result.exercises.find((e) => e.name === "Legs up the wall");
    expect(legsUp).toBeDefined();
    expect(legsUp!.id).toBe(deriveExerciseId("DfiTJijMlPQ", "Legs up the wall"));
    expect(legsUp!.id).toMatch(/^ex_[a-f0-9]{16}$/);
  });

  it("treats missing exercise risk fields as high (fail closed)", () => {
    const snapshot = loadJson<SnapshotRoutine[]>("test/fixtures/missing-risk.json");
    const result = importLibrary(snapshot, {});

    expect(result.errors).toEqual([]);
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0]!.herniaRisk).toBe("high");
    expect(result.exercises[0]!.kneeRisk).toBe("high");
  });

  it("rejects overlay swap_to when the target exercise id is unknown", () => {
    const snapshot = loadJson<SnapshotRoutine[]>("test/fixtures/missing-risk.json");
    const exerciseId = deriveExerciseId("fixture_risk", "No risk fields exercise");
    const overlay: ExerciseOverlayFile = {
      [exerciseId]: { swap_to: "ex_does_not_exist0000" },
    };

    const result = importLibrary(snapshot, overlay);

    expect(result.routines).toEqual([]);
    expect(result.exercises).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("unknown exercise id");
  });

  it("skips routines with no exercises and records a reason", () => {
    const snapshot = loadJson<SnapshotRoutine[]>("test/fixtures/empty-routine.json");
    const result = importLibrary(snapshot, {});

    expect(result.routines).toEqual([]);
    expect(result.exercises).toEqual([]);
    expect(result.skipped).toEqual([
      {
        routineId: "fixture_empty",
        title: "Fixture: no exercises",
        reason: "Routine has no exercises",
      },
    ]);
  });

  it("normalizes category strings and duration ranges", () => {
    const snapshot = loadJson<SnapshotRoutine[]>("test/fixtures/normalize.json");
    const result = importLibrary(snapshot, {});

    expect(result.errors).toEqual([]);
    expect(result.routines).toHaveLength(1);

    const routine = result.routines[0]!;
    expect(routine.categories).toEqual(["feet", "ankles", "mobility"]);
    expect(routine.durationMin).toEqual({
      display: "10-15",
      min: 10,
      max: 15,
    });

    const exercise = result.exercises[0]!;
    expect(exercise.cues).toEqual(["line one", "line two"]);
    expect(exercise.kneeRisk).toBe("moderate");
  });

  it("accepts overlay swap_to when the target id exists in the library", () => {
    const real = loadJson<SnapshotRoutine[]>("data/snapshot/index.json");
    const targetId = deriveExerciseId(
      "DeOwTlTyqlK",
      "Couch stretch / half-kneeling hip flexor stretch",
    );
    const sourceId = deriveExerciseId("DeOwTlTyqlK", "Alternating V-up");
    const overlay: ExerciseOverlayFile = {
      [sourceId]: { swap_to: targetId, max_reps: 8, location: "home" },
    };

    const result = importLibrary(real, overlay);

    expect(result.errors).toEqual([]);
    const swapped = result.exercises.find((e) => e.id === sourceId);
    expect(swapped?.overlay?.swap_to).toBe(targetId);
    expect(swapped?.overlay?.location).toBe("home");
  });
});