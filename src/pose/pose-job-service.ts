import { readMediaFileBlob } from "../media/service";
import type { ExerciseMediaMeta } from "../media/types";
import { loadMediaSettings, saveMediaSettings } from "../media/meta-store";
import { estimateDeviceStorage } from "../media/file-store";
import { hasStorageForNewFile } from "../media/limits";
import { downloadPoseModelFiles } from "./model-download";
import { fetchPoseModelManifest, formatModelTotal, type PoseModelManifest } from "./model-manifest";
import { isPoseModelCached, poseModelCachedBytes } from "./model-cache";
import { createMediapipePoseDetector } from "./mediapipe-factory";
import { sampleClipLandmarks } from "./clip-sampler";
import { processLandmarkFrames } from "./process";
import {
  attachPoseToMedia,
  writePendingPoseFile,
} from "./pose-persist";
import { resolvePoseModelUrls, isPoseModelAvailableOffline } from "./model-resolve";
import type { PoseMeta } from "../media/types";

export type PoseJobPhase =
  | "idle"
  | "offer"
  | "offline"
  | "downloading"
  | "processing"
  | "failed-noperson"
  | "failed"
  | "ready"
  | "unfinished";

export interface PoseJobState {
  phase: PoseJobPhase;
  exerciseId: string;
  mediaId: string;
  downloadLoaded?: number;
  downloadTotal?: number;
  processFrame?: number;
  processTotal?: number;
  modelManifest?: PoseModelManifest | null;
  /** Pose finished before Save; consumer merges onto the draft display. */
  pendingPose?: PoseMeta;
}

type Listener = (state: PoseJobState | null) => void;

let current: PoseJobState | null = null;
const listeners = new Set<Listener>();
let abort: AbortController | null = null;

export function subscribePoseJob(fn: Listener): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

function emit(): void {
  for (const fn of listeners) fn(current);
}

export function getPoseJob(): PoseJobState | null {
  return current;
}

export function poseJobMatches(exerciseId: string, mediaId: string): boolean {
  return (
    current !== null &&
    current.exerciseId === exerciseId &&
    current.mediaId === mediaId &&
    (current.phase === "downloading" || current.phase === "processing")
  );
}

function setJob(next: PoseJobState | null): void {
  current = next;
  emit();
}

export interface PoseJobConfig {
  poseModelBaseUrl: string;
}

export async function loadPoseModelManifest(config: PoseJobConfig): Promise<PoseModelManifest | null> {
  return fetchPoseModelManifest(config.poseModelBaseUrl);
}

export async function cancelPoseJob(): Promise<void> {
  abort?.abort();
  abort = null;
  if (current) {
    if (current.phase === "downloading" || current.phase === "processing") {
      setJob({ ...current, phase: "offer" });
    }
  }
  const settings = await loadMediaSettings();
  await saveMediaSettings({ ...settings, poseJob: null });
}

