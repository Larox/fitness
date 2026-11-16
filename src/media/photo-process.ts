import {
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_LONG_EDGE,
  PHOTO_MAX_SOURCE_PIXELS,
  PHOTO_THUMB_LONG_EDGE,
} from "./limits";
import { scaleToLongEdge } from "./format";
import { rejectOversizedPhotoSource } from "./photo-dimensions";

export interface ProcessedPhoto {
  full: Blob;
  poster: Blob;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  sourceBytes: number;
}

type BitmapSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

async function blobToBitmap(file: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      return await createImageBitmap(file);
    }
  }
  throw new Error("unsupported-format");
}

async function drawJpeg(
  source: BitmapSource,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("unsupported-format");
  }
  ctx.drawImage(source, 0, 0, width, height);
  if ("convertToBlob" in canvas) {
    return await (canvas as OffscreenCanvas).convertToBlob({
      type: "image/jpeg",
      quality: PHOTO_JPEG_QUALITY,
    });
  }
  return await new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("unsupported-format"))),
      "image/jpeg",
      PHOTO_JPEG_QUALITY,
    );
  });
}

export async function processPhotoFile(file: Blob): Promise<ProcessedPhoto> {
  await rejectOversizedPhotoSource(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await blobToBitmap(file);
  } catch {
    throw new Error("unsupported-format");
  }
  const sourceWidth = bitmap.width;
  const sourceHeight = bitmap.height;
  if (sourceWidth * sourceHeight > PHOTO_MAX_SOURCE_PIXELS) {
    bitmap.close?.();
    throw new Error("source-too-large");
  }
  const fullSize = scaleToLongEdge(sourceWidth, sourceHeight, PHOTO_MAX_LONG_EDGE);
  const thumbSize = scaleToLongEdge(sourceWidth, sourceHeight, PHOTO_THUMB_LONG_EDGE);
  const full = await drawJpeg(bitmap, fullSize.width, fullSize.height);
  const poster = await drawJpeg(bitmap, thumbSize.width, thumbSize.height);
  bitmap.close?.();
  return {
    full,
    poster,
    width: fullSize.width,
    height: fullSize.height,
    sourceWidth,
    sourceHeight,
    sourceBytes: file.size,
  };
}