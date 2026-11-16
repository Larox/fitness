import type { ConditionConfig } from "../config/types";
import type { NormalizedExercise, NormalizedRoutine, SessionLocation } from "../library/types";
import { filterExercisesForScheduling, effectiveRiskForActiveConditions } from "../safety/filter";
import type { SafetyFilterContext } from "../safety/types";
import { activeConditionIds } from "../setup/defaults";
import type { TrainingSettings, WeekSessionCandidate } from "../setup/types";
import { createSeededRng, defaultPlanSeed } from "./seed";
import { layoutWeek } from "./week-layout";
import type { TrainingSlotKind, WeekPlan, WeekPlanRow, WeekPlanSessionResult } from "./types";

export interface BuildWeekPlanInput {
  seed?: string;
  settings: TrainingSettings;
  conditions: ConditionConfig[];
  routines: readonly NormalizedRoutine[];
  exercisesById: ReadonlyMap<string, NormalizedExercise>;
  excludedExerciseIds?: ReadonlySet<string>;
  routineNotesById?: ReadonlyMap<string, string | undefined>;
  conditionLabel?: (id: string) => string;
}

export interface BuildWeekPlanResult {
  plan: WeekPlan;
  weekSessionsRemaining: WeekSessionCandidate[];
}

function routineMinutes(routine: NormalizedRoutine): number {
  const duration = routine.durationMin;
  if (!duration) {
    return 10;
  }
  return duration.max ?? duration.min ?? 10;
}

function routineMobilityKind(routine: NormalizedRoutine): "mobility" | "strength" {
  const text = routine.categories.join(" ").toLowerCase();
  if (/mobility|warm|stretch/.test(text)) {
    return "mobility";
  }
  if (/strength|resistance|stability/.test(text)) {
    return "strength";
  }
  return routineMinutes(routine) <= 12 ? "mobility" : "strength";
}

function matchesSlot(
  routine: NormalizedRoutine,
  slot: TrainingSlotKind,
): boolean {
  const mob = routineMobilityKind(routine);
  if (slot === "light_mobility") {
    return mob === "mobility" && routineMinutes(routine) <= 15;
  }
  if (slot === "mobility") {
    return mob === "mobility";
  }
  return mob === "strength";
}

function shuffleStable<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

function pickRoutines(
  routines: readonly NormalizedRoutine[],
  slot: TrainingSlotKind,
  targetMinutes: number,
  location: SessionLocation,
  settings: TrainingSettings,
  rng: () => number,
): NormalizedRoutine[] {
  const pool = routines.filter((routine) => {
    if (!matchesSlot(routine, slot)) {
      return false;
    }
    if (location === "home" && settings.noHomeBells) {
      const needsKb = routine.equipment.some((eq) => /kettlebell|kb/i.test(eq));
      if (needsKb) {
        return false;
      }
    }
    return true;
  });

  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  const shuffled = shuffleStable(sorted, rng);
  const picked: NormalizedRoutine[] = [];
  let total = 0;

  for (const routine of shuffled) {
    const minutes = routineMinutes(routine);
    if (picked.length === 0 || total + minutes <= targetMinutes) {
      picked.push(routine);
      total += minutes;
    }
    if (total >= targetMinutes) {
      break;
    }
  }

  if (picked.length === 0 && sorted.length > 0) {
    picked.push(sorted[0]!);
  }
  return picked;
}

function exerciseEquipmentRank(exercise: NormalizedExercise): number {
  const equipment = (exercise.equipment ?? "").toLowerCase();
  if (exercise.overlay?.kettlebell) {
    return 0;
  }
  if (/kettlebell|\bkb\b/.test(equipment)) {
    return 0;
  }
  if (!equipment || /bodyweight|none/.test(equipment)) {
    return 1;
  }
  if (/band/.test(equipment)) {
    return 2;
  }
  return 3;
}

function orderExercises(exercises: NormalizedExercise[]): NormalizedExercise[] {
  return [...exercises].sort((a, b) => {
    const rank = exerciseEquipmentRank(a) - exerciseEquipmentRank(b);
    if (rank !== 0) {
      return rank;
    }
    return a.id.localeCompare(b.id);
  });
}

function sessionLocation(
  sessionIndex: number,
  settings: TrainingSettings,
): SessionLocation {
  if (settings.gymBellsKg.length === 0) {
    return "home";
  }
  return sessionIndex % 2 === 0 ? "home" : "gym";
}

function sessionTitle(slot: TrainingSlotKind, routines: NormalizedRoutine[]): string {
  if (routines.length === 1) {
    return routines[0]!.title;
  }
  switch (slot) {
    case "mobility":
      return "Mobility session";
    case "strength":
      return "Strength session";
    case "light_mobility":
      return "Light mobility";
  }
}

function targetMinutesForSlot(
  slot: TrainingSlotKind,
  sessionMinutes: number,
): number {
  if (slot === "light_mobility") {
    return Math.min(sessionMinutes, 15);
  }
  return sessionMinutes;
}

