import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseAppConfig } from "./parse";
import type { AppConfig } from "./types";

export { parseAppConfig } from "./parse";

export function loadAppConfig(path: string): AppConfig {
  const text = readFileSync(resolve(path), "utf8");
  const raw: unknown = JSON.parse(text);
  const { config, errors } = parseAppConfig(raw);
  if (!config) {
    throw new Error(`Invalid config at ${path}: ${errors.join("; ")}`);
  }
  return config;
}