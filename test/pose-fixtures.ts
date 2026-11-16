import type { MpLandmark } from "../src/pose/joints";

/** Synthetic squat-like motion for unit tests (not from any real person). */
export function syntheticSquatFrame(phase: number): MpLandmark[] {
  const landmarks: MpLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }));
  const bend = Math.sin(phase * Math.PI) * 0.12;
  const set = (i: number, x: number, y: number, z = 0) => {
    landmarks[i] = { x, y, z, visibility: 1 };
  };
  set(11, 0.42, 0.35);
  set(12, 0.58, 0.35);
  set(23, 0.45, 0.55 + bend);
  set(24, 0.55, 0.55 + bend);
  set(7, 0.4, 0.28);
  set(8, 0.6, 0.28);
  set(0, 0.5, 0.22);
  set(13, 0.38, 0.45);
  set(14, 0.62, 0.45);
  set(15, 0.35, 0.55);
  set(16, 0.65, 0.55);
  set(25, 0.44, 0.7 + bend);
  set(26, 0.56, 0.7 + bend);
  set(27, 0.44, 0.88);
  set(28, 0.56, 0.88);
  set(31, 0.44, 0.92);
  set(32, 0.56, 0.92);
  return landmarks;
}

export function syntheticClipLandmarks(frames: number): MpLandmark[][] {
  return Array.from({ length: frames }, (_, i) =>
    syntheticSquatFrame(i / Math.max(1, frames - 1)),
  );
}

export function emptyRoomLandmarks(): MpLandmark[][] {
  return Array.from({ length: 60 }, () =>
    Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 })),
  );
}