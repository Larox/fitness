import type { SessionLogRecord } from "./types";

const IDB_NAME = "fitness.session.logs.v1";
const STORE = "logs";

function openIdb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("idb-unavailable"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("sessionId", "sessionId", { unique: false });
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

function isLogRecord(value: unknown): value is SessionLogRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as SessionLogRecord;
  return (
    typeof row.id === "string" &&
    typeof row.sessionId === "string" &&
    typeof row.completedAt === "string" &&
    Array.isArray(row.exercises)
  );
}

export async function saveSessionLog(record: SessionLogRecord): Promise<void> {
  const db = await openIdb();
  const tx = db.transaction(STORE, "readwrite");
  await txPromise(tx.objectStore(STORE).put(record));
}

export async function getSessionLog(id: string): Promise<SessionLogRecord | null> {
  const db = await openIdb();
  const tx = db.transaction(STORE, "readonly");
  const row = await txPromise(tx.objectStore(STORE).get(id));
  return isLogRecord(row) ? row : null;
}

export async function getLatestSessionLogForSession(
  sessionId: string,
): Promise<SessionLogRecord | null> {
  const db = await openIdb();
  const tx = db.transaction(STORE, "readonly");
  const index = tx.objectStore(STORE).index("sessionId");
  const rows = (await txPromise(index.getAll(sessionId))) as unknown[];
  const parsed = rows.filter(isLogRecord);
  if (parsed.length === 0) {
    return null;
  }
  parsed.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return parsed[0]!;
}

export async function deleteSessionLog(id: string): Promise<void> {
  const db = await openIdb();
  const tx = db.transaction(STORE, "readwrite");
  await txPromise(tx.objectStore(STORE).delete(id));
}