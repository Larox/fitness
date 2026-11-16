import { captureClipPoster, probeClipDuration, validateClipFile } from "./clip-process";
import { formatMegabytes } from "./format";
import { hasStorageForNewFile } from "./limits";
import { processPhotoFile } from "./photo-process";
import {
  deleteMediaBlob,
  estimateDeviceStorage,
  readMediaBlob,
  requestPersistentStorage,
  writeMediaBlob,
} from "./file-store";
import {
  deleteMediaMeta,
  deleteOrphanMediaMeta,
  getMediaByExerciseId,
  listMediaMeta,
  loadMediaSettings,
  putMediaMeta,
  replaceMediaMetaForExercise,
  saveMediaSettings,
} from "./meta-store";

export { putMediaMeta, listMediaMeta, replaceMediaMetaForExercise };
import type {
  ExerciseMediaMeta,
  MediaImportError,
  MediaImportProgress,
  MediaUsageSummary,
} from "./types";

function newMediaId(): string {
  return `med_${crypto.randomUUID()}`;
}

function fileKeys(mediaId: string): { fileKey: string; posterKey: string } {
  return {
    fileKey: `${mediaId}.bin`,
    posterKey: `${mediaId}.poster.jpg`,
  };
}

function mapImportError(err: unknown): MediaImportError {
  if (err instanceof Error) {
    if (
      err.message === "too-big" ||
      err.message === "too-long" ||
      err.message === "storage-full" ||
      err.message === "unsupported-format" ||
      err.message === "source-too-large"
    ) {
      return err.message as MediaImportError;
    }
  }
  if (err instanceof DOMException && err.name === "QuotaExceededError") {
    return "storage-full";
  }
  return "unsupported-format";
}

async function ensureQuotaFor(fileSize: number): Promise<void> {
  const { usage, quota } = await estimateDeviceStorage();
  if (!hasStorageForNewFile(usage, quota, fileSize)) {
    throw new Error("storage-full");
  }
}

async function maybeRequestPersist(): Promise<void> {
  const settings = await loadMediaSettings();
  if (settings.persistRequested) {
    return;
  }
  const granted = await requestPersistentStorage();
  await saveMediaSettings({
    persistRequested: true,
    persistGranted: granted,
  });
}

export async function getExerciseMedia(exerciseId: string): Promise<ExerciseMediaMeta | null> {
  return getMediaByExerciseId(exerciseId);
}

export async function readPosterBlob(meta: ExerciseMediaMeta): Promise<Blob | null> {
  return readMediaBlob(meta.posterKey);
}

export async function readMediaFileBlob(meta: ExerciseMediaMeta): Promise<Blob | null> {
  return readMediaBlob(meta.fileKey);
}

export async function importMediaForExercise(
  exerciseId: string,
  file: File,
  onProgress?: (p: MediaImportProgress) => void,
  signal?: AbortSignal,
): Promise<ExerciseMediaMeta> {
  await ensureQuotaFor(file.size);
  const mediaId = newMediaId();
  const keys = fileKeys(mediaId);
  const createdAt = new Date().toISOString();
  const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name);

  try {
    if (isVideo) {
      await validateClipFile(file);
      const durationS = await probeClipDuration(file);
      const posterData = await captureClipPoster(file, durationS);
      await writeMediaBlob(keys.posterKey, posterData.poster, undefined, signal);
      await writeMediaBlob(keys.fileKey, file, onProgress, signal);
      const meta: ExerciseMediaMeta = {
        id: mediaId,
        exerciseId,
        kind: "clip",
        width: posterData.width,
        height: posterData.height,
        durationS,
        bytes: file.size,
        sourceBytes: file.size,
        posterKey: keys.posterKey,
        fileKey: keys.fileKey,
        createdAt,
      };
      await maybeRequestPersist();
      return meta;
    }

    const photo = await processPhotoFile(file);
    const total = photo.full.size + photo.poster.size;
    await ensureQuotaFor(total);
    await writeMediaBlob(keys.posterKey, photo.poster, undefined, signal);
    onProgress?.({ loaded: photo.poster.size, total });
    await writeMediaBlob(keys.fileKey, photo.full, (p) => {
      onProgress?.({ loaded: photo.poster.size + p.loaded, total });
    }, signal);
    const meta: ExerciseMediaMeta = {
      id: mediaId,
      exerciseId,
      kind: "photo",
      width: photo.width,
      height: photo.height,
      bytes: photo.full.size,
      sourceBytes: photo.sourceBytes,
      sourceWidth: photo.sourceWidth,
      sourceHeight: photo.sourceHeight,
      posterKey: keys.posterKey,
      fileKey: keys.fileKey,
      createdAt,
      altText: "Your photo of this exercise",
    };
    await maybeRequestPersist();
    return meta;
  } catch (err) {
    await Promise.all([deleteMediaBlob(keys.fileKey), deleteMediaBlob(keys.posterKey)]);
    const mapped = mapImportError(err);
    const error = new Error(mapped);
    if (err instanceof Error && err.message === "too-long") {
      const fromProbe = err as Error & { durationS?: number };
      (error as Error & { durationS?: number }).durationS =
        fromProbe.durationS ?? (await safeDuration(file));
    }
    if (err instanceof Error && err.message === "too-big") {
      (error as Error & { sizeBytes?: number }).sizeBytes = file.size;
    }
    throw error;
  }
}