function restMobilityMinutes(rng: () => number): number {
  return 5 + Math.floor(rng() * 6);
}

function filterSession(
  candidateIds: string[],
  context: SafetyFilterContext,
  exercisesById: ReadonlyMap<string, NormalizedExercise>,
): WeekPlanSessionResult {
  const candidates = candidateIds
    .map((id) => exercisesById.get(id))
    .filter((row): row is NormalizedExercise => row !== undefined);
  const result = filterExercisesForScheduling(candidates, context);
  return { scheduled: result.scheduled, dropped: result.dropped };
}

function assertNoHighRiskScheduled(
  scheduled: WeekPlanSessionResult["scheduled"],
  exercisesById: ReadonlyMap<string, NormalizedExercise>,
  active: ReadonlySet<string>,
): void {
  for (const row of scheduled) {
    const exercise = exercisesById.get(row.exerciseId);
    if (!exercise) {
      continue;
    }
    const level = effectiveRiskForActiveConditions(exercise, active);
    if (level === "high") {
      throw new Error(
        `Planner scheduled high-risk exercise ${row.exerciseId} (fail-closed violation).`,
      );
    }
  }
}

export function buildWeeklyPlan(input: BuildWeekPlanInput): BuildWeekPlanResult {
  const seed = input.seed ?? defaultPlanSeed(input.settings);
  const rng = createSeededRng(seed);
  const layout = layoutWeek(input.settings.daysPerWeek);
  const active = activeConditionIds(input.settings);
  const context: SafetyFilterContext = {
    conditions: input.conditions,
    activeConditionIds: active,
    excludedExerciseIds: input.excludedExerciseIds ?? new Set(),
    exercisesById: input.exercisesById,
    routineNotesById: input.routineNotesById,
    conditionLabel: input.conditionLabel,
  };

  const rows: WeekPlanRow[] = [];
  const sessions: Record<string, WeekPlanSessionResult> = {};
  const weekSessionsRemaining: WeekSessionCandidate[] = [];
  let sessionIndex = 0;

  for (const cell of layout) {
    if (cell.slotKind === "rest") {
      const sessionId = `rest-${cell.dayIndex}`;
      const minutes = restMobilityMinutes(rng);
      const restRng = createSeededRng(`${seed}:rest:${cell.dayIndex}`);
      const picked = pickRoutines(
        input.routines,
        "light_mobility",
        minutes,
        "home",
        input.settings,
        restRng,
      );
      const exerciseRows: NormalizedExercise[] = [];
      for (const routine of picked) {
        for (const exerciseId of routine.exerciseIds) {
          const exercise = input.exercisesById.get(exerciseId);
          if (exercise) {
            exerciseRows.push(exercise);
          }
        }
      }
      const ordered = orderExercises(exerciseRows);
      const candidateExerciseIds = ordered.map((row) => row.id);
      const filtered = filterSession(candidateExerciseIds, context, input.exercisesById);
      assertNoHighRiskScheduled(filtered.scheduled, input.exercisesById, active);
      sessions[sessionId] = filtered;
      const hasCaution = filtered.scheduled.some((row) => row.cautions.length > 0);
      rows.push({
        dayIndex: cell.dayIndex,
        dayLabel: cell.dayLabel,
        slotKind: "rest",
        sessionId,
        title: "Rest day",
        location: "home",
        minutes,
        hasCaution,
        candidateExerciseIds,
      });
      continue;
    }

    const slot = cell.slotKind;
    const location = sessionLocation(sessionIndex, input.settings);
    const targetMinutes = targetMinutesForSlot(slot, input.settings.sessionMinutes);
    const picked = pickRoutines(
      input.routines,
      slot,
      targetMinutes,
      location,
      input.settings,
      rng,
    );

    const exerciseRows: NormalizedExercise[] = [];
    for (const routine of picked) {
      for (const exerciseId of routine.exerciseIds) {
        const exercise = input.exercisesById.get(exerciseId);
        if (exercise) {
          exerciseRows.push(exercise);
        }
      }
    }

    const ordered = orderExercises(exerciseRows);
    const candidateExerciseIds = ordered.map((row) => row.id);
    const sessionId = `train-${cell.dayIndex}`;
    const filtered = filterSession(candidateExerciseIds, context, input.exercisesById);
    assertNoHighRiskScheduled(filtered.scheduled, input.exercisesById, active);

    const hasCaution = filtered.scheduled.some((row) => row.cautions.length > 0);
    const title = sessionTitle(slot, picked);

    rows.push({
      dayIndex: cell.dayIndex,
      dayLabel: cell.dayLabel,
      slotKind: slot,
      sessionId,
      title,
      location,
      minutes: targetMinutes,
      hasCaution,
      candidateExerciseIds,
    });
    sessions[sessionId] = filtered;
    weekSessionsRemaining.push({ sessionId, exerciseIds: candidateExerciseIds });
    sessionIndex += 1;
  }

  return {
    plan: { seed, rows, sessions },
    weekSessionsRemaining,
  };
}