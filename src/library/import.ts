import { deriveExerciseId } from "./exercise-id";
import {
  aggregateRoutineRisks,
  normalizeCategories,
  normalizeCues,
  normalizeDurationMin,
  normalizeRisk,
  readRoutineLibraryRisk,
} from "./normalize";
import { parseRoutineVideoPath } from "./video-path";
import { readLibraryRisk } from "./risk";
import type {
  ExerciseOverlayFile,
  LibraryImportOptions,
  LibraryImportResult,
  NormalizedExercise,
  NormalizedRoutine,
  RiskLevel,
  SkippedRoutine,
  SnapshotExercise,
  SnapshotRoutine,
} from "./types";

export function importLibrary(
  snapshot: SnapshotRoutine[],
  options: LibraryImportOptions,
  overlay: ExerciseOverlayFile = {},
): LibraryImportResult {
  const { conditions } = options;
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

  for (let i = 0; i < snapshot.length; i++) {
    const routine = snapshot[i]!;
    if (routine.video !== undefined) {
      const parsed = parseRoutineVideoPath(
        routine.video,
        `routines[${i}].video (routine ${routine.id})`,
      );
      if (!parsed.ok) {
        errors.push(parsed.error);
      }
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
    const exerciseRisksByCondition: Record<string, RiskLevel[]> = {};
    for (const condition of conditions) {
      exerciseRisksByCondition[condition.id] = [];
    }

    for (const ex of rawExercises) {
      const normalized = normalizeExercise(routine.id, ex, conditions, overlay);
      normalizedExercises.push(normalized);
      for (const condition of conditions) {
        exerciseRisksByCondition[condition.id]!.push(
          normalized.conditionRisks[condition.id]!,
        );
      }
    }

    const conditionRisks = aggregateRoutineRisks(
      conditions,
      exerciseRisksByCondition,
      (libraryField) => readRoutineLibraryRisk(routine, libraryField),
    );

    const videoParsed = parseRoutineVideoPath(routine.video, `routine ${routine.id}.video`);
    const video = videoParsed.ok ? videoParsed.path : undefined;

    routines.push({
      id: routine.id,
      title: routine.title,
      source: routine.source,
      video,
      categories: normalizeCategories(routine.category),
      equipment: routine.equipment ?? [],
      frequency: routine.frequency ?? null,
      durationMin: normalizeDurationMin(routine.duration_min),
      difficulty: routine.difficulty ?? null,
      notes: routine.notes,
      conditionRisks,
      exerciseIds: normalizedExercises.map((e) => e.id),
    });

    exercises.push(...normalizedExercises);
  }

  return { routines, exercises, skipped, errors };
}

function readClipSecond(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

function normalizeExercise(
  routineId: string,
  ex: SnapshotExercise,
  conditions: LibraryImportOptions["conditions"],
  overlay: ExerciseOverlayFile,
): NormalizedExercise {
  const id = deriveExerciseId(routineId, ex.name);
  const overlayEntry = overlay[id];
  const snapshotRecord = ex as unknown as Record<string, unknown>;

  const conditionRisks: Record<string, RiskLevel> = {};
  for (const condition of conditions) {
    conditionRisks[condition.id] = normalizeRisk(
      readLibraryRisk(snapshotRecord, condition.libraryField),
    );
  }

  return {
    id,
    routineId,
    name: ex.name,
    sets: ex.sets ?? null,
    reps: ex.reps ?? null,
    equipment: ex.equipment ?? null,
    cues: normalizeCues(ex.cues),
    caution: ex.caution,
    libraryClipStartS: readClipSecond(ex.clip_start_s),
    libraryClipEndS: readClipSecond(ex.clip_end_s),
    conditionRisks,
    overlay: overlayEntry,
  };
}