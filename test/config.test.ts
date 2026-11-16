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

  it("rejects configs without conditions", () => {
    const { errors } = parseAppConfig({ libraryPath: "data/sample-library.json" });
    expect(errors.length).toBeGreaterThan(0);
  });
});