export async function startPoseJob(
  config: PoseJobConfig,
  meta: ExerciseMediaMeta,
  exerciseName: string,
  modelCached: boolean,
): Promise<void> {
  void exerciseName;
  if (meta.kind !== "clip" || !meta.durationS) return;
  abort?.abort();
  abort = new AbortController();
  const signal = abort.signal;
  let manifest = await loadPoseModelManifest(config);
  if (!manifest && modelCached) {
    const bytes = await poseModelCachedBytes();
    manifest = {
      version: "pose_landmarker_lite",
      totalBytes: bytes,
      files: [],
    };
  }
  if (!manifest) {
    setJob({ phase: "offline", exerciseId: meta.exerciseId, mediaId: meta.id });
    return;
  }
  const base = config.poseModelBaseUrl.replace(/\/$/, "");
  const settings = await loadMediaSettings();
  await saveMediaSettings({
    ...settings,
    poseJob: { exerciseId: meta.exerciseId, mediaId: meta.id, startedAt: new Date().toISOString() },
  });

  setJob({
    phase: modelCached ? "processing" : "downloading",
    exerciseId: meta.exerciseId,
    mediaId: meta.id,
    downloadTotal: manifest.totalBytes,
    downloadLoaded: 0,
    modelManifest: manifest,
  });

  try {
    if (!modelCached) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setJob({ ...current!, phase: "offline", modelManifest: manifest });
        return;
      }
      const { usage, quota } = await estimateDeviceStorage();
      if (!hasStorageForNewFile(usage, quota, manifest.totalBytes * 1.1)) {
        setJob({ ...current!, phase: "offline", modelManifest: manifest });
        return;
      }
      await downloadPoseModelFiles(
        base,
        manifest,
        (loaded, total) => {
          if (current) {
            setJob({ ...current, downloadLoaded: loaded, downloadTotal: total });
          }
        },
        signal,
      );
      const st = await loadMediaSettings();
      await saveMediaSettings({ ...st, poseModelReady: true, poseJob: st.poseJob ?? null });
    }

    if (signal.aborted) return;
    setJob({
      phase: "processing",
      exerciseId: meta.exerciseId,
      mediaId: meta.id,
      processFrame: 0,
      processTotal: Math.round(meta.durationS * 15),
      modelManifest: manifest,
    });

    if (modelCached || typeof navigator === "undefined" || navigator.onLine === false) {
      const offlineReady = await isPoseModelAvailableOffline(base);
      if (!offlineReady && (modelCached || navigator.onLine === false)) {
        setJob({
          phase: "offline",
          exerciseId: meta.exerciseId,
          mediaId: meta.id,
          modelManifest: manifest,
        });
        return;
      }
    }

    const clipBlob = await readMediaFileBlob(meta);
    if (!clipBlob) throw new Error("clip-missing");
    const resolved = await resolvePoseModelUrls(base);
    const detector = await createMediapipePoseDetector({
      wasmBaseUrl: resolved.wasmBaseUrl,
      modelUrl: resolved.modelUrl,
      revoke: resolved.revoke,
    });
    try {
      const landmarks = await sampleClipLandmarks(
        clipBlob,
        meta.durationS,
        detector,
        (frame, total) => {
          if (current?.phase === "processing") {
            setJob({ ...current, processFrame: frame, processTotal: total });
          }
        },
        signal,
      );
      if (signal.aborted) return;
      const result = processLandmarkFrames(landmarks, meta.durationS, manifest.version);
      if (!result.ok) {
        setJob({
          phase: result.reason === "no-person" ? "failed-noperson" : "failed",
          exerciseId: meta.exerciseId,
          mediaId: meta.id,
          modelManifest: manifest,
        });
        return;
      }
      const poseFields = {
        frames: result.frames,
        fps: 15,
        keyFrame: result.keyFrame,
        createdAt: new Date().toISOString(),
        modelVersion: manifest.version,
      };
      const attached = await attachPoseToMedia(meta.exerciseId, meta.id, result.blob, poseFields);
      let pendingPose: PoseMeta | undefined;
      if (!attached) {
        pendingPose = await writePendingPoseFile(meta.id, result.blob, poseFields);
      }
      setJob({
        phase: "ready",
        exerciseId: meta.exerciseId,
        mediaId: meta.id,
        modelManifest: manifest,
        pendingPose,
      });
    } finally {
      detector.close();
    }
  } catch (err) {
    if (signal.aborted) {
      setJob({ phase: "offer", exerciseId: meta.exerciseId, mediaId: meta.id, modelManifest: manifest });
      return;
    }
    if (err instanceof Error && err.message === "pose-model-offline") {
      setJob({ phase: "offline", exerciseId: meta.exerciseId, mediaId: meta.id, modelManifest: manifest });
      return;
    }
    setJob({ phase: "failed", exerciseId: meta.exerciseId, mediaId: meta.id, modelManifest: manifest });
  } finally {
    const st = await loadMediaSettings();
    await saveMediaSettings({ ...st, poseJob: null });
  }
}

export function modelSizeLabel(manifest: PoseModelManifest | null | undefined): string {
  if (!manifest) return "…";
  return formatModelTotal(manifest);
}

export async function clearUnfinishedFlag(exerciseId: string): Promise<void> {
  const st = await loadMediaSettings();
  const unfinished = { ...(st.unfinishedAnim ?? {}) };
  delete unfinished[exerciseId];
  await saveMediaSettings({ ...st, unfinishedAnim: unfinished });
}

export async function markUnfinishedAnim(exerciseId: string): Promise<void> {
  const st = await loadMediaSettings();
  await saveMediaSettings({
    ...st,
    unfinishedAnim: { ...(st.unfinishedAnim ?? {}), [exerciseId]: true },
    poseJob: null,
  });
}

export async function resumePoseJobMarker(): Promise<void> {
  const st = await loadMediaSettings();
  if (st.poseJob) {
    await markUnfinishedAnim(st.poseJob.exerciseId);
    await saveMediaSettings({ ...st, poseJob: null });
  }
}

export async function isModelOnDevice(): Promise<boolean> {
  const st = await loadMediaSettings();
  if (st.poseModelReady) return true;
  return isPoseModelCached();
}