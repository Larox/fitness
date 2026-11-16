import { describe, expect, it } from "vitest";
import { deleteUserExercise } from "../src/exercises/delete";
import type { UserExercise } from "../src/exercises/types";

describe("delete user exercise", () => {
  const exercise: UserExercise = {
    id: "uex_del",
    routineId: "user_del",
    name: "Bear crawl",
    categories: [],
    equipment: "",
    cues: [],
    dose: { mode: "reps", sets: 3, reps: 12, perSide: false },
    riskChosen: { concern_a: "low" },
    moderateCautions: {},
    kettlebell: false,
    createdAt: "2026-11-16T12:00:00.000Z",
  };

  it("removes from upcoming sessions and keeps a history snapshot", () => {
    const weekSessions = [
      { sessionId: "s1", exerciseIds: ["uex_del", "other"] },
      { sessionId: "s2", exerciseIds: ["uex_del"] },
    ];
    const result = deleteUserExercise(
      exercise.id,
      [exercise],
      [],
      weekSessions,
      [{ exerciseId: exercise.id, markedAt: "2026-11-15T10:00:00.000Z", from: "today" }],
      new Date("2026-11-16T12:00:00.000Z"),
    );
    expect(result).not.toBeNull();
    expect(result!.userExercises).toHaveLength(0);
    expect(result!.weekSessionsRemaining[0]!.exerciseIds).toEqual(["other"]);
    expect(result!.weekSessionsRemaining[1]!.exerciseIds).toEqual([]);
    expect(result!.deletedHistory).toHaveLength(1);
    expect(result!.deletedHistory[0]!.exerciseId).toBe(exercise.id);
    expect(result!.deletedHistory[0]!.snapshot.name).toBe("Bear crawl");
    expect(result!.hurtExclusions).toHaveLength(0);
  });
});