import type { PersistedAppState, SessionCompletionSummary } from "../setup/types";

export type { SessionCompletionSummary };

export function markSessionCompleted(
  state: PersistedAppState,
  sessionId: string,
  summary: SessionCompletionSummary,
): PersistedAppState {
  const completedSessions = { ...(state.completedSessions ?? {}) };
  completedSessions[sessionId] = summary;
  return { ...state, completedSessions };
}

export function unmarkSessionCompleted(
  state: PersistedAppState,
  sessionId: string,
): PersistedAppState {
  if (!state.completedSessions?.[sessionId]) {
    return state;
  }
  const completedSessions = { ...state.completedSessions };
  delete completedSessions[sessionId];
  return {
    ...state,
    completedSessions: Object.keys(completedSessions).length > 0 ? completedSessions : undefined,
  };
}

export function isSessionCompleted(
  state: PersistedAppState,
  sessionId: string,
): boolean {
  return Boolean(state.completedSessions?.[sessionId]);
}