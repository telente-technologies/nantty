import { fieldChecks, validateObjectAgainstChecks, type ValidationIssue } from "@/utils/formValidation.util";

export interface CustomerProfileInput {
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly tags: string[];
  readonly marketingOptIn: boolean;
}

export function validateCustomerProfileInput(input: CustomerProfileInput): ValidationIssue[] {
  const issues = validateObjectAgainstChecks(input, {
    name: fieldChecks.text({ label: "Name", min: 2, max: 80 }),
    phone: fieldChecks.optional(fieldChecks.phone()),
    email: fieldChecks.optional(fieldChecks.email()),
  });
  if (input.tags.length > 10) issues.push({ path: "tags", message: "Use at most 10 tags." });
  if (input.tags.some((tag) => !/^[a-z0-9-]{1,24}$/.test(tag))) issues.push({ path: "tags", message: "Tags can use lowercase letters, digits and dashes (up to 24 characters)." });
  return issues;
}

export function parseCustomerTagsText(tagsText: string): string[] {
  return [...new Set(tagsText.split(",").map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean))];
}
