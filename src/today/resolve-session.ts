import type { WeekPlan, WeekPlanRow } from "../plan/types";

export function rowForDay(plan: WeekPlan, dayIndex: number): WeekPlanRow | undefined {
  return plan.rows.find((row) => row.dayIndex === dayIndex);
}