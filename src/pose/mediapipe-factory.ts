import type { PoseDetector } from "./detect";

export interface PoseModelUrls {
  wasmBaseUrl: string;
  modelUrl: string;
  revoke?: () => void;
}

/**
 * Creates a MediaPipe Pose Landmarker (lite). Only call in the browser — never in CI tests.
 */
export async function createMediapipePoseDetector(urls: PoseModelUrls): Promise<PoseDetector> {
  const vision = await import("@mediapipe/tasks-vision");
  const { FilesetResolver, PoseLandmarker } = vision;
  type Landmarker = Awaited<ReturnType<typeof PoseLandmarker.createFromOptions>>;
  let landmarker: Landmarker | null = null;
  const revoke = urls.revoke;

  async function make(delegate: "GPU" | "CPU"): Promise<Landmarker> {
    const fileset = await FilesetResolver.forVisionTasks(urls.wasmBaseUrl);
    return PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: urls.modelUrl,
        delegate,
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });
  }

  try {
    landmarker = await make("GPU");
  } catch {
    landmarker = await make("CPU");
  }

  return {
    async detect(bitmap, timestampMs) {
      if (!landmarker) return null;
      const result = landmarker.detectForVideo(bitmap, timestampMs);
      const poses = result.landmarks;
      if (!poses?.length) return null;
      return poses[0]!.map((lm: { x: number; y: number; z?: number; visibility?: number }) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z ?? 0,
        visibility: lm.visibility ?? 1,
      }));
    },
    close() {
      landmarker?.close();
      landmarker = null;
      revoke?.();
    },
  };
}