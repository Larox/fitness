export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 10) {
    return `${Math.round(mb)} MB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export function formatDurationMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function scaleToLongEdge(
  width: number,
  height: number,
  maxLong: number,
): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxLong) {
    return { width, height };
  }
  const scale = maxLong / long;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}