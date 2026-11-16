/** Fifteen joints in storage order (BUILD-NOTES §27–31). */
export const POSE_JOINT_NAMES = [
  "head",
  "neck",
  "pelvis",
  "shoulderL",
  "shoulderR",
  "elbowL",
  "elbowR",
  "wristL",
  "wristR",
  "kneeL",
  "kneeR",
  "ankleL",
  "ankleR",
  "toeL",
  "toeR",
] as const;

export const POSE_JOINT_COUNT = POSE_JOINT_NAMES.length;

export type PoseJointName = (typeof POSE_JOINT_NAMES)[number];

export interface PosePoint {
  x: number;
  y: number;
  /** Relative depth for far-side alpha (larger = closer). */
  z: number;
  visibility: number;
}

export type PoseFrame = PosePoint[];

export interface PoseClipBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PoseClipHeader {
  v: 1;
  fps: number;
  frames: number;
  joints: readonly string[];
  box: PoseClipBox;
  keyFrame: number;
  modelVersion: string;
  createdAt: string;
}

/** MediaPipe Pose Landmarker normalized landmark (33-point model). */
export interface MpLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

const VIS = 0.5;

function vis(lm: MpLandmark | undefined): number {
  if (!lm) return 0;
  const v = lm.visibility ?? 1;
  return v >= VIS ? v : 0;
}

function mid(
  a: MpLandmark | undefined,
  b: MpLandmark | undefined,
): PosePoint | null {
  if (!a || !b) return null;
  const va = vis(a);
  const vb = vis(b);
  if (va < VIS && vb < VIS) return null;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(1, (va + vb) / 2 || Math.max(va, vb)),
  };
}

function fromLm(lm: MpLandmark | undefined): PosePoint | null {
  if (!lm || vis(lm) < VIS) return null;
  return { x: lm.x, y: lm.y, z: lm.z, visibility: vis(lm) };
}

function headFrom(landmarks: MpLandmark[]): PosePoint | null {
  const lEar = landmarks[7];
  const rEar = landmarks[8];
  const ears = mid(lEar, rEar);
  if (ears) {
    return { ...ears, visibility: ears.visibility };
  }
  return fromLm(landmarks[0]);
}

/**
 * Map one frame of 33 MediaPipe landmarks to the simplified skeleton.
 */
export function mapLandmarksToSkeleton(landmarks: MpLandmark[] | null): PoseFrame | null {
  if (!landmarks || landmarks.length < 33) return null;
  const neck = mid(landmarks[11], landmarks[12]);
  const pelvis = mid(landmarks[23], landmarks[24]);
  const head = headFrom(landmarks);
  if (!neck || !pelvis) return null;

  const empty: PosePoint = { x: 0, y: 0, z: 0, visibility: 0 };
  const pts: PoseFrame = POSE_JOINT_NAMES.map(() => ({ ...empty }));

  const set = (i: number, p: PosePoint | null) => {
    if (p) pts[i] = p;
  };

  set(0, head);
  set(1, neck);
  set(2, pelvis);
  set(3, fromLm(landmarks[11]));
  set(4, fromLm(landmarks[12]));
  set(5, fromLm(landmarks[13]));
  set(6, fromLm(landmarks[14]));
  set(7, fromLm(landmarks[15]));
  set(8, fromLm(landmarks[16]));
  set(9, fromLm(landmarks[25]));
  set(10, fromLm(landmarks[26]));
  set(11, fromLm(landmarks[27]));
  set(12, fromLm(landmarks[28]));
  set(13, fromLm(landmarks[31]));
  set(14, fromLm(landmarks[32]));

  return pts;
}

/** Frame has a person when ≥3 of shoulders + hips pass visibility (note 28). */
export function frameHasPerson(landmarks: MpLandmark[] | null): boolean {
  if (!landmarks || landmarks.length < 33) return false;
  let count = 0;
  for (const idx of [11, 12, 23, 24]) {
    if (vis(landmarks[idx]) >= VIS) count += 1;
  }
  return count >= 3;
}