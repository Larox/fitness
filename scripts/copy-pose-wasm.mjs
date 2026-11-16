import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmSrc = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const outDir = join(root, "public", "models", "wasm");
const modelsDir = join(root, "public", "models");

await mkdir(outDir, { recursive: true });
await cp(wasmSrc, outDir, { recursive: true });

const files = [
  { path: "pose_landmarker_lite.task", abs: join(modelsDir, "pose_landmarker_lite.task") },
  { path: "wasm/vision_wasm_internal.js", abs: join(outDir, "vision_wasm_internal.js") },
  { path: "wasm/vision_wasm_internal.wasm", abs: join(outDir, "vision_wasm_internal.wasm") },
  { path: "wasm/vision_wasm_nosimd_internal.js", abs: join(outDir, "vision_wasm_nosimd_internal.js") },
  { path: "wasm/vision_wasm_nosimd_internal.wasm", abs: join(outDir, "vision_wasm_nosimd_internal.wasm") },
];

const manifestFiles = [];
let total = 0;
for (const file of files) {
  try {
    const st = await stat(file.abs);
    manifestFiles.push({ path: file.path, bytes: st.size });
    total += st.size;
  } catch {
    if (file.path.endsWith(".task")) {
      console.warn("pose_landmarker_lite.task missing — run npm run fetch-model first");
    }
  }
}

const manifest = {
  version: "pose_landmarker_lite",
  totalBytes: total,
  files: manifestFiles,
};
await writeFile(join(modelsDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Pose model manifest: ${total} bytes across ${manifestFiles.length} files`);