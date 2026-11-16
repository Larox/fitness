import { describe, expect, it } from "vitest";
import {
  normalizeCategories,
  normalizeDurationMin,
  normalizeRisk,
} from "../src/library/normalize";

describe("normalizeRisk", () => {
  it("passes through valid levels", () => {
    expect(normalizeRisk("low")).toBe("low");
    expect(normalizeRisk("moderate")).toBe("moderate");
    expect(normalizeRisk("high")).toBe("high");
  });

  it("defaults missing or invalid to high", () => {
    expect(normalizeRisk(undefined)).toBe("high");
  });
});

describe("normalizeCategories", () => {
  it("splits slash- and comma-separated strings", () => {
    expect(normalizeCategories("feet / ankles, mobility")).toEqual([
      "feet",
      "ankles",
      "mobility",
    ]);
  });

  it("trims array entries", () => {
    expect(normalizeCategories(["feet", " mobility/rehab "])).toEqual([
      "feet",
      "mobility/rehab",
    ]);
  });
});

describe("normalizeDurationMin", () => {
  it("handles numbers, ranges, and null", () => {
    expect(normalizeDurationMin(5)).toEqual({
      display: "5",
      min: 5,
      max: 5,
    });
    expect(normalizeDurationMin("3-10")).toEqual({
      display: "3-10",
      min: 3,
      max: 10,
    });
    expect(normalizeDurationMin(null)).toBeNull();
  });
});