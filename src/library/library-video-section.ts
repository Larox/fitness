import { renderAnimSection, type AnimAttachOptions } from "../pose/attach-anim-html";
import { renderRoutineSourceLink } from "./source-link";
import { routineLibraryMediaId } from "./routine-pose";
import type { NormalizedRoutine } from "./types";
import type { ExerciseMediaMeta, PoseMeta } from "../media/types";
import type { PoseJobState } from "../pose/pose-job-service";

export function syntheticRoutineClipMeta(
  routineId: string,
  durationS: number,
  pose?: PoseMeta,
): ExerciseMediaMeta {
  const id = routineLibraryMediaId(routineId);
  return {
    id,
    exerciseId: routineId,
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
}

export function renderLibraryVideoSection(input: LibraryVideoSectionInput): string {
  if (!input.routine.video || input.durationS === null) {
    return renderRoutineSourceLink(input.routine.source);
  }
  const meta = syntheticRoutineClipMeta(input.routine.id, input.durationS, input.pose);
  const anim: AnimAttachOptions = {
    meta,
    exerciseName: input.routine.title,
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
  return `<div class="sect"><h2>Routine preview</h2></div>
    <div class="group">
      <div id="library-video-mount"></div>
      ${source}
      ${animHtml}
    </div>`;
}