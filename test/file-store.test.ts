/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const idbStore = new Map<string, Blob>();
const opfsFiles = new Map<string, Blob>();

function stubIdb(): void {
  vi.stubGlobal("indexedDB", {
    open: () => {
      const req = {
        onsuccess: null as null | (() => void),
        onupgradeneeded: null as null | (() => void),
        result: {
          transaction: () => {
            const tx = {
              oncomplete: null as null | (() => void),
              objectStore: () => ({
                put: (row: { key: string; blob: Blob }) => {
                  idbStore.set(row.key, row.blob);
                },
                get: (key: string) => {
                  const row = {
                    onsuccess: null as null | (() => void),
                    result: idbStore.has(key) ? { key, blob: idbStore.get(key) } : undefined,
                  };
                  queueMicrotask(() => row.onsuccess?.());
                  return row;
                },
                delete: (key: string) => {
                  idbStore.delete(key);
                },
              }),
            };
            queueMicrotask(() => tx.oncomplete?.());
            return tx;
          },
        },
      };
      queueMicrotask(() => req.onsuccess?.call(req));
      return req;
    },
  } as unknown as IDBFactory);
}

function stubNavigator(opfsWritable: boolean): void {
  vi.stubGlobal("navigator", {
    storage: {
      async getDirectory() {
        return {
          async getFileHandle(name: string, opts?: { create?: boolean }) {
            if (opts?.create && !opfsFiles.has(name)) {
              opfsFiles.set(name, new Blob([]));
            }
            const fileName = name;
            return {
              ...(opfsWritable
                ? {
                    createWritable: async () => {
                      const chunks: Uint8Array[] = [];
                      return {
                        async write(part: Uint8Array) {
                          chunks.push(part);
                        },
                        async close() {
                          opfsFiles.set(
                            fileName,
                            new Blob(chunks, { type: "application/octet-stream" }),
                          );
                        },
                        async abort() {},
                      };
                    },
                  }
                : {}),
              async getFile() {
                return opfsFiles.get(fileName) ?? new Blob([]);
              },
            };
          },
          async removeEntry(name: string) {
            opfsFiles.delete(name);
          },
        };
      },
      estimate: async () => ({ usage: 0, quota: 1_000_000_000 }),
    },
  });
}

describe("file store OPFS fallback", () => {
  beforeEach(() => {
    idbStore.clear();
    opfsFiles.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to IndexedDB when OPFS cannot write", async () => {
    stubNavigator(false);
    stubIdb();
    const { writeMediaBlob, readMediaBlob } = await import("../src/media/file-store");
    const blob = new Blob(["idb-bytes"], { type: "image/jpeg" });
    await writeMediaBlob("photo.bin", blob);
    expect(opfsFiles.has("photo.bin")).toBe(false);
    const read = await readMediaBlob("photo.bin");
    expect(await read!.text()).toBe("idb-bytes");
  });

  it("treats a zero-byte OPFS file as a miss", async () => {
    stubNavigator(true);
    stubIdb();
    opfsFiles.set("empty.bin", new Blob([]));
    idbStore.set("empty.bin", new Blob(["fallback"]));
    const { readMediaBlob } = await import("../src/media/file-store");
    const read = await readMediaBlob("empty.bin");
    expect(await read!.text()).toBe("fallback");
    expect(opfsFiles.has("empty.bin")).toBe(false);
  });
});