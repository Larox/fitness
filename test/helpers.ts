import { loadAppConfig } from "../src/config/load";
import type { ConditionConfig } from "../src/config/types";

const exampleConfigPath = "config.example.json";

export function loadExampleConditions(): ConditionConfig[] {
  return loadAppConfig(exampleConfigPath).conditions;
}