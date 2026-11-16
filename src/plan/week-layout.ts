import type { TrainingSlotKind, WeekSlotKind } from "./types";

export const WEEKDAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

interface TrainingSlot {
  dayIndex: number;
  kind: TrainingSlotKind;
}

const TRAINING_LAYOUT: Record<number, readonly TrainingSlot[]> = {
  2: [
    { dayIndex: 0, kind: "mobility" },
    { dayIndex: 3, kind: "strength" },
  ],
  3: [
    { dayIndex: 0, kind: "mobility" },
    { dayIndex: 2, kind: "strength" },
    { dayIndex: 4, kind: "mobility" },
  ],
  4: [
    { dayIndex: 0, kind: "mobility" },
    { dayIndex: 2, kind: "strength" },
    { dayIndex: 4, kind: "mobility" },
    { dayIndex: 5, kind: "strength" },
  ],
  5: [
    { dayIndex: 0, kind: "mobility" },
    { dayIndex: 1, kind: "strength" },
    { dayIndex: 2, kind: "mobility" },
    { dayIndex: 3, kind: "strength" },
    { dayIndex: 4, kind: "light_mobility" },
  ],
};

export interface WeekLayoutCell {
  dayIndex: number;
  dayLabel: string;
  slotKind: WeekSlotKind;
}

export function layoutWeek(daysPerWeek: number): WeekLayoutCell[] {
  const training =
    TRAINING_LAYOUT[daysPerWeek] ?? TRAINING_LAYOUT[4]!;
  const byDay = new Map(training.map((slot) => [slot.dayIndex, slot.kind]));

  return WEEKDAY_LABELS.map((dayLabel, dayIndex) => {
    const kind = byDay.get(dayIndex);
    return {
      dayIndex,
      dayLabel,
      slotKind: kind ?? "rest",
    };
  });
}

export function strengthDayIndices(daysPerWeek: number): number[] {
  const training = TRAINING_LAYOUT[daysPerWeek] ?? TRAINING_LAYOUT[4]!;
  return training
    .filter((slot) => slot.kind === "strength")
    .map((slot) => slot.dayIndex);
}