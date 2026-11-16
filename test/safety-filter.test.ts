import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveExerciseId } from "../src/library/exercise-id";
import { importLibrary } from "../src/library/import";
import {
  effectiveRisk,
  exercisesById,
  filterExercisesForSafety,
  type SafetyConditions,
} from "../src/library/safety-filter";
import type {
  ExerciseOverlayFile,
  NormalizedExercise,
  SnapshotRoutine,
} from "../src/library/types";

const root = resolve(import.meta.dirname, "..");

function loadJson<T>(relativePath: string): T {
  const text = readFileSync(resolve(root, relativePath), "utf8");
  return JSON.parse(text) as T;
}

function ex(
  partial: Partial<NormalizedExercise> & Pick<NormalizedExercise, "id" | "name">,
): NormalizedExercise {
  return {
    routineId: "fixture",
    sets: null,
    reps: null,
    equipment: null,
    cues: [],
    herniaRisk: "low",
    kneeRisk: "low",
    ...partial,
  };
}

const bothOn: SafetyConditions = { hernia: true, genuValgo: true };

describe("filterExercisesForSafety", () => {
  it("schedules low-risk exercises unchanged", () => {
    const id = "ex_low000000000001";
    const map = exercisesById([
      ex({ id, name: "Towel curl", herniaRisk: "low", kneeRisk: "low" }),
    ]);

    const out = filterExercisesForSafety([id], map, bothOn, new Set());

    expect(out).toEqual([{ kind: "scheduled", exerciseId: id }]);
  });

  it("schedules moderate risk with caution attached", () => {
    const id = "ex_mod000000000001";
    const map = exercisesById([
      ex({
        id,
        name: "Banded raise",
        herniaRisk: "moderate",
        kneeRisk: "low",
        caution: "Start with no band.",
      }),
    ]);

    const out = filterExercisesForSafety([id], map, bothOn, new Set());

    expect(out[0]).toMatchObject({
      kind: "scheduled",
      exerciseId: id,
      caution: "Start with no band.",
    });
  });

  it("drops high risk and surfaces the suggested safer move from caution", () => {
    const id = "ex_high00000000001";
    const map = exercisesById([
      ex({
        id,
        name: "Box jumps",
        herniaRisk: "high",
        kneeRisk: "high",
        caution: "High risk; skip for now",
      }),
    ]);

    const out = filterExercisesForSafety([id], map, bothOn, new Set());

    const item = out[0]!;
    expect(item).toMatchObject({
      kind: "dropped",
      exerciseId: id,
      reasons: expect.arrayContaining([expect.stringContaining("high")]),
    });
    expect(item.kind === "dropped" && item.suggestedSaferMove).toBeFalsy();
  });

  it("extracts swap suggestions from caution text when dropping", () => {
    const id = "ex_high00000000002";
    const map = exercisesById([
      ex({
        id,
        name: "Gorilla swing",
        herniaRisk: "high",
        kneeRisk: "high",
        caution:
          "High: front knee likely to cave. Swap: bodyweight split squat holding a wall, knee over toes.",
      }),
    ]);

    const out = filterExercisesForSafety([id], map, bothOn, new Set());
    expect(out[0]).toMatchObject({
      kind: "dropped",
      suggestedSaferMove: "bodyweight split squat holding a wall, knee over toes",
    });
  });

  it("swaps high risk when overlay swap_to targets an allowed exercise", () => {
    const highId = "ex_high00000000003";
    const lowId = "ex_low000000000002";
    const map = exercisesById([
      ex({
        id: highId,
        name: "Dead bug (straight legs)",
        herniaRisk: "high",
        kneeRisk: "low",
        overlay: { swap_to: lowId },
      }),
      ex({ id: lowId, name: "Isometric dead bug", herniaRisk: "low", kneeRisk: "low" }),
    ]);

    const out = filterExercisesForSafety([highId], map, bothOn, new Set());

    expect(out).toEqual([
      {
        kind: "swapped",
        exerciseId: lowId,
        fromExerciseId: highId,
        reason: expect.stringContaining("high hernia risk"),
      },
    ]);
  });

  it("drops when swap target is also high risk for active conditions", () => {
    const highId = "ex_high00000000004";
    const alsoHighId = "ex_high00000000005";
    const map = exercisesById([
      ex({
        id: highId,
        name: "Move A",
        herniaRisk: "high",
        kneeRisk: "low",
        overlay: { swap_to: alsoHighId },
        caution: "Swap: Move B",
      }),
      ex({
        id: alsoHighId,
        name: "Move B",
        herniaRisk: "high",
        kneeRisk: "low",
      }),
    ]);

    const out = filterExercisesForSafety([highId], map, bothOn, new Set());

    expect(out[0]).toMatchObject({
      kind: "dropped",
      exerciseId: highId,
      reasons: expect.arrayContaining([
        expect.stringContaining("swap target"),
      ]),
    });
  });

  it("drops when swap_to id is missing from the library", () => {
    const highId = "ex_high00000000006";
    const map = exercisesById([
      ex({
        id: highId,
        name: "Move C",
        herniaRisk: "high",
        kneeRisk: "low",
        overlay: { swap_to: "ex_missing0000000001" },
      }),
    ]);

    const out = filterExercisesForSafety([highId], map, bothOn, new Set());

    expect(out[0]).toMatchObject({
      kind: "dropped",
      reasons: expect.arrayContaining([expect.stringContaining("not in library")]),
    });
  });

  it("applies max_reps and max_hold_s caps from overlay on scheduled items", () => {
    const id = "ex_cap000000000001";
    const map = exercisesById([
      ex({
        id,
        name: "Glute bridge",
        herniaRisk: "moderate",
        kneeRisk: "moderate",
        overlay: { max_reps: 15, max_hold_s: 10 },
      }),
    ]);

    const out = filterExercisesForSafety([id], map, bothOn, new Set());

    expect(out[0]).toMatchObject({
      kind: "scheduled",
      maxReps: 15,
      maxHoldS: 10,
    });
  });

  it('never schedules excluded ("this hurt") exercises', () => {
    const id = "ex_low000000000003";
    const map = exercisesById([ex({ id, name: "Safe move" })]);

    const out = filterExercisesForSafety([id], map, bothOn, new Set([id]));

    expect(out[0]).toMatchObject({
      kind: "dropped",
      reasons: ['Excluded ("this hurt")'],
    });
  });

  it("does not block on a condition that is turned off", () => {
    const id = "ex_hernia_high_only";
    const map = exercisesById([
      ex({
        id,
        name: "Scorpion",
        herniaRisk: "high",
        kneeRisk: "low",
      }),
    ]);

    const out = filterExercisesForSafety(
      [id],
      map,
      { hernia: false, genuValgo: true },
      new Set(),
    );

    expect(out[0]).toEqual({ kind: "scheduled", exerciseId: id });
  });

  it("still blocks on the active condition when the other is off", () => {
    const id = "ex_knee_high_only";
    const map = exercisesById([
      ex({
        id,
        name: "Shinbox",
        herniaRisk: "low",
        kneeRisk: "high",
        caution: "keep feet wide, small range, or skip",
      }),
    ]);

    const out = filterExercisesForSafety(
      [id],
      map,
      { hernia: true, genuValgo: false },
      new Set(),
    );

    expect(out[0]).toEqual({ kind: "scheduled", exerciseId: id });
  });
});

