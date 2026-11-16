import { deleteMediaBlob, readMediaBlob, writeMediaBlob } from "../media/file-store";
import { loadMediaSettings, saveMediaSettings } from "../media/meta-store";
import type { PoseMeta } from "../media/types";
import { poseFileKey } from "../pose/pose-keys";

export interface RoutineLibraryPose {
  pose: PoseMeta;
  durationS: number;
}

export function routineLibraryMediaId(routineId: string): string {
  return `lib_routine_vid_${routineId}`;
}

export async function getRoutineLibraryPose(
  routineId: string,
): Promise<RoutineLibraryPose | null> {
  const settings = await loadMediaSettings();
  const entry = settings.routineLibraryPose?.[routineId];
  if (!entry) {
    return null;
  }
  const blob = await readMediaBlob(entry.pose.key);
  if (!blob) {
    return null;
  }
  return entry;
}

export async function saveRoutineLibraryPose(
  routineId: string,
  blob: Blob,
  poseMeta: Omit<PoseMeta, "key" | "bytes">,
  durationS: number,
): Promise<PoseMeta> {
  const mediaId = routineLibraryMediaId(routineId);
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
    routineLibraryPose: {
      ...(settings.routineLibraryPose ?? {}),
      [routineId]: { pose, durationS },
    },
  });
  return pose;
}

export async function clearRoutineLibraryPose(routineId: string): Promise<void> {
  const settings = await loadMediaSettings();
  const entry = settings.routineLibraryPose?.[routineId];
  if (!entry) {
    return;
  }
  await deleteMediaBlob(entry.pose.key);
  const next = { ...(settings.routineLibraryPose ?? {}) };
  delete next[routineId];
  await saveMediaSettings({ ...settings, routineLibraryPose: next });
}