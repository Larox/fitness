import { deleteMediaBlob, readMediaBlob, writeMediaBlob } from "../media/file-store";
import { loadMediaSettings, saveMediaSettings } from "../media/meta-store";
import type { PoseMeta } from "../media/types";
import { poseFileKey } from "../pose/pose-keys";

export interface ExerciseLibraryPose {
  pose: PoseMeta;
  durationS: number;
}

export function exerciseLibraryMediaId(exerciseId: string): string {
  return `lib_exercise_vid_${exerciseId}`;
}

export async function getExerciseLibraryPose(
  exerciseId: string,
): Promise<ExerciseLibraryPose | null> {
  const settings = await loadMediaSettings();
  const entry = settings.exerciseLibraryPose?.[exerciseId];
  if (!entry) {
    return null;
  }
  const blob = await readMediaBlob(entry.pose.key);
  if (!blob) {
    return null;
  }
  return entry;
}

export async function saveExerciseLibraryPose(
  exerciseId: string,
  blob: Blob,
  poseMeta: Omit<PoseMeta, "key" | "bytes">,
  durationS: number,
): Promise<PoseMeta> {
  const mediaId = exerciseLibraryMediaId(exerciseId);
  const key = poseFileKey(mediaId);
  await writeMediaBlob(key, blob);
  const pose: PoseMeta = {
    ...poseMeta,
    key,
    bytes: blob.size,
  };
  const settings = await loadMediaSettings();
  await saveMediaSettings({
    ...settings,
    exerciseLibraryPose: {
      ...(settings.exerciseLibraryPose ?? {}),
      [exerciseId]: { pose, durationS },
    },
  });
  return pose;
}

export async function clearExerciseLibraryPose(exerciseId: string): Promise<void> {
  const settings = await loadMediaSettings();
  const entry = settings.exerciseLibraryPose?.[exerciseId];
  if (!entry) {
    return;
  }
  await deleteMediaBlob(entry.pose.key);
  const next = { ...(settings.exerciseLibraryPose ?? {}) };
  delete next[exerciseId];
  await saveMediaSettings({ ...settings, exerciseLibraryPose: next });
}