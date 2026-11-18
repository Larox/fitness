export interface ClipTimes {
  startS?: number;
  endS?: number;
}

export interface ResolvedVideoSegment {
  startS: number;
  endS: number;
  /** Segment length in seconds (end − start). */
  spanS: number;
  usesFullVideo: boolean;
}

function finiteNonNegative(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}

/** Merge device override on top of library defaults (override wins per field). */
export function mergeClipTimes(library: ClipTimes | undefined, override: ClipTimes | undefined): ClipTimes {
  return {
    startS: override?.startS ?? library?.startS,
    endS: override?.endS ?? library?.endS,
  };
}

/**
 * Resolve effective playback segment for a library exercise video.
 * Invalid or missing pairs fall back to the full video when duration is known.
 */
export function resolveExerciseVideoSegment(
  library: ClipTimes | undefined,
  deviceOverride: ClipTimes | undefined,
  videoDurationS: number | null | undefined,
): ResolvedVideoSegment | null {
  const merged = mergeClipTimes(library, deviceOverride);
  const startRaw = finiteNonNegative(merged.startS);
  const endRaw = finiteNonNegative(merged.endS);

  const duration =
    typeof videoDurationS === "number" && Number.isFinite(videoDurationS) && videoDurationS > 0
      ? videoDurationS
      : null;

  if (startRaw === undefined && endRaw === undefined) {
    if (duration === null) {
      return null;
    }
    return { startS: 0, endS: duration, spanS: duration, usesFullVideo: true };
  }

  if (startRaw === undefined || endRaw === undefined) {
    if (duration === null) {
      return null;
    }
    return { startS: 0, endS: duration, spanS: duration, usesFullVideo: true };
  }

  if (startRaw >= endRaw) {
    if (duration === null) {
      return null;
    }
    return { startS: 0, endS: duration, spanS: duration, usesFullVideo: true };
  }

  let startS = startRaw;
  let endS = endRaw;
  if (duration !== null) {
    if (startS >= duration || endS <= 0) {
      return { startS: 0, endS: duration, spanS: duration, usesFullVideo: true };
    }
    startS = Math.min(startS, duration);
    endS = Math.min(endS, duration);
    if (startS >= endS) {
      return { startS: 0, endS: duration, spanS: duration, usesFullVideo: true };
    }
  }

  return {
    startS,
    endS,
    spanS: endS - startS,
    usesFullVideo: duration !== null && startS === 0 && endS === duration,
  };
}

export function libraryVideoUrlWithFragment(
  relativePath: string,
  segment: Pick<ResolvedVideoSegment, "startS" | "endS" | "usesFullVideo">,
): string {
  const base = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  if (segment.usesFullVideo) {
    return base;
  }
  const start = formatMediaFragmentTime(segment.startS);
  const end = formatMediaFragmentTime(segment.endS);
  return `${base}#t=${start},${end}`;
}

function formatMediaFragmentTime(seconds: number): string {
  if (seconds === 0) {
    return "0";
  }
  const rounded = Math.round(seconds * 100) / 100;
  return String(rounded).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}