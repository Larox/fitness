import { parseAppConfig } from "./parse";
import type { AppConfig } from "./types";

export async function fetchAppConfig(): Promise<
  { config: AppConfig } | { errors: string[] }
> {
  const paths = ["/config.json", "/config.example.json"];
  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        continue;
      }
      const raw: unknown = await response.json();
      const { config, errors } = parseAppConfig(raw);
      if (config) {
        return { config };
      }
      return { errors };
    } catch {
      continue;
    }
  }
  return {
    errors: [
      "App config could not be loaded. Add config.json to your deployment or ship config.example.json for demos.",
    ],
  };
}