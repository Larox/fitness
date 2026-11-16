import type { NormalizedExercise } from "../library/types";
import type { DroppedExercise, ScheduledExercise } from "../safety/types";
import type { ConditionConfig } from "../config/types";

export interface TodayChangeNote {
  html: string;
}

function escapeText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildTodayChangeNotes(
  scheduled: readonly ScheduledExercise[],
  dropped: readonly DroppedExercise[],
  exercisesById: ReadonlyMap<string, NormalizedExercise>,
  _conditions: readonly ConditionConfig[],
  _conditionLabel: (id: string) => string,
): TodayChangeNote[] {
  const notes: TodayChangeNote[] = [];

  for (const row of scheduled) {
    if (row.sourceExerciseId === row.exerciseId) {
      continue;
    }
    const original = exercisesById.get(row.sourceExerciseId);
    const swap = exercisesById.get(row.exerciseId);
    if (!original || !swap) {
      continue;
    }
    const reason = row.reasons.find((r) => /high risk|Swapped/i.test(r)) ?? row.reasons[0] ?? "";
    const readable = reason.replace(original.name, escapeText(original.name));
    notes.push({
      html: `<p role="note" class="today-note"><strong>Swapped in: ${escapeText(swap.name)}</strong> for ${escapeText(original.name)}. ${escapeText(readable)}</p>`,
    });
  }

  for (const drop of dropped) {
    const original = exercisesById.get(drop.sourceExerciseId);
    const name = original?.name ?? drop.sourceExerciseId;
    const why = drop.reasons[0] ?? "High risk for active conditions.";
    let html = `<p role="note" class="today-note"><strong>Dropped: ${escapeText(name)}.</strong> ${escapeText(why)}`;
    if (drop.saferMoveSuggestion) {
      html += ` Safer move from the notes: ${escapeText(drop.saferMoveSuggestion)}.`;
    }
    html += "</p>";
    notes.push({ html });
  }

  if (notes.length > 1) {
    const combined = notes.map((n) => n.html).join("");
    return [
      {
        html: `<div role="note" class="today-note"><strong>2 changes today.</strong>${combined}</div>`,
      },
    ];
  }

  return notes;
}

export function moderateCautionUsesLabels(
  cautionLine: string,
  conditionIds: string[],
  conditionLabel: (id: string) => string,
): boolean {
  return conditionIds.every((id) => cautionLine.includes(conditionLabel(id)));
}