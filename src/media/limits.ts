export const PHOTO_MAX_LONG_EDGE = 1600;
export const PHOTO_THUMB_LONG_EDGE = 480;
export const PHOTO_JPEG_QUALITY = 0.85;
export const PHOTO_MAX_SOURCE_BYTES = 50 * 1024 * 1024;
export const PHOTO_MAX_SOURCE_PIXELS = 50_000_000;

export const CLIP_MAX_BYTES = 25 * 1024 * 1024;
export const CLIP_MAX_DURATION_S = 30.5;

export const QUOTA_HEADROOM_RATIO = 1.1;

export function clipTooBig(fileSize: number): boolean {
  return fileSize > CLIP_MAX_BYTES;
}

export function photoSourceTooLarge(fileSize: number, width: number, height: number): boolean {
  if (fileSize > PHOTO_MAX_SOURCE_BYTES) {
    return true;
  }
  return width * height > PHOTO_MAX_SOURCE_PIXELS;
}

export function clipTooLong(durationS: number): boolean {
  return Number.isFinite(durationS) && durationS > CLIP_MAX_DURATION_S;
}

export function hasStorageForNewFile(
  usage: number,
  quota: number,
  fileSize: number,
): boolean {
  const free = quota - usage;
  return free >= fileSize * QUOTA_HEADROOM_RATIO;
}