import { failValidation } from "@/mocks/mockResponses.mock";
import type { Money } from "@/types/api.type";

export type JsonObject = Record<string, unknown>;

export function readObjectAtPath(value: unknown, path: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) failValidation(path, `${path} must be an object.`);
  return value as JsonObject;
}

export function readArrayAtPath(value: unknown, path: string, maximumItems: number): unknown[] {
  if (!Array.isArray(value)) failValidation(path, `${path} must be a list.`);
  if (value.length > maximumItems) failValidation(path, `${path} can have at most ${maximumItems} items.`);
  return value;
}

export function readIntegerBetween(source: JsonObject, key: string, path: string, minimum: number, maximum: number): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) failValidation(`${path}.${key}`, `${key} must be a whole number from ${minimum} to ${maximum}.`);
  return value;
}

export function readBasisPoints(source: JsonObject, key: string, path: string, maximum = 10_000): number {
  return readIntegerBetween(source, key, path, 0, maximum);
}

export function readBooleanValue(source: JsonObject, key: string, path: string): boolean {
  const value = source[key];
  if (typeof value !== "boolean") failValidation(`${path}.${key}`, `${key} must be true or false.`);
  return value;
}

export function readTextValue(source: JsonObject, key: string, path: string, maximumLength: number, minimumLength = 0): string {
  const value = source[key];
  if (typeof value !== "string") failValidation(`${path}.${key}`, `${key} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length < minimumLength) failValidation(`${path}.${key}`, minimumLength === 1 ? `${key} is required.` : `${key} needs at least ${minimumLength} characters.`);
  if (trimmed.length > maximumLength) failValidation(`${path}.${key}`, `${key} can be at most ${maximumLength} characters.`);
  return trimmed;
}

export function readNullableTextValue(source: JsonObject, key: string, path: string, maximumLength: number): string | null {
  const value = source[key];
  if (value === null || value === undefined || value === "") return null;
  return readTextValue(source, key, path, maximumLength);
}

export function readTextList(source: JsonObject, key: string, path: string, maximumItems: number, maximumLength: number, pattern?: RegExp): string[] {
  const items = readArrayAtPath(source[key], `${path}.${key}`, maximumItems).map((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0 || item.trim().length > maximumLength) failValidation(`${path}.${key}.${index}`, `Each entry must be 1–${maximumLength} characters.`);
    if (pattern && !pattern.test(item.trim())) failValidation(`${path}.${key}.${index}`, `"${item}" is not allowed here.`);
    return item.trim();
  });
  return [...new Set(items)];
}

export function readMoneyValue(value: unknown, path: string, allowedCurrencies: readonly string[], expectedCurrency?: string): Money {
  const money = readObjectAtPath(value, path);
  const currency = money.currency;
  if (typeof currency !== "string" || !allowedCurrencies.includes(currency)) failValidation(`${path}.currency`, `Currency must be one of ${allowedCurrencies.join(", ")}.`);
  if (expectedCurrency && currency !== expectedCurrency) failValidation(`${path}.currency`, `This amount must be in ${expectedCurrency}.`);
  const amountMinor = money.amountMinor;
  if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor) || amountMinor < 0) failValidation(`${path}.amountMinor`, "Amounts are whole minor units and cannot be negative.");
  return { amountMinor, currency };
}

export function readMoneyPerCurrencyList(source: JsonObject, key: string, path: string, allowedCurrencies: readonly string[]): Money[] {
  const amounts = readArrayAtPath(source[key], `${path}.${key}`, allowedCurrencies.length).map((item, index) => readMoneyValue(item, `${path}.${key}.${index}`, allowedCurrencies));
  if (new Set(amounts.map((amount) => amount.currency)).size !== amounts.length) failValidation(`${path}.${key}`, "Each currency can appear only once.");
  return amounts;
}

export function readCurrencyCodeList(source: JsonObject, key: string, path: string): string[] {
  return readTextList(source, key, path, 40, 3, /^[A-Z]{3}$/);
}

export function readCountryCodeList(source: JsonObject, key: string, path: string): string[] {
  return readTextList(source, key, path, 250, 2, /^[A-Z]{2}$/);
}

export function readEnumFromObject<Value extends string>(source: JsonObject, key: string, path: string, allowedValues: readonly Value[]): Value {
  const value = source[key];
  if (typeof value !== "string" || !(allowedValues as readonly string[]).includes(value)) failValidation(`${path}.${key}`, `${key} must be one of ${allowedValues.join(", ")}.`);
  return value as Value;
}
