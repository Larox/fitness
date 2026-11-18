import type { WeekPlan, WeekPlanRow, WeekPlanSessionResult } from "../plan/types";
import { rowForDay } from "./resolve-session";

export function isPlannedTrainingDay(row: WeekPlanRow | undefined): boolean {
  return row !== undefined && row.slotKind !== "rest";
}

export function nextTrainingRow(plan: WeekPlan, fromDayIndex: number): WeekPlanRow | undefined {
  for (let offset = 1; offset <= 7; offset++) {
    const dayIndex = (fromDayIndex + offset) % 7;
    const row = rowForDay(plan, dayIndex);
    if (row && row.slotKind !== "rest") {
      return row;
    }
  }
  return undefined;
}

export type TodayViewMode = "scheduled" | "preview" | "trained_early";

export interface ResolvedTodayView {
  row: WeekPlanRow;
  session: WeekPlanSessionResult;
  mode: TodayViewMode;
  scheduledDayLabel?: string;
}

export function resolveTodayView(
  plan: WeekPlan,
  dayIndex: number,
  trainEarlySessionId: string | null,
): ResolvedTodayView | null {
  const calendarRow = rowForDay(plan, dayIndex);
  if (!calendarRow) {
    return null;
  }

  if (trainEarlySessionId) {
    const row = plan.rows.find(
      (candidate) => candidate.sessionId === trainEarlySessionId && candidate.slotKind !== "rest",
    );
    const session = row ? plan.sessions[row.sessionId] : undefined;
    if (row && session && session.scheduled.length > 0) {
      return { row, session, mode: "trained_early" };
    }
  }

  if (isPlannedTrainingDay(calendarRow)) {
    const session = plan.sessions[calendarRow.sessionId];
    if (!session || session.scheduled.length === 0) {
      return null;
    }
    return { row: calendarRow, session, mode: "scheduled" };
  }

  const next = nextTrainingRow(plan, dayIndex);
  if (next) {
    const session = plan.sessions[next.sessionId];
    if (session && session.scheduled.length > 0) {
      return {
        row: next,
        session,
        mode: "preview",
        scheduledDayLabel: next.dayLabel,
      };
    }
  }

  const restSession = plan.sessions[calendarRow.sessionId];
  if (restSession && restSession.scheduled.length > 0) {
    return { row: calendarRow, session: restSession, mode: "scheduled" };
  }
  return null;
}