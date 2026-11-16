export type MediaKind = "photo" | "clip";

export type MediaImportError =
  | "too-big"
  | "too-long"
  | "storage-full"
  | "unsupported-format"
  | "source-too-large";

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
}

export interface MediaImportProgress {
  loaded: number;
  total: number;
}

export interface MediaStorageSettings {
  persistGranted?: boolean;
  persistRequested?: boolean;
}

export interface MediaUsageSummary {
  itemCount: number;
  bytesUsed: number;
  quota: number;
  usage: number;
}