import { describe, expect, it } from "vitest";
import { parseAppConfig } from "../src/config/load";

const base = {
  libraryPath: "data/sample-library.json",
  disclaimerVersion: 1,
  equipment: {
    availableBellsKg: [6, 8],
    home: { bellsKg: [6] },
    gym: { bellsKg: [8] },
  },
};

describe("setup config: zero vs broken", () => {
  it("accepts zero configured conditions as valid", () => {
    const { config, errors } = parseAppConfig({ ...base, conditions: [] });
    expect(errors).toEqual([]);
    expect(config?.conditions).toEqual([]);
  });

  it("fails closed on malformed config (missing equipment)", () => {
    const { config, errors } = parseAppConfig({
      libraryPath: "data/sample-library.json",
      disclaimerVersion: 1,
      conditions: [],
    });
    expect(config).toBeUndefined();
    expect(errors.join(" ")).toMatch(/equipment/i);
  });

  it("fails closed when a condition entry is malformed", () => {
    const { config, errors } = parseAppConfig({
      ...base,
      conditions: [{ id: "", label: "X", libraryField: "x_risk" }],
    });
    expect(config).toBeUndefined();
    expect(errors.length).toBeGreaterThan(0);
  });
});