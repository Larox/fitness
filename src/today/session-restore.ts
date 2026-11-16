import { getLatestSessionLogForSession, getSessionLog } from "./session-log-store";

export function sessionLogId(sessionId: string, completedAt: string): string {
  return `${sessionId}:${completedAt}`;
}

/** Resolve the IndexedDB session log id for a completed session (exact id or latest match). */
export async function resolveSavedSessionLogId(
  sessionId: string,
  completedAt: string,
): Promise<string | null> {
  const exactId = sessionLogId(sessionId, completedAt);
  const exact = await getSessionLog(exactId);
  if (exact) {
    return exact.id;
  }
  const latest = await getLatestSessionLogForSession(sessionId);
  if (latest?.completedAt === completedAt) {
    return latest.id;
  }
  return null;
}