async function safeDuration(file: Blob): Promise<number | undefined> {
  try {
    return await probeClipDuration(file);
  } catch {
    return undefined;
  }
}

async function deletePoseFile(meta: ExerciseMediaMeta | null | undefined): Promise<void> {
  if (meta?.pose?.key) {
    await deleteMediaBlob(meta.pose.key);
  }
}

export async function commitMediaChanges(
  exerciseId: string,
  pending: ExerciseMediaMeta | null,
  remove: boolean,
  previous: ExerciseMediaMeta | null,
  replaced: ExerciseMediaMeta | null,
): Promise<void> {
  if (remove && previous) {
    await deleteMediaMeta(previous.id);
    await deleteMediaBlob(previous.fileKey);
    await deleteMediaBlob(previous.posterKey);
    await deletePoseFile(previous);
    return;
  }
  if (pending) {
    pending.exerciseId = exerciseId;
    const old = replaced ?? previous ?? (await getMediaByExerciseId(exerciseId));
    const dropId = old && old.id !== pending.id ? old.id : null;
    await replaceMediaMetaForExercise(exerciseId, pending, dropId);
    if (old && old.id !== pending.id) {
      await deleteMediaBlob(old.fileKey);
      await deleteMediaBlob(old.posterKey);
      await deletePoseFile(old);
    }
  }
}

export async function deleteExerciseMedia(exerciseId: string): Promise<void> {
  const meta = await getMediaByExerciseId(exerciseId);
  if (!meta) {
    return;
  }
  await deleteMediaMeta(meta.id);
  await deleteMediaBlob(meta.fileKey);
  await deleteMediaBlob(meta.posterKey);
  await deletePoseFile(meta);
}

export async function discardPendingMedia(meta: ExerciseMediaMeta | null): Promise<void> {
  if (!meta) {
    return;
  }
  await deleteMediaBlob(meta.fileKey);
  await deleteMediaBlob(meta.posterKey);
  await deletePoseFile(meta);
}

export async function summarizeMediaUsage(): Promise<MediaUsageSummary> {
  const rows = (await listMediaMeta()).filter((row) => row.id !== "settings");
  const bytesUsed = rows.reduce((sum, row) => sum + row.bytes, 0);
  const { usage, quota } = await estimateDeviceStorage();
  return {
    itemCount: rows.length,
    bytesUsed,
    quota,
    usage,
  };
}

export async function detachMediaMeta(mediaId: string): Promise<ExerciseMediaMeta | null> {
  const rows = await listMediaMeta();
  const meta = rows.find((row) => row.id === mediaId) ?? null;
  if (!meta) {
    return null;
  }
  await deleteMediaMeta(meta.id);
  return meta;
}

export async function deleteMediaFiles(meta: ExerciseMediaMeta): Promise<void> {
  await deleteMediaBlob(meta.fileKey);
  await deleteMediaBlob(meta.posterKey);
  await deletePoseFile(meta);
}

export async function purgeOrphanExerciseMedia(validExerciseIds: ReadonlySet<string>): Promise<void> {
  const rows = await listMediaMeta();
  await deleteOrphanMediaMeta(validExerciseIds);
  for (const row of rows) {
    if (row.id === "settings") {
      continue;
    }
    if (!validExerciseIds.has(row.exerciseId)) {
      await deleteMediaBlob(row.fileKey);
      await deleteMediaBlob(row.posterKey);
      await deletePoseFile(row);
    }
  }
}

export function storageFullMessage(summary: MediaUsageSummary, fileBytes: number): string {
  return `This ${formatMegabytes(fileBytes)} clip doesn’t fit. Your photos and clips use ${formatMegabytes(
    summary.bytesUsed,
  )}, and the browser says about ${formatMegabytes(Math.max(0, summary.quota - summary.usage))} is left for this app.`;
}