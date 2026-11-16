#!/usr/bin/env node
/**
 * Copy an external Leeds library file over the read-only repo snapshot.
 * Usage: npm run sync-library -- /path/to/index.json
 */
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");
const target = resolve(repoRoot, "data/snapshot/index.json");

const sourceArg = process.argv[2];
if (!sourceArg) {
  console.error("Usage: npm run sync-library -- <source-path-to-index.json>");
  process.exit(1);
}

const source = resolve(sourceArg);
if (!existsSync(source)) {
  console.error(`Source not found: ${source}`);
  process.exit(1);
}

copyFileSync(source, target);
console.log(`Copied ${source} -> ${target}`);