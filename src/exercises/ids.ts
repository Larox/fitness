/** Create a stable user routine id once per new exercise. */
export function createUserRoutineId(): string {
  return `user_${crypto.randomUUID()}`;
}

/** Stable exercise id for a user-authored row (does not change on rename). */
export function createUserExerciseId(): string {
  return `uex_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}