import type { PersistedAppState } from "./types";

const STORAGE_KEY = "fitness.persisted.v1";

export interface SettingsStorage {
  load(): PersistedAppState | null;
  save(state: PersistedAppState): void;
  clear(): void;
}

export function createLocalStorageAdapter(): SettingsStorage {
  return {
    load(): PersistedAppState | null {
      if (typeof localStorage === "undefined") {
        return null;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      try {
        return JSON.parse(raw) as PersistedAppState;
      } catch {
        return null;
      }
    },
    save(state: PersistedAppState): void {
      if (typeof localStorage === "undefined") {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    clear(): void {
      if (typeof localStorage === "undefined") {
        return;
      }
      localStorage.removeItem(STORAGE_KEY);
    },
  };
}

export function createMemoryStorage(): SettingsStorage {
  let value: PersistedAppState | null = null;
  return {
    load: () => value,
    save: (state) => {
      value = structuredClone(state);
    },
    clear: () => {
      value = null;
    },
  };
}