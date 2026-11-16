import type { ExerciseMediaMeta, MediaStorageSettings } from "./types";

const IDB_NAME = "fitness.media.meta.v1";
const META_STORE = "meta";
const SETTINGS_KEY = "settings";

type SettingsRow = { id: string; value: MediaStorageSettings };

function openIdb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("idb-unavailable"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        const store = db.createObjectStore(META_STORE, { keyPath: "id" });
        store.createIndex("exerciseId", "exerciseId", { unique: true });
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

export async function listMediaMeta(): Promise<ExerciseMediaMeta[]> {
  let db: IDBDatabase;
  try {
    db = await openIdb();
  } catch {
    return [];
  }
  const tx = db.transaction(META_STORE, "readonly");
  const store = tx.objectStore(META_STORE);
  const all = await txPromise(store.getAll());
  return (all as ExerciseMediaMeta[]).filter(
    (row) =>
      row.id !== SETTINGS_KEY &&
      typeof row.id === "string" &&
      typeof row.exerciseId === "string",
  );
}

export async function getMediaByExerciseId(
  exerciseId: string,
): Promise<ExerciseMediaMeta | null> {
  let db: IDBDatabase;
  try {
    db = await openIdb();
  } catch {
    return null;
  }
  const tx = db.transaction(META_STORE, "readonly");
  const idx = tx.objectStore(META_STORE).index("exerciseId");
  const match = await txPromise(idx.get(exerciseId));
  return (match as ExerciseMediaMeta | undefined) ?? null;
}

/** Replace metadata for an exercise in one transaction (exerciseId index is unique). */
export async function replaceMediaMetaForExercise(
  exerciseId: string,
  next: ExerciseMediaMeta,
  dropMediaId: string | null,
): Promise<void> {
  const existing = await getMediaByExerciseId(exerciseId);
  let db: IDBDatabase;
  try {
    db = await openIdb();
  } catch (err) {
    throw err instanceof Error ? err : new Error("idb-unavailable");
  }
  const tx = db.transaction(META_STORE, "readwrite");
  const store = tx.objectStore(META_STORE);
  const drop = new Set<string>();
  if (dropMediaId && dropMediaId !== next.id) {
    drop.add(dropMediaId);
  }
  if (existing && existing.id !== next.id) {
    drop.add(existing.id);
  }
  for (const id of drop) {
    store.delete(id);
  }
  store.put({ ...next, exerciseId });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb-write-failed"));
  });
}

export async function putMediaMeta(meta: ExerciseMediaMeta): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openIdb();
  } catch {
    return;
  }
  const tx = db.transaction(META_STORE, "readwrite");
  tx.objectStore(META_STORE).put(meta);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb-write-failed"));
  });
}

export async function deleteMediaMeta(mediaId: string): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openIdb();
  } catch {
    return;
  }
  const tx = db.transaction(META_STORE, "readwrite");
  tx.objectStore(META_STORE).delete(mediaId);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb-delete-failed"));
  });
}

export async function loadMediaSettings(): Promise<MediaStorageSettings> {
  let db: IDBDatabase;
  try {
    db = await openIdb();
  } catch {
    return {};
  }
  const tx = db.transaction(META_STORE, "readonly");
  const row = await txPromise(tx.objectStore(META_STORE).get(SETTINGS_KEY));
  if (row && typeof row === "object" && "value" in row) {
    return (row as SettingsRow).value ?? {};
  }
  return {};
}

export async function saveMediaSettings(settings: MediaStorageSettings): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openIdb();
  } catch {
    return;
  }
  const tx = db.transaction(META_STORE, "readwrite");
  tx.objectStore(META_STORE).put({ id: SETTINGS_KEY, value: settings } satisfies SettingsRow);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb-write-failed"));
  });
}

export async function deleteOrphanMediaMeta(validExerciseIds: ReadonlySet<string>): Promise<void> {
  const rows = await listMediaMeta();
  const orphans = rows.filter((row) => row.id !== SETTINGS_KEY && !validExerciseIds.has(row.exerciseId));
  await Promise.all(
    orphans.map(async (row) => {
      await deleteMediaMeta(row.id);
    }),
  );
  return;
}