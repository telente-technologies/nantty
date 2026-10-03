import type { Customer, CustomerSegmentInput, CustomerSegmentRule, CustomerSegmentRuleField, CustomerType } from "@/types/customer.type";
import type { ValidationIssue } from "@/utils/formValidation.util";

const millisecondsInOneDay = 86_400_000;

export const customerSegmentRuleFieldLabels: Record<CustomerSegmentRuleField, string> = {
  total_spent: "Total spent",
  purchases_count: "Number of orders",
  days_since_last_purchase: "Days since last order",
  days_since_first_purchase: "Days since first order",
  average_order_value: "Average order value",
  tag: "Has tag",
  marketing_opt_in: "Accepts offers",
  city: "City",
};

export const moneyRuleFields: readonly CustomerSegmentRuleField[] = ["total_spent", "average_order_value"];
export const numberRuleFields: readonly CustomerSegmentRuleField[] = ["purchases_count", "days_since_last_purchase", "days_since_first_purchase"];
export const textRuleFields: readonly CustomerSegmentRuleField[] = ["tag", "city"];

export function deriveCustomerTypeFromPurchases(customer: Pick<Customer, "purchasesCount">): CustomerType {
  if (customer.purchasesCount >= 2) return "returning";
  if (customer.purchasesCount === 1) return "new";
  return "no_orders";
}

function countDaysSince(isoDate: string | null, now: number): number | null {
  if (!isoDate) return null;
  return Math.floor((now - new Date(isoDate).getTime()) / millisecondsInOneDay);
}

function readCustomerValueForRuleField(customer: Customer, field: CustomerSegmentRuleField, now: number): number | string | boolean | string[] | null {
  if (field === "total_spent") return customer.totalSpent.amountMinor;
  if (field === "average_order_value") return customer.averageOrderValue?.amountMinor ?? 0;
  if (field === "purchases_count") return customer.purchasesCount;
  if (field === "days_since_last_purchase") return countDaysSince(customer.lastPurchaseAt, now);
  if (field === "days_since_first_purchase") return countDaysSince(customer.firstPurchaseAt, now);
  if (field === "tag") return customer.tags;
  if (field === "marketing_opt_in") return customer.marketingOptIn;
  return customer.city;
}

export function doesCustomerMatchSegmentRule(customer: Customer, rule: CustomerSegmentRule, now = Date.now()): boolean {
  const customerValue = readCustomerValueForRuleField(customer, rule.field, now);
  if (customerValue === null) return false;
  if (Array.isArray(customerValue)) return customerValue.includes(String(rule.value).toLowerCase());
  if (typeof customerValue === "boolean") return customerValue === rule.value;
  if (typeof customerValue === "string") return customerValue.toLowerCase() === String(rule.value).toLowerCase();
  const ruleNumber = Number(rule.value);
  if (rule.operator === "at_least") return customerValue >= ruleNumber;
  if (rule.operator === "at_most") return customerValue <= ruleNumber;
  return customerValue === ruleNumber;
}

export function doesCustomerMatchEverySegmentRule(customer: Customer, rules: readonly CustomerSegmentRule[], now = Date.now()): boolean {
  return rules.every((rule) => doesCustomerMatchSegmentRule(customer, rule, now));
}

export function validateCustomerSegmentInput(input: CustomerSegmentInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (input.name.trim().length < 2 || input.name.trim().length > 60) issues.push({ path: "name", message: "Name needs 2–60 characters." });
  if (input.description.length > 200) issues.push({ path: "description", message: "Keep the description under 200 characters." });
  if (input.rules.length === 0 || input.rules.length > 8) issues.push({ path: "rules", message: "Add between 1 and 8 rules." });
  input.rules.forEach((rule, index) => {
    if (!(rule.field in customerSegmentRuleFieldLabels)) issues.push({ path: `rules.${index}.field`, message: "Choose what the rule checks." });
    if (rule.field === "marketing_opt_in" && typeof rule.value !== "boolean") issues.push({ path: `rules.${index}.value`, message: "Choose yes or no." });
    if (textRuleFields.includes(rule.field) && (typeof rule.value !== "string" || rule.value.trim().length === 0 || rule.value.length > 40)) issues.push({ path: `rules.${index}.value`, message: "Enter a value (up to 40 characters)." });
    if ([...moneyRuleFields, ...numberRuleFields].includes(rule.field) && (typeof rule.value !== "number" || !Number.isSafeInteger(rule.value) || rule.value < 0)) issues.push({ path: `rules.${index}.value`, message: "Enter a whole number of zero or more." });
  });
  return issues;
}
