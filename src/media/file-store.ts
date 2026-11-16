import type { MediaImportProgress } from "./types";

const IDB_NAME = "fitness.media.files.v1";
const IDB_STORE = "blobs";

type StoredRow = { key: string; blob: Blob };

function openIdb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("idb-unavailable"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb-open-failed"));
  });
}

async function idbGet(key: string): Promise<Blob | null> {
  let db: IDBDatabase;
  try {
    db = await openIdb();
  } catch {
    return null;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(key);
    req.onsuccess = () => {
      const row = req.result as StoredRow | undefined;
      resolve(row?.blob ?? null);
    };
    req.onerror = () => reject(req.error ?? new Error("idb-read-failed"));
  });
}

async function idbPut(
  key: string,
  blob: Blob,
  onProgress?: (p: MediaImportProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  onProgress?.({ loaded: blob.size, total: blob.size });
  let db: IDBDatabase;
  try {
    db = await openIdb();
  } catch {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    store.put({ key, blob } satisfies StoredRow);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb-write-failed"));
  });
}

async function idbDelete(key: string): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openIdb();
  } catch {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb-delete-failed"));
  });
}

async function opfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!navigator.storage?.getDirectory) {
    return null;
  }
  try {
    return await navigator.storage.getDirectory();
  } catch {
    return null;
  }
}

async function opfsWrite(
  key: string,
  blob: Blob,
  onProgress?: (p: MediaImportProgress) => void,
  signal?: AbortSignal,
): Promise<boolean> {
  const root = await opfsRoot();
  if (!root) {
    return false;
  }
  try {
    const file = await root.getFileHandle(key, { create: true });
    const writable = await file.createWritable();
    const total = blob.size;
    let loaded = 0;
    const reader = blob.stream().getReader();
    try {
      while (true) {
        if (signal?.aborted) {
          await writable.abort();
          throw new DOMException("Aborted", "AbortError");
        }
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          await writable.write(value);
          loaded += value.byteLength;
          onProgress?.({ loaded, total });
        }
      }
      await writable.close();
      return true;
    } catch (err) {
      try {
        await writable.abort();
      } catch {
        /* ignore */
      }
      throw err;
    }
  } catch {
    return false;
  }
}

async function opfsRead(key: string): Promise<Blob | null> {
  const root = await opfsRoot();
  if (!root) {
    return null;
  }
  try {
    const file = await root.getFileHandle(key);
    const f = await file.getFile();
    return f;
  } catch {
    return null;
  }
}

async function opfsDelete(key: string): Promise<void> {
  const root = await opfsRoot();
  if (!root) {
    return;
  }
  try {
    await root.removeEntry(key);
  } catch {
    /* ignore missing */
  }
}

export async function readMediaBlob(key: string): Promise<Blob | null> {
  const fromOpfs = await opfsRead(key);
  if (fromOpfs) {
    return fromOpfs;
  }
  return idbGet(key);
}

export async function writeMediaBlob(
  key: string,
  blob: Blob,
  onProgress?: (p: MediaImportProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const wroteOpfs = await opfsWrite(key, blob, onProgress, signal);
  if (wroteOpfs) {
    return;
  }
  try {
    await idbPut(key, blob, onProgress, signal);
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      throw err;
    }
    throw err;
  }
}

export async function deleteMediaBlob(key: string): Promise<void> {
  await Promise.all([opfsDelete(key), idbDelete(key)]);
}

export async function estimateDeviceStorage(): Promise<{ usage: number; quota: number }> {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: Number.MAX_SAFE_INTEGER };
  }
  const est = await navigator.storage.estimate();
  return {
    usage: est.usage ?? 0,
    quota: est.quota ?? Number.MAX_SAFE_INTEGER,
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}