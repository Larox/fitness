export type RoutineVideoPathResult =
  | { ok: true; path?: string }
  | { ok: false; error: string };

/** Validate an optional library routine `video` path from import JSON. */
export function parseRoutineVideoPath(raw: unknown, label: string): RoutineVideoPathResult {
  if (raw === undefined) {
    return { ok: true };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: `${label} must be a string when set` };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: `${label} must be a non-empty string when set` };
  }
  if (trimmed.includes("://") || trimmed.startsWith("//")) {
    return { ok: false, error: `${label} must be a relative path, not a URL` };
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("\\")) {
    return { ok: false, error: `${label} must be a relative path without a leading slash` };
  }
  if (trimmed.includes("..")) {
    return { ok: false, error: `${label} must not contain ..` };
  }
  if (!/^[\w./-]+$/.test(trimmed)) {
    return { ok: false, error: `${label} must use only letters, numbers, /, ., -, and _` };
  }
  return { ok: true, path: trimmed };
}

export function libraryVideoUrl(relativePath: string): string {
  return relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
}