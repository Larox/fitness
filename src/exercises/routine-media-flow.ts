import type { ExerciseMediaMeta } from "../media/types";
import { emptyMediaDraft } from "../media/draft";
import { revokeMediaPosterUrl, type MediaFlowState } from "./exercise-media-flow";

export type PoseStartTarget =
  | { kind: "exercise-clip"; meta: ExerciseMediaMeta }
  | { kind: "routine"; routineId: string; durationS: number; segmentStartS?: number }
  | {
      kind: "exercise-library-video";
      exerciseId: string;
      videoRelativePath: string;
      durationS: number;
      segmentStartS: number;
    }
  | { kind: "none" };

/** Decide whether Make animation targets the routine library video or an exercise clip. */
export function resolvePoseStartTarget(input: {
  view: string;
  display: ExerciseMediaMeta | null | undefined;
  routineVideo?: string;
  routineId?: string;
  libraryVideoDurationS: number | null;
  libraryExerciseId?: string;
  segmentSpanS?: number | null;
  segmentStartS?: number;
}): PoseStartTarget {
  const {
    view,
    display,
    routineVideo,
    routineId,
    libraryVideoDurationS,
    libraryExerciseId,
    segmentSpanS,
    segmentStartS = 0,
  } = input;
  if (
    view === "routine" &&
    routineVideo &&
    routineId &&
    libraryVideoDurationS != null
  ) {
    return { kind: "routine", routineId, durationS: libraryVideoDurationS };
  }
  if (display?.kind === "clip") {
    return { kind: "exercise-clip", meta: display };
  }
  if (
    view === "library" &&
    routineVideo &&
    libraryExerciseId &&
    segmentSpanS != null &&
    segmentSpanS > 0
  ) {
    return {
      kind: "exercise-library-video",
      exerciseId: libraryExerciseId,
      videoRelativePath: routineVideo,
      durationS: segmentSpanS,
      segmentStartS,
    };
  }
  return { kind: "none" };
}

export function resetMediaFlowForRoutineNavigation(
  state: MediaFlowState,
  placeholderExerciseId: string,
): void {
  revokeMediaPosterUrl(state);
  state.draft = emptyMediaDraft(placeholderExerciseId);
  state.poseRemoveDraft = false;
  state.pendingPoseOnDraft = false;
  state.formAnimView = "anim";
  state.unfinishedAnim = false;
}

/** Whether library routine animation controls apply (not the user exercise attach row). */
export function libraryRoutineAnimContextActive(input: {
  view: string;
  routineVideo?: string;
  libraryVideoDurationS: number | null;
  hasUserClip: boolean;
}): boolean {
  if (!input.routineVideo || input.libraryVideoDurationS === null) {
    return false;
  }
  if (input.view === "routine") {
    return true;
  }
  if (input.view === "library") {
    return !input.hasUserClip;
  }
  return false;
}