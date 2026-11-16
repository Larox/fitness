import { describe, expect, it } from "vitest";
import { loadAppConfig } from "../src/config/load";
import { resolve } from "node:path";
import {
  buildConditionOverridePatch,
  mergeConditionOverride,
  pruneConditionOverrides,
  resolvedConditionLabel,
  tidyConditionName,
} from "../src/setup/condition-overrides";
import { createConditionLabelContext } from "../src/setup/condition-labels";

const root = resolve(import.meta.dirname, "..");
const config = loadAppConfig(resolve(root, "config.example.json"));

describe("condition override storage", () => {
  const concernA = config.conditions.find((c) => c.id === "concern_a")!;

  it("stores only fields that differ from config", () => {
    const patch = buildConditionOverridePatch(
      concernA,
      { label: "Heavy days", notes: concernA.description ?? "" },
      "2026-11-16T12:00:00.000Z",
    );
    expect(patch).toEqual({
      label: "Heavy days",
      updatedAt: "2026-11-16T12:00:00.000Z",
    });
  });

  it("drops fields that match config on prune", () => {
    let overrides = mergeConditionOverride(
      {},
      concernA.id,
      buildConditionOverridePatch(
        concernA,
        { label: "Heavy days", notes: "Custom note" },
        "2026-11-16T12:00:00.000Z",
      ),
    );
    overrides = mergeConditionOverride(
      overrides,
      concernA.id,
      buildConditionOverridePatch(
        concernA,
        { label: concernA.label, notes: "Custom note" },
        "2026-11-16T12:01:00.000Z",
      ),
    );
    const pruned = pruneConditionOverrides(overrides, config);
    expect(pruned[concernA.id]?.label).toBeUndefined();
    expect(pruned[concernA.id]?.notes).toBe("Custom note");
  });

  it("deletes the entry when everything matches config", () => {
    const overrides = mergeConditionOverride(
      {},
      concernA.id,
      buildConditionOverridePatch(
        concernA,
        { label: "Heavy days", notes: concernA.description ?? "" },
        "2026-11-16T12:00:00.000Z",
      ),
    );
    const reset = mergeConditionOverride(
      overrides,
      concernA.id,
      buildConditionOverridePatch(
        concernA,
        { label: concernA.label, notes: concernA.description ?? "" },
        "2026-11-16T12:01:00.000Z",
      ),
    );
    expect(Object.keys(pruneConditionOverrides(reset, config))).toHaveLength(0);
  });

  it("resolves labels through conditionLabel()", () => {
    const overrides = mergeConditionOverride(
      {},
      concernA.id,
      buildConditionOverridePatch(
        concernA,
        { label: "Heavy days", notes: concernA.description ?? "" },
        "2026-11-16T12:00:00.000Z",
      ),
    );
    const ctx = createConditionLabelContext(config, overrides);
    expect(ctx.conditionLabel(concernA.id)).toBe("Heavy days");
    expect(resolvedConditionLabel(concernA, overrides)).toBe("Heavy days");
  });

  it("tidies condition names", () => {
    expect(tidyConditionName("  Heavy   days  ")).toBe("Heavy days");
  });
});