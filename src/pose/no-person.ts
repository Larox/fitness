import { type MpLandmark, frameHasPerson } from "./joints";

const MIN_PERSON_FRAC = 0.5;
const MIN_RUN_SECONDS = 1.5;
export const POSE_SAMPLE_FPS = 15;

export interface NoPersonInput {
  /** Per-frame raw landmarks from the detector. */
  landmarkFrames: (MpLandmark[] | null)[];
  durationS: number;
}

/**
 * Returns true when the clip should show "No person found" (BUILD-NOTES §28).
 */
export function shouldFailNoPerson(input: NoPersonInput): boolean {
  const { landmarkFrames, durationS } = input;
  if (landmarkFrames.length === 0) return true;

  let personFrames = 0;
  for (const frame of landmarkFrames) {
    if (frameHasPerson(frame)) personFrames += 1;
  }
  if (personFrames / landmarkFrames.length < MIN_PERSON_FRAC) {
    return true;
  }

  let longestRun = 0;
  let run = 0;
  for (const frame of landmarkFrames) {
    if (frameHasPerson(frame)) {
      run += 1;
      longestRun = Math.max(longestRun, run);
    } else {
      run = 0;
    }
  }
  const longestRunS = longestRun / POSE_SAMPLE_FPS;
  return longestRunS < MIN_RUN_SECONDS || durationS < MIN_RUN_SECONDS;
}

export function frameCountForDuration(durationS: number): number {
  return Math.max(1, Math.round(durationS * POSE_SAMPLE_FPS));
}