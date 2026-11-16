import type { PersistedAppState, SessionCompletionSummary } from "../setup/types";
import { weekStartKey } from "./weekday";

export type { SessionCompletionSummary };

export function completionStorageKey(weekStart: string, sessionId: string): string {
  return `${weekStart}:${sessionId}`;
}

export function markSessionCompleted(
  state: PersistedAppState,
  sessionId: string,
  weekStart: string,
  summary: SessionCompletionSummary,
): PersistedAppState {
  const key = completionStorageKey(weekStart, sessionId);
  const completedSessions = { ...(state.completedSessions ?? {}) };
  completedSessions[key] = summary;
  if (completedSessions[sessionId]) {
    delete completedSessions[sessionId];
  }
  return { ...state, completedSessions };
}

export function unmarkSessionCompleted(
  state: PersistedAppState,
  sessionId: string,
  weekStart: string,
): PersistedAppState {
  if (!state.completedSessions) {
    return state;
  }
  const key = completionStorageKey(weekStart, sessionId);
  const completedSessions = { ...state.completedSessions };
  let changed = false;
  if (completedSessions[key]) {
    delete completedSessions[key];
    changed = true;
  }
  if (completedSessions[sessionId]) {
    delete completedSessions[sessionId];
    changed = true;
  }
  if (!changed) {
    return state;
  }
  return {
    ...state,
    completedSessions: Object.keys(completedSessions).length > 0 ? completedSessions : undefined,
  };
}

/** Legacy keys (session id only) count as done only in the same calendar week as completedAt. */
export function isSessionCompleted(
  completedSessions: PersistedAppState["completedSessions"],
  sessionId: string,
  weekStart: string,
): boolean {
  const keyed = completedSessions?.[completionStorageKey(weekStart, sessionId)];
  if (keyed) {
    return true;
  }
  const legacy = completedSessions?.[sessionId];
  if (!legacy) {
    return false;
  }
  return weekStartKey(new Date(legacy.completedAt)) === weekStart;
}

export function sessionCompletionSummary(
  completedSessions: PersistedAppState["completedSessions"],
  sessionId: string,
  weekStart: string,
): SessionCompletionSummary | undefined {
  const keyed = completedSessions?.[completionStorageKey(weekStart, sessionId)];
  if (keyed) {
    return keyed;
  }
  const legacy = completedSessions?.[sessionId];
  if (!legacy) {
    return undefined;
  }
  if (weekStartKey(new Date(legacy.completedAt)) !== weekStart) {
    return undefined;
  }
  return legacy;
}