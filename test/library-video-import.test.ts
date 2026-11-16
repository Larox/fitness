import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { importLibrary } from "../src/library/import";
import type { SnapshotRoutine } from "../src/library/types";
import { loadExampleConditions } from "./helpers";

const conditions = loadExampleConditions();
const root = resolve(import.meta.dirname, "..");

function loadJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8")) as T;
}

describe("library routine video import", () => {
  it("carries a valid video path on the normalized routine", () => {
    const snapshot = loadJson<SnapshotRoutine[]>("test/fixtures/routine-videos.json");
    const result = importLibrary([snapshot[0]!], { conditions }, {});

    expect(result.errors).toEqual([]);
    expect(result.routines[0]?.video).toBe("media/reels/fixture_one.mp4");
  });

  it("rejects invalid video paths without importing", () => {
    const snapshot = loadJson<SnapshotRoutine[]>("test/fixtures/routine-videos.json");
    const result = importLibrary(snapshot, { conditions }, {});

    expect(result.routines).toEqual([]);
    expect(result.errors.some((err) => err.includes("not a URL"))).toBe(true);
  });
});