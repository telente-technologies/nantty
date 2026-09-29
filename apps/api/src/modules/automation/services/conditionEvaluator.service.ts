import type { AutomationEventData, ConditionValue, RuleCondition } from "../models/automation.model.js";

export const FIELD_PATH_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

type Scalar = string | number | boolean | null;

export function readEventField(data: AutomationEventData, field: string): { readonly found: boolean; readonly value: Scalar } {
  if (!FIELD_PATH_PATTERN.test(field) || !Object.hasOwn(data, field)) return { found: false, value: null };
  return { found: true, value: data[field] ?? null };
}

function compareScalars(left: Scalar, right: Scalar): number | undefined {
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "string" && typeof right === "string") return left.localeCompare(right);
  if (typeof left === "number" && typeof right === "string" && right.trim() !== "" && Number.isFinite(Number(right))) return left - Number(right);
  return undefined;
}

function isEqual(left: Scalar, right: ConditionValue | undefined): boolean {
  if (right === undefined || Array.isArray(right)) return false;
  if (typeof left === "number" && typeof right === "string") return left === Number(right);
  return left === right;
}

function listIncludes(list: ConditionValue | undefined, value: Scalar): boolean {
  return Array.isArray(list) && list.some((item) => isEqual(value, item));
}

export function evaluateCondition(condition: RuleCondition, data: AutomationEventData): boolean {
  const { found, value } = readEventField(data, condition.field);
  if (condition.operator === "exists") return found === (condition.value !== false);
  if (!found) return false;
  const expected = condition.value;
  switch (condition.operator) {
    case "eq":
      return isEqual(value, expected);
    case "neq":
      return !isEqual(value, expected);
    case "in":
      return listIncludes(expected, value);
    case "not_in":
      return !listIncludes(expected, value);
    case "contains":
      return typeof value === "string" && typeof expected === "string" && value.toLowerCase().includes(expected.toLowerCase());
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (typeof expected !== "string" && typeof expected !== "number") return false;
      const difference = compareScalars(value, expected);
      if (difference === undefined) return false;
      if (condition.operator === "gt") return difference > 0;
      if (condition.operator === "gte") return difference >= 0;
      if (condition.operator === "lt") return difference < 0;
      return difference <= 0;
    }
  }
}
