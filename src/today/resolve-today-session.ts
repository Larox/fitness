import type { WeekPlan, WeekPlanRow, WeekPlanSessionResult } from "../plan/types";
import type { PersistedAppState } from "../setup/types";
import { isSessionCompleted } from "./completion";
import { rowForDay } from "./resolve-session";
import { weekStartForPlanRow } from "./weekday";

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

export interface ResolveTodayViewOptions {
  trainEarlySessionId?: string | null;
  completedSessions?: PersistedAppState["completedSessions"];
  referenceDate?: Date;
  /** Keep the in-flight train-early session on screen after save until the next load. */
  holdTrainEarlyCompleted?: boolean;
}

export function resolveTodayView(
  plan: WeekPlan,
  dayIndex: number,
  options: ResolveTodayViewOptions = {},
): ResolvedTodayView | null {
  const trainEarlySessionId = options.trainEarlySessionId ?? null;
  const completedSessions = options.completedSessions;
  const referenceDate = options.referenceDate ?? new Date();
  const holdTrainEarlyCompleted = options.holdTrainEarlyCompleted === true;

  function sessionDone(row: WeekPlanRow): boolean {
    if (!completedSessions) {
      return false;
    }
    const week = weekStartForPlanRow(referenceDate, row.dayIndex);
    return isSessionCompleted(completedSessions, row.sessionId, week);
  }

  const calendarRow = rowForDay(plan, dayIndex);
  if (!calendarRow) {
    return null;
  }

  if (trainEarlySessionId) {
    const row = plan.rows.find(
      (candidate) => candidate.sessionId === trainEarlySessionId && candidate.slotKind !== "rest",
    );
    const session = row ? plan.sessions[row.sessionId] : undefined;
    if (
      row &&
      session &&
      session.scheduled.length > 0 &&
      (!sessionDone(row) || holdTrainEarlyCompleted)
    ) {
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

  for (let offset = 1; offset <= 7; offset++) {
    const nextDayIndex = (dayIndex + offset) % 7;
    const next = rowForDay(plan, nextDayIndex);
    if (!next || next.slotKind === "rest") {
      continue;
    }
    const session = plan.sessions[next.sessionId];
    if (!session || session.scheduled.length === 0 || sessionDone(next)) {
      continue;
    }
    return {
      row: next,
      session,
      mode: "preview",
      scheduledDayLabel: next.dayLabel,
    };
  }

  const restSession = plan.sessions[calendarRow.sessionId];
  if (restSession && restSession.scheduled.length > 0) {
    return { row: calendarRow, session: restSession, mode: "scheduled" };
  }
  return null;
}