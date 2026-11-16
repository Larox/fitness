import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config/types";
import {
  DEFAULT_DAYS_PER_WEEK,
  DEFAULT_SESSION_MINUTES,
} from "../src/setup/schedule";
import { mergePersistedState, sanitizeTrainingSettings } from "../src/setup/merge";

function minimalConfig(): AppConfig {
  return {
    libraryPath: "data/sample-library.json",
    disclaimerVersion: 1,
    conditions: [
      {
        id: "concern_a",
        label: "Concern A",
        libraryField: "concern_a_risk",
      },
    ],
    equipment: {
      availableBellsKg: [6, 8],
      home: { bellsKg: [6] },
      gym: { bellsKg: [8] },
    },
  };
}

describe("mergePersistedState", () => {
  it("falls back when days per week is outside the allowed range", () => {
    const config = minimalConfig();
    const merged = mergePersistedState(
      {
        setupComplete: true,
        settings: {
          daysPerWeek: 6,
          sessionMinutes: 30,
          homeBellsKg: [6],
          noHomeBells: false,
          gymBellsKg: [8],
          conditionsEnabled: { concern_a: false },
        },
      },
      config,
    );
    expect(merged.settings.daysPerWeek).toBe(DEFAULT_DAYS_PER_WEEK);
  });

  it("falls back when session length is not one of the fixed options", () => {
    const config = minimalConfig();
    const merged = mergePersistedState(
      {
        setupComplete: true,
        settings: {
          daysPerWeek: 4,
          sessionMinutes: 99,
          homeBellsKg: [6],
          noHomeBells: false,
          gymBellsKg: [8],
          conditionsEnabled: { concern_a: true },
        },
      },
      config,
    );
    expect(merged.settings.sessionMinutes).toBe(DEFAULT_SESSION_MINUTES);
  });

  it("defaults condition switches on when stored values are missing or invalid", () => {
    const config = minimalConfig();
    const merged = mergePersistedState(
      {
        setupComplete: true,
        settings: {
          daysPerWeek: 4,
          sessionMinutes: 30,
          homeBellsKg: [6],
          noHomeBells: false,
          gymBellsKg: [8],
          conditionsEnabled: { concern_a: "yes" as unknown as boolean },
        },
      },
      config,
    );
    expect(merged.settings.conditionsEnabled.concern_a).toBe(true);
  });

  it("keeps explicit off for a configured condition", () => {
    const config = minimalConfig();
    const merged = mergePersistedState(
      {
        setupComplete: true,
        settings: {
          daysPerWeek: 4,
          sessionMinutes: 30,
          homeBellsKg: [6],
          noHomeBells: false,
          gymBellsKg: [8],
          conditionsEnabled: { concern_a: false },
        },
      },
      config,
    );
    expect(merged.settings.conditionsEnabled.concern_a).toBe(false);
  });

  it("falls back to defaults when persisted settings are not an object", () => {
    const config = minimalConfig();
    const merged = mergePersistedState(
      {
        setupComplete: true,
        settings: null as unknown as import("../src/setup/types").TrainingSettings,
      },
      config,
    );
    expect(merged.settings.daysPerWeek).toBe(DEFAULT_DAYS_PER_WEEK);
    expect(merged.settings.conditionsEnabled.concern_a).toBe(true);
    expect(merged.setupComplete).toBe(false);
  });

  it("does not throw on completely corrupted storage payloads", () => {
    const config = minimalConfig();
    expect(() =>
      mergePersistedState({ notSettings: true } as unknown as null, config),
    ).not.toThrow();
    const merged = mergePersistedState(
      { notSettings: true } as unknown as null,
      config,
    );
    expect(merged.settings).toEqual(sanitizeTrainingSettings(undefined, config));
  });
});