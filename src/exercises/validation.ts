import type { ConditionConfig } from "../config/types";
import type { NormalizedExercise } from "../library/types";
import type { ExerciseFormDraft } from "./types";
import { normalizeSourceUrl, validateSourceUrl } from "./url";

export interface ValidationIssue {
  field: "name" | "link" | "duplicate";
  message: string;
  duplicateExerciseId?: string;
  duplicateName?: string;
}

export interface ValidateFormOptions {
  draft: ExerciseFormDraft;
  conditions: readonly ConditionConfig[];
  libraryExercises: readonly NormalizedExercise[];
  userNames: readonly { id: string; name: string }[];
  editingId?: string;
  validateNow: boolean;
}

function normalizedName(name: string): string {
  return name.trim().toLowerCase();
}

export function findDuplicateByName(
  name: string,
  libraryExercises: readonly NormalizedExercise[],
  userNames: readonly { id: string; name: string }[],
  editingId?: string,
): { id: string; name: string; imported: boolean } | null {
  const key = normalizedName(name);
  if (!key) {
    return null;
  }
  for (const row of userNames) {
    if (editingId && row.id === editingId) {
      continue;
    }
    if (normalizedName(row.name) === key) {
      return { id: row.id, name: row.name.trim(), imported: false };
    }
  }
  for (const ex of libraryExercises) {
    if (normalizedName(ex.name) === key) {
      return { id: ex.id, name: ex.name.trim(), imported: true };
    }
  }
  return null;
}

export function validateExerciseForm(options: ValidateFormOptions): ValidationIssue[] {
  if (!options.validateNow) {
    return [];
  }
  const issues: ValidationIssue[] = [];
  const name = options.draft.name.trim();
  if (!name) {
    issues.push({ field: "name", message: "Give the exercise a name." });
  } else {
    const dup = findDuplicateByName(
      name,
      options.libraryExercises,
      options.userNames,
      options.editingId,
    );
    if (dup) {
      const message = dup.imported
        ? `You already have “${dup.name}”. Pick another name.`
        : `You already have “${dup.name}”. Pick another name, or edit that one.`;
      issues.push({
        field: "duplicate",
        message,
        duplicateExerciseId: dup.id,
        duplicateName: dup.name,
      });
    }
  }
  const linkRaw = options.draft.link;
  const linkNorm = normalizeSourceUrl(linkRaw);
  const linkError = validateSourceUrl(linkNorm);
  if (linkError) {
    issues.push({ field: "link", message: linkError });
  }
  return issues;
}