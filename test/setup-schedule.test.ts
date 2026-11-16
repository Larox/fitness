import { describe, expect, it } from "vitest";
import {
  clampDaysPerWeek,
  DAYS_PER_WEEK_MAX,
  DAYS_PER_WEEK_MIN,
  daysPerWeekHint,
} from "../src/setup/schedule";

describe("days per week bounds", () => {
  it("clamps below minimum to 2", () => {
    expect(clampDaysPerWeek(0)).toBe(DAYS_PER_WEEK_MIN);
    expect(clampDaysPerWeek(1)).toBe(DAYS_PER_WEEK_MIN);
  });

  it("clamps above maximum to 5", () => {
    expect(clampDaysPerWeek(6)).toBe(DAYS_PER_WEEK_MAX);
    expect(clampDaysPerWeek(7)).toBe(DAYS_PER_WEEK_MAX);
  });

  it("keeps values inside 2-5", () => {
    expect(clampDaysPerWeek(3)).toBe(3);
    expect(clampDaysPerWeek(5)).toBe(5);
  });

  it("describes day 5 as a light mobility day", () => {
    expect(daysPerWeekHint(5)).toContain("mobility");
    expect(daysPerWeekHint(4)).not.toContain("mobility");
  });
});