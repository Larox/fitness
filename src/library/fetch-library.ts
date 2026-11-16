import { importLibrary } from "./import";
import type { ExerciseOverlayFile, LibraryImportResult } from "./types";
import type { AppConfig } from "../config/types";

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(path.startsWith("/") ? path : `/${path}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

export type FetchLibraryResult =
  | { ok: true; result: LibraryImportResult }
  | { ok: false; errors: string[] };

export async function fetchImportedLibrary(
  config: AppConfig,
): Promise<FetchLibraryResult> {
  try {
    const snapshot = (await fetchJson(config.libraryPath)) as Parameters<
      typeof importLibrary
    >[0];
    let overlay: ExerciseOverlayFile = {};
    if (config.overlayPath) {
      overlay = (await fetchJson(config.overlayPath)) as ExerciseOverlayFile;
    }
    const result = importLibrary(snapshot, { conditions: config.conditions }, overlay);
    if (result.errors.length > 0) {
      return { ok: false, errors: result.errors };
    }
    return { ok: true, result };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Library import failed";
    return { ok: false, errors: [message] };
  }
}