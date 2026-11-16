import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAppConfig } from "../src/config/load";
import { importLibrary } from "../src/library/import";
import type { SnapshotRoutine } from "../src/library/types";
import { filterExercisesForScheduling } from "../src/safety/filter";
import { createConditionLabelContext } from "../src/setup/condition-labels";
import { mergeConditionOverride, buildConditionOverridePatch } from "../src/setup/condition-overrides";

const root = resolve(import.meta.dirname, "..");
const config = loadAppConfig(resolve(root, "config.example.json"));

describe("safety filter ignores renames", () => {
  it("schedules the same exercises when only the display label changes", () => {
    const snapshot = JSON.parse(
      readFileSync(resolve(root, "test/fixtures/safety-filter.json"), "utf8"),
    ) as SnapshotRoutine[];
    const { exercises } = importLibrary(snapshot, config, {});
    const high = exercises.find(
      (e) => e.name === "Fixture high no swap",
    )!;
    const active = new Set(["concern_a"]);

    const baseline = filterExercisesForScheduling([high], {
      conditions: config.conditions,
      activeConditionIds: active,
      excludedExerciseIds: new Set(),
      exercisesById: new Map(exercises.map((e) => [e.id, e])),
    });

    const concernA = config.conditions.find((c) => c.id === "concern_a")!;
    const overrides = mergeConditionOverride(
      {},
      concernA.id,
      buildConditionOverridePatch(
        concernA,
        { label: "Completely different name", notes: concernA.description ?? "" },
        "2026-11-16T12:00:00.000Z",
      ),
    );
    const labels = createConditionLabelContext(config, overrides);

    const renamed = filterExercisesForScheduling([high], {
      conditions: config.conditions,
      activeConditionIds: active,
      excludedExerciseIds: new Set(),
      exercisesById: new Map(exercises.map((e) => [e.id, e])),
      conditionLabel: labels.conditionLabel,
    });

    expect(renamed.scheduled).toHaveLength(baseline.scheduled.length);
    expect(renamed.dropped).toHaveLength(baseline.dropped.length);
    expect(renamed.dropped[0]?.reasons[0]).toContain("Completely different name");
    expect(renamed.dropped[0]?.reasons[0]).not.toContain(concernA.label);
  });

});