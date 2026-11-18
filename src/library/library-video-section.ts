import { renderAnimSection, type AnimAttachOptions } from "../pose/attach-anim-html";
import { renderRoutineSourceLink } from "./source-link";
import { exerciseLibraryMediaId } from "./exercise-library-pose";
import { routineLibraryMediaId } from "./routine-pose";
import type { NormalizedRoutine } from "./types";
import type { ExerciseMediaMeta, PoseMeta } from "../media/types";
import type { PoseJobState } from "../pose/pose-job-service";

export function syntheticRoutineClipMeta(
  ownerId: string,
  durationS: number,
  pose?: PoseMeta,
  options?: { exerciseLibrary?: boolean },
): ExerciseMediaMeta {
  const id = options?.exerciseLibrary
    ? exerciseLibraryMediaId(ownerId)
    : routineLibraryMediaId(ownerId);
  return {
    id,
    exerciseId: ownerId,
    kind: "clip",
    width: 400,
    height: 300,
    durationS,
    bytes: 0,
    posterKey: "",
    fileKey: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    pose,
  };
}

export interface LibraryVideoSectionInput {
  routine: NormalizedRoutine;
  durationS: number | null;
  pose?: PoseMeta;
  job: PoseJobState | null;
  modelOnDevice: boolean;
  modelCached: boolean;
  manifestLabel?: string;
  unfinished: boolean;
  formAnimView: "anim" | "clip";
  poseRemovedDraft?: boolean;
  previewSubjectName?: string;
  poseOwnerId?: string;
  exerciseLibraryPose?: boolean;
  clipControlsHtml?: string;
}

export function renderLibraryVideoSection(input: LibraryVideoSectionInput): string {
  if (!input.routine.video || input.durationS === null) {
    return renderRoutineSourceLink(input.routine.source);
  }
  const poseOwnerId = input.poseOwnerId ?? input.routine.id;
  const meta = syntheticRoutineClipMeta(poseOwnerId, input.durationS, input.pose, {
    exerciseLibrary: input.exerciseLibraryPose,
  });
  const anim: AnimAttachOptions = {
    meta,
    exerciseName: input.previewSubjectName ?? input.routine.title,
    job: input.job,
    modelCached: input.modelCached,
    modelOnDevice: input.modelOnDevice,
    unfinished: input.unfinished,
    view: input.formAnimView,
    poseRemovedDraft: input.poseRemovedDraft ?? false,
    manifestTotal: input.manifestLabel,
    showToggle: Boolean(input.pose) && !(input.poseRemovedDraft ?? false),
  };
  const source = renderRoutineSourceLink(input.routine.source);
  const animHtml =
    meta.kind === "clip"
      ? `<div class="anim-divider"></div><div id="library-video-anim-mount">${renderAnimSection(anim)}</div>`
      : "";
  const controls = input.clipControlsHtml ?? "";
  return `<div class="sect"><h2>Routine preview</h2></div>
  <div class="group library-preview-shell">
      <div id="library-video-mount"></div>
      ${controls}
      ${source}
      ${animHtml}
    </div>`;
}