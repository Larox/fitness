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

export async function fetchImportedLibrary(
  config: AppConfig,
): Promise<LibraryImportResult | { errors: string[] }> {
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
      return { errors: result.errors };
    }
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Library import failed";
    return { errors: [message] };
  }
}