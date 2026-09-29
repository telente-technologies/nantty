import type { Promotion, PromotionStatus } from "@/types/promotion.type";
import type { ValidationIssue } from "@/utils/formValidation.util";

export interface PromotionInput {
  readonly name: string;
  readonly kind: Promotion["kind"];
  readonly code: string | null;
  readonly discount: { readonly kind: "percent" | "amount"; readonly value: number };
  readonly scope: { readonly kind: "all" | "products" | "categories"; readonly ids: string[] };
  readonly minimumSpendMinor: number | null;
  readonly usageLimit: number | null;
  readonly usageLimitPerCustomer: number | null;
  readonly channels: ("online" | "pos")[];
  readonly startsAt: string;
  readonly endsAt: string | null;
}

const promotionKinds: Promotion["kind"][] = ["coupon", "automatic", "scheduled_sale"];

function isOptionalPositiveWholeNumber(value: number | null): boolean {
  return value === null || (Number.isSafeInteger(value) && value > 0 && value <= 10_000_000);
}

export function validatePromotionInput(input: PromotionInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const trimmedName = input.name.trim();
  if (trimmedName.length < 3 || trimmedName.length > 80) issues.push({ path: "name", message: "Name needs 3–80 characters." });
  if (!promotionKinds.includes(input.kind)) issues.push({ path: "kind", message: "Choose a promotion type." });
  if (input.kind === "coupon" && !/^[A-Z0-9_-]{3,24}$/.test(input.code ?? "")) issues.push({ path: "code", message: "Code needs 3–24 capital letters, digits, dashes or underscores." });
  if (input.discount.kind === "percent" && (!Number.isSafeInteger(input.discount.value) || input.discount.value < 1 || input.discount.value > 10_000)) {
    issues.push({ path: "discount", message: "Percent off must be between 0.01% and 100%." });
  }
  if (input.discount.kind === "amount" && (!Number.isSafeInteger(input.discount.value) || input.discount.value < 1)) issues.push({ path: "discount", message: "Enter an amount off greater than zero." });
  if (input.scope.kind !== "all" && input.scope.ids.length === 0) issues.push({ path: "scope", message: `Pick at least one ${input.scope.kind === "products" ? "product" : "category"}.` });
  if (input.minimumSpendMinor !== null && (!Number.isSafeInteger(input.minimumSpendMinor) || input.minimumSpendMinor < 0)) issues.push({ path: "minimumSpend", message: "Minimum spend must be zero or more." });
  if (!isOptionalPositiveWholeNumber(input.usageLimit)) issues.push({ path: "usageLimit", message: "Usage limit must be a whole number above zero." });
  if (!isOptionalPositiveWholeNumber(input.usageLimitPerCustomer)) issues.push({ path: "usageLimitPerCustomer", message: "Limit per customer must be a whole number above zero." });
  if (input.channels.length === 0) issues.push({ path: "channels", message: "Choose where the promotion applies: online, in store or both." });
  const startTime = new Date(input.startsAt).getTime();
  const endTime = input.endsAt ? new Date(input.endsAt).getTime() : null;
  if (Number.isNaN(startTime)) issues.push({ path: "startsAt", message: "Choose a start date and time." });
  if (endTime !== null && (Number.isNaN(endTime) || endTime <= startTime)) issues.push({ path: "endsAt", message: "End must be after the start." });
  if (input.kind === "scheduled_sale" && endTime === null) issues.push({ path: "endsAt", message: "A scheduled sale needs an end date." });
  return issues;
}

export function derivePromotionStatusFromSchedule(promotion: Pick<Promotion, "startsAt" | "endsAt" | "usageLimit" | "usedCount">, now = Date.now()): PromotionStatus {
  if (new Date(promotion.startsAt).getTime() > now) return "scheduled";
  if (promotion.endsAt && new Date(promotion.endsAt).getTime() < now) return "expired";
  if (promotion.usageLimit !== null && promotion.usedCount >= promotion.usageLimit) return "expired";
  return "active";
}
