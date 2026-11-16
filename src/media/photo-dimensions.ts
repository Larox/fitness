import { PHOTO_MAX_SOURCE_BYTES, PHOTO_MAX_SOURCE_PIXELS } from "./limits";

export async function rejectOversizedPhotoSource(file: Blob): Promise<void> {
  if (file.size > PHOTO_MAX_SOURCE_BYTES) {
    throw new Error("source-too-large");
  }
  const name = file instanceof File ? file.name.toLowerCase() : "";
  const pixels = await readImagePixelCount(file, name);
  if (pixels !== null && pixels > PHOTO_MAX_SOURCE_PIXELS) {
    throw new Error("source-too-large");
  }
}

async function readImagePixelCount(file: Blob, fileName: string): Promise<number | null> {
  const type = file.type.toLowerCase();
  if (type === "image/png" || fileName.endsWith(".png")) {
    return readPngPixelCount(file);
  }
  if (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg")
  ) {
    return readJpegPixelCount(file);
  }
  return null;
}

async function readPrefix(file: Blob, length: number): Promise<Uint8Array> {
  const buffer = await file.slice(0, length).arrayBuffer();
  return new Uint8Array(buffer);
}

async function readPngPixelCount(file: Blob): Promise<number | null> {
  if (file.size < 24) {
    return null;
  }
  const buf = await readPrefix(file, 24);
  const width =
    (buf[16]! << 24) | (buf[17]! << 16) | (buf[18]! << 8) | buf[19]!;
  const height =
    (buf[20]! << 24) | (buf[21]! << 16) | (buf[22]! << 8) | buf[23]!;
  if (!width || !height) {
    return null;
  }
  return width * height;
}

async function readJpegPixelCount(file: Blob): Promise<number | null> {
  const buf = await readPrefix(file, Math.min(file.size, 512 * 1024));
  let offset = 2;
  while (offset + 8 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1]!;
    if (marker === 0xc0 || marker === 0xc2) {
      const height = (buf[offset + 5]! << 8) | buf[offset + 6]!;
      const width = (buf[offset + 7]! << 8) | buf[offset + 8]!;
      if (!width || !height) {
        return null;
      }
      return width * height;
    }
    const segmentLength = (buf[offset + 2]! << 8) | buf[offset + 3]!;
    if (segmentLength < 2) {
      return null;
    }
    offset += 2 + segmentLength;
  }
  return null;
}