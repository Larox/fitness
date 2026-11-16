import type { MpLandmark } from "./joints";

/** Small interface so pose logic stays pure and testable without loading MediaPipe. */
export interface PoseDetector {
  detect(bitmap: ImageBitmap, timestampMs: number): Promise<MpLandmark[] | null>;
  close(): void;
}