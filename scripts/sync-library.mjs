#!/usr/bin/env node
/**
 * Copy an external library export into the private library path from config.
 * Usage: npm run sync-library -- /path/to/index.json
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(__dirname, "..");

const DEFAULT_PRIVATE_LIBRARY = "data/private/library.json";

function resolveLibraryTarget() {
  const configPath = resolve(repoRoot, "config.json");
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    if (typeof config.libraryPath === "string" && config.libraryPath.trim()) {
      return resolve(repoRoot, config.libraryPath.trim());
    }
  }
  return resolve(repoRoot, DEFAULT_PRIVATE_LIBRARY);
}

const sourceArg = process.argv[2];
if (!sourceArg) {
  console.error("Usage: npm run sync-library -- <source-path-to-library.json>");
  process.exit(1);
}

const source = resolve(sourceArg);
if (!existsSync(source)) {
  console.error(`Source not found: ${source}`);
  process.exit(1);
}

const target = resolveLibraryTarget();
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Copied ${source} -> ${target}`);