describe("filterExercisesForSafety on real snapshot", () => {
  it("leaves no high-risk exercise scheduled when hernia and genu valgo are on", () => {
    const snapshot = loadJson<SnapshotRoutine[]>("data/snapshot/index.json");
    const overlay = loadJson<ExerciseOverlayFile>("data/overlay.json");
    const { exercises, errors } = importLibrary(snapshot, overlay);

    expect(errors).toEqual([]);

    const byId = exercisesById(exercises);
    const candidateIds = exercises.map((e) => e.id);
    const conditions: SafetyConditions = { hernia: true, genuValgo: true };
    const result = filterExercisesForSafety(
      candidateIds,
      byId,
      conditions,
      new Set(),
    );

    const scheduled = result.filter(
      (r) => r.kind === "scheduled" || r.kind === "swapped",
    );

    for (const item of scheduled) {
      const exercise = byId.get(item.exerciseId);
      expect(exercise).toBeDefined();
      expect(effectiveRisk(exercise!, conditions)).not.toBe("high");
    }

    const deadBugHighId = deriveExerciseId("DcuHt3YSdKJ", "Dead bug");
    const swappedDeadBug = result.find(
      (r) => r.kind === "swapped" && r.fromExerciseId === deadBugHighId,
    );
    expect(swappedDeadBug).toBeDefined();
  });
});