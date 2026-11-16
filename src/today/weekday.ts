/** Calendar weekday as week-plan dayIndex: Mon=0 … Sun=6. */
export function weekPlanDayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

const LONG_DAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

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