import type { AppConfig, ConditionConfig } from "../config/types";

export interface ConditionOverride {
  label?: string;
  notes?: string;
  updatedAt: string;
}

export type ConditionOverrides = Record<string, ConditionOverride>;

export function tidyConditionName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function defaultConditionNotes(condition: ConditionConfig): string {
  return condition.description ?? "";
}

export function conditionOverrideIsEdited(
  overrides: ConditionOverrides,
  conditionId: string,
): boolean {
  return overrides[conditionId] !== undefined;
}

/** Build a sparse override from draft values, or null when everything matches config. */
export function buildConditionOverridePatch(
  condition: ConditionConfig,
  draft: { label: string; notes: string },
  updatedAt: string,
): ConditionOverride | null {
  const label = tidyConditionName(draft.label);
  const notes = draft.notes.trim();
  const patch: ConditionOverride = { updatedAt };
  let hasField = false;
  if (label !== condition.label) {
    patch.label = label;
    hasField = true;
  }
  const defaultNotes = defaultConditionNotes(condition);
  if (notes !== defaultNotes) {
    patch.notes = notes;
    hasField = true;
  }
  return hasField ? patch : null;
}

export function mergeConditionOverride(
  existing: ConditionOverrides,
  conditionId: string,
  patch: ConditionOverride | null,
): ConditionOverrides {
  const next = { ...existing };
  if (patch === null) {
    delete next[conditionId];
  } else {
    next[conditionId] = patch;
  }
  return next;
}

export function pruneConditionOverrides(
  overrides: ConditionOverrides,
  config: AppConfig,
): ConditionOverrides {
  const allowed = new Set(config.conditions.map((c) => c.id));
  const next: ConditionOverrides = {};
  for (const [id, raw] of Object.entries(overrides)) {
    if (!allowed.has(id)) {
      continue;
    }
    const condition = config.conditions.find((c) => c.id === id);
    if (!condition || !isPlainOverride(raw)) {
      continue;
    }
    const resolvedLabel = typeof raw.label === "string" ? raw.label : condition.label;
    const resolvedNotes =
      typeof raw.notes === "string" ? raw.notes : defaultConditionNotes(condition);
    const updatedAt =
      typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString();
    const patch = buildConditionOverridePatch(
      condition,
      { label: resolvedLabel, notes: resolvedNotes },
      updatedAt,
    );
    if (patch) {
      next[id] = patch;
    }
  }
  return next;
}

function isPlainOverride(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeConditionOverrides(
  raw: unknown,
  config: AppConfig,
): ConditionOverrides {
  if (!isPlainOverride(raw)) {
    return {};
  }
  const draft: ConditionOverrides = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (!isPlainOverride(entry)) {
      continue;
    }
    const patch: ConditionOverride = {
      updatedAt:
        typeof entry.updatedAt === "string"
          ? entry.updatedAt
          : new Date(0).toISOString(),
    };
    let hasField = false;
    if (typeof entry.label === "string" && entry.label.trim()) {
      patch.label = entry.label;
      hasField = true;
    }
    if (typeof entry.notes === "string") {
      patch.notes = entry.notes;
      hasField = true;
    }
    if (hasField) {
      draft[id] = patch;
    }
  }
  return pruneConditionOverrides(draft, config);
}

export function resolvedConditionLabel(
  condition: ConditionConfig,
  overrides: ConditionOverrides,
): string {
  return overrides[condition.id]?.label ?? condition.label;
}

export function resolvedConditionNotes(
  condition: ConditionConfig,
  overrides: ConditionOverrides,
): string {
  return overrides[condition.id]?.notes ?? defaultConditionNotes(condition);
}