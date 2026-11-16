import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAppConfig } from "../src/config/load";
import { deriveExerciseId } from "../src/library/exercise-id";
import { importLibrary } from "../src/library/import";
import type { SnapshotRoutine } from "../src/library/types";
import { defaultTrainingSettings } from "../src/setup/defaults";
import { reFilterRemainingWeekSessions } from "../src/setup/re-filter";

const root = resolve(import.meta.dirname, "..");
const config = loadAppConfig(resolve(root, "config.example.json"));

describe("safety-relevant edit re-filters remaining sessions", () => {
  it("drops a high-risk exercise when a condition is turned back on", () => {
    const snapshot = JSON.parse(
      readFileSync(resolve(root, "test/fixtures/safety-filter.json"), "utf8"),
    ) as SnapshotRoutine[];
    const { exercises } = importLibrary(snapshot, config, {});
    const byId = new Map(exercises.map((e) => [e.id, e]));
    const highId = deriveExerciseId("fixture_safety", "Fixture high no swap");

    const settings = defaultTrainingSettings(config);
    settings.conditionsEnabled.concern_a = false;

    const withConditionOff = reFilterRemainingWeekSessions(
      [{ sessionId: "wed", exerciseIds: [highId] }],
      settings,
      config.conditions,
      byId,
    );
    expect(withConditionOff[0]!.scheduledExerciseIds).toContain(highId);

    settings.conditionsEnabled.concern_a = true;
    const withConditionOn = reFilterRemainingWeekSessions(
      [{ sessionId: "wed", exerciseIds: [highId] }],
      settings,
      config.conditions,
      byId,
    );
    expect(withConditionOn[0]!.scheduledExerciseIds).toHaveLength(0);
    expect(withConditionOn[0]!.droppedExerciseIds).toContain(highId);
  });
});