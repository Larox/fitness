import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAppConfig, parseAppConfig } from "../src/config/load";

const root = resolve(import.meta.dirname, "..");

describe("app config", () => {
  it("loads the committed example config", () => {
    const config = loadAppConfig(resolve(root, "config.example.json"));
    expect(config.libraryPath).toBe("data/sample-library.json");
    expect(config.conditions).toHaveLength(2);
    expect(config.conditions[0]!.libraryField).toMatch(/_risk$/);
  });

  it("loads equipment keys from the example config", () => {
    const config = loadAppConfig(resolve(root, "config.example.json"));
    expect(config.equipment.home.bellsKg).toContain(6);
    expect(config.equipment.availableBellsKg.length).toBeGreaterThan(0);
    expect(config.disclaimerVersion).toBe(1);
  });

  it("allows an empty conditions array", () => {
    const { config, errors } = parseAppConfig({
      libraryPath: "data/sample-library.json",
      disclaimerVersion: 1,
      conditions: [],
      equipment: {
        availableBellsKg: [6],
        home: { bellsKg: [6] },
        gym: { bellsKg: [6] },
      },
    });
    expect(errors).toEqual([]);
    expect(config?.conditions).toEqual([]);
  });

  it("rejects configs missing required equipment block", () => {
    const { errors } = parseAppConfig({
      libraryPath: "data/sample-library.json",
      disclaimerVersion: 1,
      conditions: [],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});