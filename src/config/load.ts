import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AppConfig, ConditionConfig } from "./types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseCondition(raw: unknown, index: number): ConditionConfig | string {
  if (typeof raw !== "object" || raw === null) {
    return `conditions[${index}] must be an object`;
  }
  const entry = raw as Record<string, unknown>;
  if (!isNonEmptyString(entry.id)) {
    return `conditions[${index}].id must be a non-empty string`;
  }
  if (!isNonEmptyString(entry.label)) {
    return `conditions[${index}].label must be a non-empty string`;
  }
  if (!isNonEmptyString(entry.libraryField)) {
    return `conditions[${index}].libraryField must be a non-empty string`;
  }
  return {
    id: entry.id.trim(),
    label: entry.label.trim(),
    libraryField: entry.libraryField.trim(),
  };
}

export function parseAppConfig(raw: unknown): { config?: AppConfig; errors: string[] } {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { errors: ["config must be a JSON object"] };
  }
  const obj = raw as Record<string, unknown>;

  if (!isNonEmptyString(obj.libraryPath)) {
    errors.push("libraryPath must be a non-empty string");
  }

  const conditionsRaw = obj.conditions;
  if (!Array.isArray(conditionsRaw) || conditionsRaw.length === 0) {
    errors.push("conditions must be a non-empty array");
  }

  const conditions: ConditionConfig[] = [];
  if (Array.isArray(conditionsRaw)) {
    for (let i = 0; i < conditionsRaw.length; i++) {
      const parsed = parseCondition(conditionsRaw[i], i);
      if (typeof parsed === "string") {
        errors.push(parsed);
      } else {
        conditions.push(parsed);
      }
    }
    const ids = new Set<string>();
    for (const c of conditions) {
      if (ids.has(c.id)) {
        errors.push(`duplicate condition id: ${c.id}`);
      }
      ids.add(c.id);
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  const config: AppConfig = {
    libraryPath: (obj.libraryPath as string).trim(),
    conditions,
  };

  if (obj.overlayPath !== undefined) {
    if (!isNonEmptyString(obj.overlayPath)) {
      errors.push("overlayPath must be a non-empty string when set");
    } else {
      config.overlayPath = obj.overlayPath.trim();
    }
  }

  if (obj.disclaimerContact !== undefined) {
    if (!isNonEmptyString(obj.disclaimerContact)) {
      errors.push("disclaimerContact must be a non-empty string when set");
    } else {
      config.disclaimerContact = obj.disclaimerContact.trim();
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  return { config, errors: [] };
}

export function loadAppConfig(path: string): AppConfig {
  const text = readFileSync(resolve(path), "utf8");
  const raw: unknown = JSON.parse(text);
  const { config, errors } = parseAppConfig(raw);
  if (!config) {
    throw new Error(`Invalid config at ${path}: ${errors.join("; ")}`);
  }
  return config;
}