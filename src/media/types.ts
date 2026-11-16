export type MediaKind = "photo" | "clip";

export type MediaImportError =
  | "too-big"
  | "too-long"
  | "storage-full"
  | "unsupported-format"
  | "source-too-large";

export interface PoseMeta {
  key: string;
  bytes: number;
  frames: number;
  fps: number;
  keyFrame: number;
  createdAt: string;
  modelVersion: string;
}

export interface ExerciseMediaMeta {
  id: string;
  exerciseId: string;
  kind: MediaKind;
  width: number;
  height: number;
  durationS?: number;
  bytes: number;
  sourceBytes?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  posterKey: string;
  fileKey: string;
  createdAt: string;
  altText?: string;
  pose?: PoseMeta;
}

export interface MediaImportProgress {
  loaded: number;
  total: number;
}

export interface PoseJobMarker {
  exerciseId: string;
  mediaId: string;
  startedAt: string;
}

export interface MediaStorageSettings {
  persistGranted?: boolean;
  persistRequested?: boolean;
  poseModelReady?: boolean;
  poseJob?: PoseJobMarker | null;
  /** Per exercise, whether Today shows animation or clip first. */
  todayMediaView?: Record<string, "anim" | "clip">;
  unfinishedAnim?: Record<string, boolean>;
}

export interface MediaUsageSummary {
  itemCount: number;
  bytesUsed: number;
  quota: number;
  usage: number;
}