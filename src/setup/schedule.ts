export const DAYS_PER_WEEK_MIN = 2;
export const DAYS_PER_WEEK_MAX = 5;
export const DEFAULT_DAYS_PER_WEEK = 4;

export const SESSION_LENGTH_OPTIONS = [20, 30, 45] as const;
export const DEFAULT_SESSION_MINUTES = 30;

export type SessionLengthMinutes = (typeof SESSION_LENGTH_OPTIONS)[number];

export function clampDaysPerWeek(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_DAYS_PER_WEEK;
  }
  const rounded = Math.round(value);
  return Math.min(DAYS_PER_WEEK_MAX, Math.max(DAYS_PER_WEEK_MIN, rounded));
}

export function isValidSessionMinutes(
  value: number,
): value is SessionLengthMinutes {
  return (SESSION_LENGTH_OPTIONS as readonly number[]).includes(value);
}

export function normalizeSessionMinutes(value: number): SessionLengthMinutes {
  if (isValidSessionMinutes(value)) {
    return value;
  }
  return DEFAULT_SESSION_MINUTES;
}

/** Hint copy for the days-per-week control (product: day 5 is a light mobility day). */
export function daysPerWeekHint(days: number): string {
  if (days >= 5) {
    return "Day 5 is a light mobility day only, never strength.";
  }
  return "Hard days never land back to back.";
}