import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config/types";
import {
  acknowledgeDisclaimer,
  needsDisclaimerAcknowledgement,
} from "../src/setup/disclaimer";
import { initialPersistedState } from "../src/setup/defaults";

function minimalConfig(version: number): AppConfig {
  return {
    libraryPath: "data/sample-library.json",
    disclaimerVersion: version,
    conditions: [],
    equipment: {
      availableBellsKg: [6],
      home: { bellsKg: [6] },
      gym: { bellsKg: [6] },
    },
  };
}

describe("versioned disclaimer", () => {
  it("requires acknowledgement before any version is stored", () => {
    const config = minimalConfig(1);
    const state = initialPersistedState(config);
    expect(needsDisclaimerAcknowledgement(state, config)).toBe(true);
  });

  it("does not block when the stored version matches config", () => {
    const config = minimalConfig(2);
    let state = initialPersistedState(config);
    state = acknowledgeDisclaimer(state, config, new Date("2026-11-16T12:00:00.000Z"));
    expect(needsDisclaimerAcknowledgement(state, config)).toBe(false);
  });

  it("shows the disclaimer again after a version bump", () => {
    const configV1 = minimalConfig(1);
    let state = initialPersistedState(configV1);
    state = acknowledgeDisclaimer(state, configV1, new Date("2026-11-16T12:00:00.000Z"));

    const configV2 = minimalConfig(2);
    expect(needsDisclaimerAcknowledgement(state, configV2)).toBe(true);
  });
});