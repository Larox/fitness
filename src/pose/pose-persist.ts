import {
  getMediaByExerciseId,
  putMediaMeta,
  replaceMediaMetaForExercise,
} from "../media/meta-store";
import { deleteMediaBlob, writeMediaBlob } from "../media/file-store";
import type { ExerciseMediaMeta, PoseMeta } from "../media/types";
import { poseFileKey } from "./pose-keys";

export async function writePendingPoseFile(
  mediaId: string,
  blob: Blob,
  poseMeta: Omit<PoseMeta, "key" | "bytes">,
): Promise<PoseMeta> {
  const key = poseFileKey(mediaId);
  await writeMediaBlob(key, blob);
  return {
    ...poseMeta,
    key,
    bytes: blob.size,
  };
}

export async function commitDraftPoseToSavedMedia(
  exerciseId: string,
  mediaId: string,
  pose: PoseMeta,
): Promise<boolean> {
  const meta = await getMediaByExerciseId(exerciseId);
  if (!meta || meta.id !== mediaId || meta.kind !== "clip") {
    return false;
  }
  const next: ExerciseMediaMeta = {
    ...meta,
    pose,
  };
  await replaceMediaMetaForExercise(exerciseId, next, null);
  return true;
}

export async function attachPoseToMedia(
  exerciseId: string,
  mediaId: string,
  blob: Blob,
  poseMeta: Omit<PoseMeta, "key" | "bytes">,
): Promise<boolean> {
  const meta = await getMediaByExerciseId(exerciseId);
  if (!meta || meta.id !== mediaId || meta.kind !== "clip") {
    return false;
  }
  const key = poseFileKey(mediaId);
  await writeMediaBlob(key, blob);
  const next: ExerciseMediaMeta = {
    ...meta,
    pose: {
      ...poseMeta,
      key,
      bytes: blob.size,
    },
  };
  await putMediaMeta(next);
  return true;
}

export async function replacePoseOnMedia(
  exerciseId: string,
  mediaId: string,
  blob: Blob,
  poseMeta: Omit<PoseMeta, "key" | "bytes">,
): Promise<boolean> {
  const meta = await getMediaByExerciseId(exerciseId);
  if (!meta || meta.id !== mediaId) {
    return false;
  }
  const key = poseFileKey(mediaId);
  if (meta.pose?.key && meta.pose.key !== key) {
    await deleteMediaBlob(meta.pose.key);
  }
  await writeMediaBlob(key, blob);
  const next: ExerciseMediaMeta = {
    ...meta,
    pose: { ...poseMeta, key, bytes: blob.size },
  };
  await replaceMediaMetaForExercise(exerciseId, next, null);
  return true;
}

export async function clearPoseFromMeta(
  exerciseId: string,
  mediaId: string,
): Promise<void> {
  const meta = await getMediaByExerciseId(exerciseId);
  if (!meta || meta.id !== mediaId || !meta.pose) return;
  await deleteMediaBlob(meta.pose.key);
  const { pose: _pose, ...rest } = meta;
  void _pose;
  await putMediaMeta(rest as ExerciseMediaMeta);
}

export async function deletePoseOrphan(key: string): Promise<void> {
  await deleteMediaBlob(key);
}