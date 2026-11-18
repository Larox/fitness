/** Calendar weekday as week-plan dayIndex: Mon=0 … Sun=6. */
export function weekPlanDayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Local calendar date (YYYY-MM-DD) for the Monday that starts this week. */
export function weekStartKey(date: Date): string {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - weekPlanDayIndex(date));
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const LONG_DAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/**
 * Week-start key for a plan row's session, relative to the calendar day `reference`.
 * When reference is later in the week than the row (e.g. Sunday previewing Monday), the
 * session is treated as belonging to the following calendar week.
 */
export function weekStartForPlanRow(reference: Date, rowDayIndex: number): string {
  const todayIndex = weekPlanDayIndex(reference);
  const sessionDate = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  sessionDate.setDate(sessionDate.getDate() - todayIndex + rowDayIndex);
  if (todayIndex > rowDayIndex) {
    sessionDate.setDate(sessionDate.getDate() + 7);
  }
  return weekStartKey(sessionDate);
}

export function formatTodayOverline(date: Date): string {
  const day = LONG_DAY[weekPlanDayIndex(date)]!;
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).formatToParts(date);
  const dayNum = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `TODAY · ${day.toUpperCase()}, ${dayNum} ${month.toUpperCase()}`;
}