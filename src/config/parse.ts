import type {
  AppConfig,
  ConditionConfig,
  EquipmentConfig,
  EquipmentLocationBells,
} from "./types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseKgArray(raw: unknown, path: string): number[] | string {
  if (!Array.isArray(raw)) {
    return `${path} must be an array of numbers`;
  }
  const values: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (typeof item !== "number" || !Number.isFinite(item) || item <= 0) {
      return `${path}[${i}] must be a positive number`;
    }
    values.push(item);
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

function parseEquipmentLocation(
  raw: unknown,
  path: string,
): EquipmentLocationBells | string {
  if (typeof raw !== "object" || raw === null) {
    return `${path} must be an object`;
  }
  const obj = raw as Record<string, unknown>;
  const bells = parseKgArray(obj.bellsKg, `${path}.bellsKg`);
  if (typeof bells === "string") {
    return bells;
  }
  return { bellsKg: bells };
}

function parseEquipment(raw: unknown): EquipmentConfig | string {
  if (typeof raw !== "object" || raw === null) {
    return "equipment must be an object";
  }
  const obj = raw as Record<string, unknown>;
  const available = parseKgArray(
    obj.availableBellsKg,
    "equipment.availableBellsKg",
  );
  if (typeof available === "string") {
    return available;
  }
  const home = parseEquipmentLocation(obj.home, "equipment.home");
  if (typeof home === "string") {
    return home;
  }
  const gym = parseEquipmentLocation(obj.gym, "equipment.gym");
  if (typeof gym === "string") {
    return gym;
  }
  for (const kg of home.bellsKg) {
    if (!available.includes(kg)) {
      return `equipment.home.bellsKg contains ${kg} kg, which is not in equipment.availableBellsKg`;
    }
  }
  for (const kg of gym.bellsKg) {
    if (!available.includes(kg)) {
      return `equipment.gym.bellsKg contains ${kg} kg, which is not in equipment.availableBellsKg`;
    }
  }
  return { availableBellsKg: available, home, gym };
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
  const condition: ConditionConfig = {
    id: entry.id.trim(),
    label: entry.label.trim(),
    libraryField: entry.libraryField.trim(),
  };
  if (entry.description !== undefined) {
    if (!isNonEmptyString(entry.description)) {
      return `conditions[${index}].description must be a non-empty string when set`;
    }
    condition.description = entry.description.trim();
  }
  return condition;
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
  if (!Array.isArray(conditionsRaw)) {
    errors.push("conditions must be an array");
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

  const equipmentParsed = parseEquipment(obj.equipment);
  if (typeof equipmentParsed === "string") {
    errors.push(equipmentParsed);
  }

  let disclaimerVersion: number | undefined;
  if (obj.disclaimerVersion === undefined) {
    errors.push("disclaimerVersion must be a positive integer");
  } else if (
    typeof obj.disclaimerVersion !== "number" ||
    !Number.isInteger(obj.disclaimerVersion) ||
    obj.disclaimerVersion < 1
  ) {
    errors.push("disclaimerVersion must be a positive integer");
  } else {
    disclaimerVersion = obj.disclaimerVersion;
  }

  if (errors.length > 0) {
    return { errors };
  }

  const config: AppConfig = {
    libraryPath: (obj.libraryPath as string).trim(),
    conditions,
    disclaimerVersion: disclaimerVersion!,
    equipment: equipmentParsed as EquipmentConfig,
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

  if (obj.poseModelBaseUrl !== undefined) {
    if (!isNonEmptyString(obj.poseModelBaseUrl)) {
      errors.push("poseModelBaseUrl must be a non-empty string when set");
    } else {
      config.poseModelBaseUrl = obj.poseModelBaseUrl.trim();
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  return { config, errors: [] };
}