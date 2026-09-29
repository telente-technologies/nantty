import type { StoreSettings } from "@/types/store.type";
import { fieldChecks, validateObjectAgainstChecks, type FieldCheck, type ValidationIssue } from "@/utils/formValidation.util";

const editableTopLevelKeys = new Set(["name", "description", "phone", "email", "address", "taxes", "pricesIncludeTax", "receipt", "paymentMethods", "discountApprovalThresholdBasisPoints", "loyalty", "notifications"]);
const paymentMethodValues = ["cash", "card", "bank_transfer", "zudomart_wallet", "pay_link"] as const;
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

function validatePaymentMethods(value: unknown): ValidationIssue[] {
  if (!Array.isArray(value) || value.length === 0) return [{ path: "paymentMethods", message: "Send your payment methods." }];
  const issues = value.flatMap((paymentMethod, index) =>
    validateNestedObject(paymentMethod, `paymentMethods.${index}`, {
      method: fieldChecks.oneOf("Payment method", paymentMethodValues),
      enabled: fieldChecks.boolean("Enabled"),
      label: fieldChecks.text({ label: "Label", max: 40 }),
      instructions: fieldChecks.optional(fieldChecks.text({ label: "Instructions", max: 300 })),
    }),
  );
  const methods = value.map((paymentMethod) => (paymentMethod as { method?: unknown }).method);
  if (new Set(methods).size !== methods.length) issues.push({ path: "paymentMethods", message: "Each payment method can appear once." });
  if (!value.some((paymentMethod) => (paymentMethod as { enabled?: unknown }).enabled === true)) issues.push({ path: "paymentMethods", message: "Keep at least one payment method switched on." });
  return issues;
}

function validateLoyaltyRules(value: unknown, storeCurrency: string): ValidationIssue[] {
  const issues = validateNestedObject(value, "loyalty", {
    enabled: fieldChecks.boolean("Loyalty"),
    minimumPointsToRedeem: fieldChecks.integer({ label: "Minimum points", min: 0, max: 1_000_000 }),
  });
  const redeemValue = (value as { redeemValuePerPoint?: { amountMinor?: unknown; currency?: unknown } } | null)?.redeemValuePerPoint;
  if (!redeemValue || typeof redeemValue.amountMinor !== "number" || !Number.isSafeInteger(redeemValue.amountMinor) || redeemValue.amountMinor < 0 || redeemValue.amountMinor > 10_000_000) {
    issues.push({ path: "loyalty.redeemValuePerPoint", message: "Enter a valid value for each point." });
  } else if (redeemValue.currency !== storeCurrency) {
    issues.push({ path: "loyalty.redeemValuePerPoint", message: `Point value must be in your store currency (${storeCurrency}).` });
  }
  const spendRequired = (value as { spendRequiredPerPoint?: { amountMinor?: unknown; currency?: unknown } } | null)?.spendRequiredPerPoint;
  if (!spendRequired || typeof spendRequired.amountMinor !== "number" || !Number.isSafeInteger(spendRequired.amountMinor) || spendRequired.amountMinor < 1 || spendRequired.amountMinor > 100_000_000) {
    issues.push({ path: "loyalty.spendRequiredPerPoint", message: "Enter how much a customer spends to earn one point." });
  } else if (spendRequired.currency !== storeCurrency) {
    issues.push({ path: "loyalty.spendRequiredPerPoint", message: `Spend per point must be in your store currency (${storeCurrency}).` });
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
  if (has("discountApprovalThresholdBasisPoints")) topLevelChecks.discountApprovalThresholdBasisPoints = basisPointsCheck("Approval threshold");
  issues.push(...validateObjectAgainstChecks(body, topLevelChecks));
  if (has("taxes")) issues.push(...validateTaxRates(body.taxes, knownCategoryIds));
  if (has("paymentMethods")) issues.push(...validatePaymentMethods(body.paymentMethods));
  if (has("loyalty")) issues.push(...validateLoyaltyRules(body.loyalty, current.currency));
  if (has("receipt")) {
    issues.push(...validateNestedObject(body.receipt, "receipt", {
      showLogo: fieldChecks.boolean("Show logo"),
      showCashierName: fieldChecks.boolean("Show cashier"),
      headerText: fieldChecks.optional(fieldChecks.text({ label: "Header", max: 120 })),
      footerText: fieldChecks.optional(fieldChecks.text({ label: "Footer", max: 200 })),
      returnPolicy: fieldChecks.optional(fieldChecks.text({ label: "Return policy", max: 400 })),
      paperWidth: fieldChecks.oneOf("Paper width", ["58mm", "80mm"] as const),
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
