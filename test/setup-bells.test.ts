import { describe, expect, it } from "vitest";
import { selectHomeBell, selectNoHomeBells } from "../src/setup/bells";

describe("home bell selection", () => {
  it("clears weight chips when No bells at home is chosen", () => {
    const next = selectNoHomeBells();
    expect(next.noHomeBells).toBe(true);
    expect(next.homeBellsKg).toEqual([]);
  });

  it("clears no-home flag when a weight chip is selected", () => {
    const first = selectHomeBell([], 6);
    expect(first.noHomeBells).toBe(false);
    expect(first.homeBellsKg).toEqual([6]);

    const second = selectHomeBell([6, 8], 6);
    expect(second.homeBellsKg).toEqual([8]);
  });

  it("cannot keep weights while no-home is active (rule enforced via UI state)", () => {
    const cleared = selectNoHomeBells();
    expect(cleared.homeBellsKg).toHaveLength(0);
    const after = selectHomeBell(cleared.homeBellsKg, 10);
    expect(after.noHomeBells).toBe(false);
  });
});