import type { StoreSettings } from "@/types/store.type";
import { fieldChecks, validateObjectAgainstChecks, type FieldCheck, type ValidationIssue } from "@/utils/formValidation.util";

const editableTopLevelKeys = new Set(["name", "description", "phone", "email", "address", "taxes", "pricesIncludeTax", "policies", "storeRewards", "notifications"]);
const basisPointsCheck = (label: string) => fieldChecks.integer({ label, min: 0, max: 10_000 });

function prefixIssues(prefix: string, issues: ValidationIssue[]): ValidationIssue[] {
  return issues.map((issue) => ({ path: `${prefix}.${issue.path}`, message: issue.message }));
}

function validateNestedObject(value: unknown, path: string, checks: Record<string, FieldCheck>): ValidationIssue[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [{ path, message: "Send the full section." }];
  return prefixIssues(path, validateObjectAgainstChecks(value, checks));
}

function validateTaxRates(value: unknown, knownCategoryIds: ReadonlySet<string>): ValidationIssue[] {
  if (!Array.isArray(value) || value.length > 20) return [{ path: "taxes", message: "Send up to 20 tax rates." }];
  const issues = value.flatMap((taxRate, index) => {
    const rateIssues = validateNestedObject(taxRate, `taxes.${index}`, {
      id: fieldChecks.pattern("Tax id", /^[A-Za-z0-9_-]{1,40}$/, "is not valid."),
      name: fieldChecks.text({ label: "Tax name", max: 40 }),
      rateBasisPoints: basisPointsCheck("Tax rate"),
      isDefault: fieldChecks.boolean("Default"),
    });
    const categoryIds = (taxRate as { appliesToCategoryIds?: unknown }).appliesToCategoryIds;
    const areCategoriesValid = categoryIds === null || (Array.isArray(categoryIds) && categoryIds.length > 0 && categoryIds.every((categoryId) => typeof categoryId === "string" && knownCategoryIds.has(categoryId)));
    return areCategoriesValid ? rateIssues : [...rateIssues, { path: `taxes.${index}.appliesToCategoryIds`, message: "Pick categories that exist, or apply the rate to everything." }];
  });
  const defaultRates = value.filter((taxRate) => (taxRate as { isDefault?: unknown }).isDefault === true);
  if (value.length > 0 && defaultRates.length !== 1) issues.push({ path: "taxes", message: "Mark exactly one tax rate as the default." });
  if (defaultRates.some((taxRate) => (taxRate as { appliesToCategoryIds?: unknown }).appliesToCategoryIds !== null)) issues.push({ path: "taxes", message: "The default rate must apply to everything." });
  const taxIds = value.map((taxRate) => (taxRate as { id?: unknown }).id);
  if (new Set(taxIds).size !== taxIds.length) issues.push({ path: "taxes", message: "Each tax rate needs its own id." });
  return issues;
}

function validateStoreRewards(value: unknown, storeCurrency: string): ValidationIssue[] {
  const issues = validateNestedObject(value, "storeRewards", {
    enabled: fieldChecks.boolean("Store rewards"),
    percentBackBasisPoints: fieldChecks.integer({ label: "Reward percentage", min: 0, max: 2_000 }),
    expiryDays: fieldChecks.integer({ label: "Expiry", min: 7, max: 730 }),
  });
  for (const key of ["minimumOrder", "maxPerOrder"] as const) {
    const money = (value as Record<string, { amountMinor?: unknown; currency?: unknown } | undefined> | null)?.[key];
    if (!money || typeof money.amountMinor !== "number" || !Number.isSafeInteger(money.amountMinor) || money.amountMinor < 0 || money.amountMinor > 1_000_000_000) issues.push({ path: `storeRewards.${key}`, message: "Enter a valid amount." });
    else if (money.currency !== storeCurrency) issues.push({ path: `storeRewards.${key}`, message: `Amount must be in your store currency (${storeCurrency}).` });
  }
  return issues;
}

export function validateStoreSettingsPatch(body: Record<string, unknown>, current: StoreSettings, knownCategoryIds: ReadonlySet<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = Object.keys(body)
    .filter((key) => !editableTopLevelKeys.has(key))
    .map((key) => ({ path: key, message: `${key} cannot be changed here.` }));
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const topLevelChecks: Record<string, FieldCheck> = {};
  if (has("name")) topLevelChecks.name = fieldChecks.text({ label: "Store name", min: 2, max: 80 });
  if (has("description")) topLevelChecks.description = (value) => (typeof value === "string" && value.length <= 500 ? null : "Description must be 500 characters or fewer.");
  if (has("phone")) topLevelChecks.phone = fieldChecks.phone();
  if (has("email")) topLevelChecks.email = fieldChecks.email();
  if (has("address")) topLevelChecks.address = fieldChecks.text({ label: "Address", min: 5, max: 200 });
  if (has("pricesIncludeTax")) topLevelChecks.pricesIncludeTax = fieldChecks.boolean("Prices include tax");
  issues.push(...validateObjectAgainstChecks(body, topLevelChecks));
  if (has("taxes")) issues.push(...validateTaxRates(body.taxes, knownCategoryIds));
  if (has("storeRewards")) issues.push(...validateStoreRewards(body.storeRewards, current.currency));
  if (has("policies")) {
    issues.push(...validateNestedObject(body.policies, "policies", {
      returns: (value) => (typeof value === "string" && value.length <= 2000 ? null : "Keep the returns policy under 2,000 characters."),
      shipping: (value) => (typeof value === "string" && value.length <= 2000 ? null : "Keep the shipping policy under 2,000 characters."),
      privacy: (value) => (typeof value === "string" && value.length <= 2000 ? null : "Keep the privacy policy under 2,000 characters."),
    }));
  }
  if (has("notifications")) {
    const notificationKeys = Object.keys(current.notifications);
    issues.push(...validateNestedObject(body.notifications, "notifications", Object.fromEntries(notificationKeys.map((key) => [key, fieldChecks.boolean(key)]))));
  }
  return issues;
}

export function normaliseStoreSettingsPatch(body: Record<string, unknown>): Partial<StoreSettings> {
  const trimmed: Record<string, unknown> = { ...body };
  for (const key of ["name", "description", "phone", "email", "address"]) {
    if (typeof trimmed[key] === "string") trimmed[key] = (trimmed[key] as string).trim();
  }
  return trimmed as Partial<StoreSettings>;
}
