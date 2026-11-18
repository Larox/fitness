import { loadMediaSettings, saveMediaSettings } from "../media/meta-store";
import type { ExerciseLibraryClipOverride } from "../media/types";

export async function getExerciseClipOverride(
  exerciseId: string,
): Promise<ExerciseLibraryClipOverride | null> {
  const settings = await loadMediaSettings();
  const entry = settings.exerciseLibraryClipOverride?.[exerciseId];
  if (!entry) {
    return null;
  }
  return { ...entry };
}

export async function saveExerciseClipOverride(
  exerciseId: string,
  patch: ExerciseLibraryClipOverride,
): Promise<void> {
  const settings = await loadMediaSettings();
  const prev = settings.exerciseLibraryClipOverride?.[exerciseId] ?? {};
  await saveMediaSettings({
    ...settings,
    exerciseLibraryClipOverride: {
      ...(settings.exerciseLibraryClipOverride ?? {}),
      [exerciseId]: { ...prev, ...patch },
    },
  });
}

export async function clearExerciseClipOverride(exerciseId: string): Promise<void> {
  const settings = await loadMediaSettings();
  const entry = settings.exerciseLibraryClipOverride?.[exerciseId];
  if (!entry) {
    return;
  }
  const next = { ...(settings.exerciseLibraryClipOverride ?? {}) };
  delete next[exerciseId];
  await saveMediaSettings({ ...settings, exerciseLibraryClipOverride: next });
}

export function hasExerciseClipOverride(override: ExerciseLibraryClipOverride | null | undefined): boolean {
  return override != null && (override.clipStartS !== undefined || override.clipEndS !== undefined);
}