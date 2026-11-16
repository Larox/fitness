import { deriveExerciseId } from "./exercise-id";
import {
  aggregateRoutineRisk,
  normalizeCategories,
  normalizeCues,
  normalizeDurationMin,
  normalizeRisk,
} from "./normalize";
import type {
  ExerciseOverlayFile,
  LibraryImportResult,
  NormalizedExercise,
  NormalizedRoutine,
  SnapshotExercise,
  SnapshotRoutine,
  SkippedRoutine,
} from "./types";

export function importLibrary(
  snapshot: SnapshotRoutine[],
  overlay: ExerciseOverlayFile = {},
): LibraryImportResult {
  const routines: NormalizedRoutine[] = [];
  const exercises: NormalizedExercise[] = [];
  const skipped: SkippedRoutine[] = [];
  const errors: string[] = [];
  const exerciseIdSet = new Set<string>();

  const registerExerciseIds = (list: SnapshotRoutine[]): void => {
    for (const routine of list) {
      const rawExercises = routine.exercises ?? [];
      for (const ex of rawExercises) {
        exerciseIdSet.add(deriveExerciseId(routine.id, ex.name));
      }
    }
  };

  registerExerciseIds(snapshot);

  for (const [exerciseId, entry] of Object.entries(overlay)) {
    if (entry.swap_to !== undefined && !exerciseIdSet.has(entry.swap_to)) {
      errors.push(
        `overlay[${exerciseId}].swap_to references unknown exercise id: ${entry.swap_to}`,
      );
    }
  }

  if (errors.length > 0) {
    return { routines: [], exercises: [], skipped: [], errors };
  }

  for (const routine of snapshot) {
    const rawExercises = routine.exercises;
    if (!rawExercises || rawExercises.length === 0) {
      skipped.push({
        routineId: routine.id,
        title: routine.title,
        reason: "Routine has no exercises",
      });
      continue;
    }

    const normalizedExercises: NormalizedExercise[] = [];
    const exerciseHernia: ReturnType<typeof normalizeRisk>[] = [];
    const exerciseKnee: ReturnType<typeof normalizeRisk>[] = [];

    for (const ex of rawExercises) {
      const normalized = normalizeExercise(routine.id, ex, overlay);
      normalizedExercises.push(normalized);
      exerciseHernia.push(normalized.herniaRisk);
      exerciseKnee.push(normalized.kneeRisk);
    }

    const { herniaRisk, kneeRisk } = aggregateRoutineRisk(
      routine,
      exerciseHernia,
      exerciseKnee,
    );

    routines.push({
      id: routine.id,
      title: routine.title,
      source: routine.source,
      categories: normalizeCategories(routine.category),
      equipment: routine.equipment ?? [],
      frequency: routine.frequency ?? null,
      durationMin: normalizeDurationMin(routine.duration_min),
      difficulty: routine.difficulty ?? null,
      notes: routine.notes,
      herniaRisk,
      kneeRisk,
      exerciseIds: normalizedExercises.map((e) => e.id),
    });

    exercises.push(...normalizedExercises);
  }

  return { routines, exercises, skipped, errors };
}

function normalizeExercise(
  routineId: string,
  ex: SnapshotExercise,
  overlay: ExerciseOverlayFile,
): NormalizedExercise {
  const id = deriveExerciseId(routineId, ex.name);
  const overlayEntry = overlay[id];

  return {
    id,
    routineId,
    name: ex.name,
    sets: ex.sets ?? null,
    reps: ex.reps ?? null,
    equipment: ex.equipment ?? null,
    cues: normalizeCues(ex.cues),
    caution: ex.caution,
    herniaRisk: normalizeRisk(ex.hernia_risk),
    kneeRisk: normalizeRisk(ex.knee_risk),
    overlay: overlayEntry,
  };
}