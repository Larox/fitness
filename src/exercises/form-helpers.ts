import type { ExerciseFormDraft, UserExercise } from "./types";
import { defaultDose } from "./dose";
import { createUserExerciseId, createUserRoutineId } from "./ids";
import { normalizeSourceUrl } from "./url";

export function emptyExerciseDraft(): ExerciseFormDraft {
  return {
    name: "",
    categories: [],
    equipment: "",
    cues: [""],
    link: "",
    dose: defaultDose(),
    riskChosen: {},
    moderateCautions: {},
    kettlebell: false,
    location: undefined,
  };
}

export function userExerciseToDraft(exercise: UserExercise): ExerciseFormDraft {
  return {
    name: exercise.name,
    categories: [...exercise.categories],
    equipment: exercise.equipment,
    cues: exercise.cues.length ? [...exercise.cues] : [""],
    link: exercise.link ?? "",
    dose: { ...exercise.dose },
    riskChosen: { ...exercise.riskChosen },
    moderateCautions: { ...exercise.moderateCautions },
    kettlebell: exercise.kettlebell,
    location: exercise.location,
  };
}

export function draftToUserExercise(
  draft: ExerciseFormDraft,
  existing: UserExercise | null,
  now: Date,
): UserExercise {
  const cues = draft.cues.map((c) => c.trim()).filter(Boolean).slice(0, 6);
  const link = normalizeSourceUrl(draft.link);
  const base: UserExercise = existing ?? {
    id: createUserExerciseId(),
    routineId: createUserRoutineId(),
    name: draft.name.trim(),
    categories: [...draft.categories],
    equipment: draft.equipment.trim(),
    cues,
    link: link || undefined,
    dose: { ...draft.dose },
    riskChosen: { ...draft.riskChosen },
    moderateCautions: { ...draft.moderateCautions },
    kettlebell: draft.kettlebell,
    location: draft.location,
    createdAt: now.toISOString(),
    newUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
  return {
    ...base,
    name: draft.name.trim(),
    categories: [...draft.categories],
    equipment: draft.equipment.trim(),
    cues,
    link: link || undefined,
    dose: { ...draft.dose },
    riskChosen: { ...draft.riskChosen },
    moderateCautions: { ...draft.moderateCautions },
    kettlebell: draft.kettlebell,
    location: draft.location,
    newUntil: existing?.newUntil ?? base.newUntil,
  };
}

export function collectLibraryCategories(
  routines: readonly { categories: string[] }[],
): string[] {
  const set = new Set<string>();
  for (const routine of routines) {
    for (const cat of routine.categories) {
      if (cat) {
        set.add(cat);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function barHelperForRisks(
  unsetCount: number,
  isEdit: boolean,
  dirty: boolean,
): string {
  if (!dirty && isEdit) {
    return "No changes";
  }
  if (unsetCount > 0) {
    const n = unsetCount;
    return `${n} risk not set · saves as high, won’t be planned`;
  }
  return "Ready to save";
}