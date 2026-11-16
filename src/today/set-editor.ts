import type { ScheduledExercise } from "../safety/types";
import { escapeHtml } from "../setup/icons";
import { plannedHoldSeconds, plannedReps, scheduledUsesHold } from "./set-logs";
import type { ExerciseSetLog } from "./types";

function setMetricValue(log: ExerciseSetLog, sched: ScheduledExercise, hold: boolean): number {
  if (hold) {
    return log.holdS ?? plannedHoldSeconds(sched);
  }
  return log.reps ?? plannedReps(sched);
}

export function renderSetLogsEditor(
  exerciseId: string,
  exerciseName: string,
  sched: ScheduledExercise,
  logs: ExerciseSetLog[],
  readOnly: boolean,
): string {
  const hold = scheduledUsesHold(sched);
  const unit = hold ? "Seconds" : "Reps";
  const unitShort = hold ? "s" : "reps";
  const max = hold ? 600 : 99;
  const rows = logs
    .map((log, idx) => {
      const skipped = log.status === "skipped";
      const frozen = readOnly || skipped;
      const value = setMetricValue(log, sched, hold);
      const inputId = `today-set-${exerciseId}-${idx}`;
      const disableAttr = frozen ? "disabled" : "";
      return `<div class="tset" data-eid="${escapeHtml(exerciseId)}" data-idx="${idx}">
      <span class="tset-lbl">Set ${idx + 1}</span>
      <div class="tset-step">
        <span class="tset-unit-lbl">${unit}</span>
        <div class="tset-row">
          <button type="button" class="tset-adj" data-act="today-set-dec" data-id="${escapeHtml(exerciseId)}" data-idx="${idx}" ${disableAttr} aria-label="Decrease ${unit.toLowerCase()} for set ${idx + 1}">−</button>
          <input id="${inputId}" class="tset-in" type="number" inputmode="numeric" min="1" max="${max}" value="${value}" data-id="${escapeHtml(exerciseId)}" data-idx="${idx}" ${disableAttr} aria-label="${unit} for set ${idx + 1} of ${escapeHtml(exerciseName)}" />
          <button type="button" class="tset-adj" data-act="today-set-inc" data-id="${escapeHtml(exerciseId)}" data-idx="${idx}" ${disableAttr} aria-label="Increase ${unit.toLowerCase()} for set ${idx + 1}">+</button>
        </div>
        <span class="tset-unit" aria-hidden="true">${unitShort}</span>
      </div>
      <button type="button" class="tset-skip" aria-pressed="${skipped ? "true" : "false"}" data-act="today-set-skip" data-id="${escapeHtml(exerciseId)}" data-idx="${idx}" ${readOnly ? "disabled" : ""}>${skipped ? "Skipped" : "Skip"}</button>
    </div>`;
    })
    .join("");
  return `<div class="tsets" role="group" aria-label="Set log for ${escapeHtml(exerciseName)}">${rows}</div>`;
}

export function clampSetMetric(value: number, hold: boolean): number {
  const min = 1;
  const max = hold ? 600 : 99;
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function applySetMetric(
  logs: ExerciseSetLog[],
  index: number,
  sched: ScheduledExercise,
  nextValue: number,
): ExerciseSetLog[] {
  const hold = scheduledUsesHold(sched);
  const value = clampSetMetric(nextValue, hold);
  return logs.map((row, i) => {
    if (i !== index || row.status === "skipped") {
      return row;
    }
    if (hold) {
      return { ...row, holdS: value, reps: undefined };
    }
    return { ...row, reps: value, holdS: undefined };
  });
}

export function toggleSetSkipped(logs: ExerciseSetLog[], index: number): ExerciseSetLog[] {
  return logs.map((row, i) => {
    if (i !== index) {
      return row;
    }
    const nextSkipped = row.status !== "skipped";
    return {
      setIndex: row.setIndex,
      status: nextSkipped ? "skipped" : "done",
      ...(row.reps !== undefined ? { reps: row.reps } : {}),
      ...(row.holdS !== undefined ? { holdS: row.holdS } : {}),
    };
  });
}