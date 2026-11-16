import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "models");
const taskUrl =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const outPath = join(outDir, "pose_landmarker_lite.task");

await mkdir(outDir, { recursive: true });
const res = await fetch(taskUrl);
if (!res.ok) {
  console.error(`fetch-model failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const data = new Uint8Array(await res.arrayBuffer());
await writeFile(outPath, data);
console.log(`Wrote ${outPath} (${data.byteLength} bytes)`);