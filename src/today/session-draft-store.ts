import type { ExerciseSetLog } from "./types";

const IDB_NAME = "fitness.session.drafts.v1";
const STORE = "drafts";

export interface SessionDraftCardState {
  expanded: boolean;
  done: boolean;
  hurt: boolean;
  bellKg: number | null | undefined;
  setLogs: ExerciseSetLog[];
}

export interface SessionDraftRecord {
  id: string;
  sessionId: string;
  weekStart: string;
  dayIndex: number;
  updatedAt: string;
  cards: Record<string, SessionDraftCardState>;
}

function openIdb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("idb-unavailable"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb-open-failed"));
  });
}

function txPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("idb-failed"));
  });
}

function draftId(weekStart: string, sessionId: string): string {
  return `${weekStart}:${sessionId}`;
}

function isDraftRecord(value: unknown): value is SessionDraftRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as SessionDraftRecord;
  return (
    typeof row.id === "string" &&
    typeof row.sessionId === "string" &&
    typeof row.weekStart === "string" &&
    typeof row.updatedAt === "string" &&
    typeof row.cards === "object" &&
    row.cards !== null
  );
}

export async function saveSessionDraft(record: SessionDraftRecord): Promise<void> {
  const db = await openIdb();
  const tx = db.transaction(STORE, "readwrite");
  await txPromise(tx.objectStore(STORE).put(record));
}

export async function getSessionDraft(
  weekStart: string,
  sessionId: string,
): Promise<SessionDraftRecord | null> {
  const db = await openIdb();
  const tx = db.transaction(STORE, "readonly");
  const row = await txPromise(tx.objectStore(STORE).get(draftId(weekStart, sessionId)));
  return isDraftRecord(row) ? row : null;
}

export async function deleteSessionDraft(id: string): Promise<void> {
  const db = await openIdb();
  const tx = db.transaction(STORE, "readwrite");
  await txPromise(tx.objectStore(STORE).delete(id));
}

export function buildSessionDraftId(weekStart: string, sessionId: string): string {
  return draftId(weekStart, sessionId);
}